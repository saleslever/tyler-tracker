/**
 * Bulk-ingest Tyler's 28 screenshots.
 *
 * Steps for each image:
 *   1. Classify: weigh-in (Wyze) / macros (MacroFactor) / workout / basketball / other
 *   2. Route to the right extractor (existing extractFromImage in coachEngine.ts)
 *   3. Write the parsed values to the DB via coachStorage
 *   4. Emit a receipt line
 *
 * Notes:
 * - Uses ANTHROPIC_API_KEY from env
 * - Writes to the production DATABASE_URL that the server uses
 * - Skips writes for anything the extractor returns an error on and logs it
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { extractFromImage } from "../server/coachEngine";
import {
  createBodyScan,
  upsertMacroLog,
  logWorkoutSets,
} from "../server/coachStorage";

const ATTACHMENT_DIR =
  "/home/user/workspace/uploaded_attachments/85926284f9e8437b9a82f06bb4426479";

// The user gave us a range: macros logs start Aug 1, 2026; weigh-ins recent.
// We don't have per-image dates from EXIF (already stripped by uploader). So we
// let the classifier also read the date visible in the screenshot when possible,
// and fall back to a sensible default per-kind if it can't.
const FALLBACK_TODAY = "2026-08-15";

type Kind = "weight" | "macros" | "workout" | "basketball" | "skip";

async function classify(imageDataUrl: string): Promise<{ kind: Kind; date?: string; hint?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return { kind: "skip", hint: "not a data url" };
  const mediaType = match[1];
  const b64 = match[2];

  const prompt = `Classify this screenshot into exactly ONE of these categories:
- "weight": Wyze scale, InBody, Renpho, or any bodyweight/body-composition screen
- "macros": MacroFactor, Cronometer, MyFitnessPal, or any daily calorie/macro summary
- "workout": strength training log — exercises with sets/reps/weight (redlined = completed)
- "basketball": basketball workout, court session, shooting drills
- "skip": anything else (settings, chat, home screen, blurry, etc.)

If you can read a date on the screenshot in YYYY-MM-DD form, include it.
Return ONLY valid JSON: {"kind": "...", "date": "YYYY-MM-DD" or null, "hint": "one-line description"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  const data = await res.json() as any;
  const text = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { kind: "skip", hint: "no json" };
  try { return JSON.parse(jsonMatch[0]); } catch { return { kind: "skip", hint: "bad json" }; }
}

function fileToDataUrl(fp: string): string {
  const buf = fs.readFileSync(fp);
  const ext = path.extname(fp).toLowerCase();
  const mime = ext === ".png" ? "image/png"
    : ext === ".jpeg" || ext === ".jpg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp"
    : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function main() {
  const files = fs.readdirSync(ATTACHMENT_DIR)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  console.log(`Ingesting ${files.length} screenshots\n`);
  const receipts: Array<{file: string; kind: string; result: string}> = [];

  for (const f of files) {
    const fp = path.join(ATTACHMENT_DIR, f);
    const dataUrl = fileToDataUrl(fp);
    process.stdout.write(`[${f}] classifying... `);

    let cls;
    try { cls = await classify(dataUrl); }
    catch (e: any) { console.log(`FAIL: ${e.message}`); receipts.push({file: f, kind: "?", result: `classify error: ${e.message}`}); continue; }

    const date = cls.date && /^\d{4}-\d{2}-\d{2}$/.test(cls.date) ? cls.date : FALLBACK_TODAY;
    process.stdout.write(`${cls.kind} (${date}) `);

    if (cls.kind === "skip") { console.log(`skipped: ${cls.hint ?? ""}`); receipts.push({file: f, kind: "skip", result: cls.hint ?? "skipped"}); continue; }

    try {
      if (cls.kind === "weight") {
        const ex = await extractFromImage(dataUrl, "scan");
        if (ex.error || typeof ex.weight !== "number") { console.log(`extract fail: ${ex.error ?? "no weight"}`); receipts.push({file: f, kind: "weight", result: `extract fail: ${ex.error ?? "no weight"}`}); continue; }
        const row = await createBodyScan({
          date,
          weight: ex.weight,
          bodyFatPct: ex.bodyFatPct ?? null,
          muscleMass: ex.muscleMass ?? null,
          dailyCalorieTarget: null,
          source: ex.source ?? "Wyze",
          notes: ex.notes ?? null,
        } as any);
        console.log(`saved body_scan #${(row as any).id}: ${ex.weight} lb`);
        receipts.push({file: f, kind: "weight", result: `body_scan #${(row as any).id}: ${ex.weight} lb (${date})`});
      } else if (cls.kind === "macros") {
        const ex = await extractFromImage(dataUrl, "macros");
        if (ex.error) { console.log(`extract fail: ${ex.error}`); receipts.push({file: f, kind: "macros", result: `extract fail: ${ex.error}`}); continue; }
        const row = await upsertMacroLog({
          date,
          calories: ex.calories ?? null,
          proteinG: ex.proteinG ?? null,
          fatG: ex.fatG ?? null,
          carbsG: ex.carbsG ?? null,
          netCarbsG: ex.netCarbsG ?? null,
          source: "MacroFactor",
          notes: ex.notes ?? null,
        } as any);
        console.log(`saved macro #${(row as any).id}: ${ex.calories} kcal, ${ex.proteinG}g P`);
        receipts.push({file: f, kind: "macros", result: `macro #${(row as any).id}: ${ex.calories} kcal, ${ex.proteinG}g P (${date})`});
      } else if (cls.kind === "workout" || cls.kind === "basketball") {
        const ex = await extractFromImage(dataUrl, "workout");
        if (ex.error || !Array.isArray(ex.exercises)) { console.log(`extract fail: ${ex.error ?? "no exercises"}`); receipts.push({file: f, kind: cls.kind, result: `extract fail: ${ex.error ?? "no exercises"}`}); continue; }
        // Flatten exercises -> sets
        const sets: any[] = [];
        for (const ex1 of ex.exercises) {
          const target = cls.kind === "basketball" ? "basketball" : (ex1.targetBodyPart ?? "none");
          const setCount = Number(ex1.sets) || 1;
          for (let i = 1; i <= setCount; i++) {
            const wStr = String(ex1.weight ?? "").replace(/[^\d.]/g, "");
            const rStr = String(ex1.reps ?? "").replace(/[^\d.]/g, "").split(".")[0];
            sets.push({
              date,
              exerciseName: ex1.name,
              setNumber: i,
              reps: rStr ? parseInt(rStr) : null,
              weight: wStr ? parseFloat(wStr) : null,
              weightUnit: "lb",
              targetBodyPart: target,
              rpe: null,
              notes: null,
            });
          }
        }
        if (sets.length === 0) { console.log(`no sets found`); receipts.push({file: f, kind: cls.kind, result: `no sets found`}); continue; }
        const rows = await logWorkoutSets(sets as any);
        console.log(`saved ${rows.length} sets across ${ex.exercises.length} exercises`);
        receipts.push({file: f, kind: cls.kind, result: `${rows.length} sets, ${ex.exercises.length} exercises (${date})`});
      }
    } catch (e: any) {
      console.log(`write fail: ${e.message}`);
      receipts.push({file: f, kind: cls.kind, result: `write fail: ${e.message}`});
    }
  }

  console.log("\n=== SUMMARY ===");
  const counts: Record<string, number> = {};
  for (const r of receipts) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  console.log(counts);
  console.log("\nDetailed:");
  for (const r of receipts) console.log(`  [${r.kind}] ${r.file}: ${r.result}`);

  fs.writeFileSync("/tmp/bulk_ingest_receipts.json", JSON.stringify(receipts, null, 2));
  console.log("\nReceipts saved to /tmp/bulk_ingest_receipts.json");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
