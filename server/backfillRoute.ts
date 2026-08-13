/**
 * One-shot admin route: /api/admin/backfill-2026-08-12
 * Idempotent (checks date+source before insert) so re-running is safe.
 * Gated by X-Admin-Token header matching ADMIN_TOKEN env var.
 * Remove this file after the backfill lands.
 */
import type { Express } from "express";
import { pool } from "./storage";

export function registerBackfillRoute(app: Express) {
  app.post("/api/admin/backfill-2026-08-12", async (req, res) => {
    const token = req.header("x-admin-token");
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ error: "forbidden" });
    }

    const now = new Date().toISOString();
    const source = "screenshot_batch_2026-08-12";
    const log: string[] = [];

    try {
      // ─── Body scans (full WYZE) ─────────────────────────────
      const scans = [
        { date: "2026-08-02", weight: 249.3, bf: 33.7, lean: 165.3, fat: 84.0, visceral: 16,
          notes: "WYZE full body composition. BMR 1990 kcal. Muscle mass 154.3 lb, skeletal muscle 95.2 lb. BMI 31.3. Metabolic age 44." },
        { date: "2026-08-10", weight: 252.2, bf: 34.1, lean: 166.2, fat: 86.0, visceral: 16,
          notes: "WYZE full body composition. BMR 1998 kcal. Muscle mass 155.2 lb, skeletal muscle 95.8 lb. BMI 31.7. NOTE: 252.2 is high vs daily trend (Aug 11 morn 248.0, Aug 12 morn 246.9) — likely fed/hydrated." },
      ];
      for (const s of scans) {
        const ex = await pool.query("select id from body_scans where date=$1 and source=$2", [s.date, "wyze"]);
        if (ex.rowCount) {
          await pool.query(`update body_scans set weight=$1, body_fat_pct=$2, lean_mass_lbs=$3, fat_mass_lbs=$4, visceral_fat=$5, notes=$6 where id=$7`,
            [s.weight, s.bf, s.lean, s.fat, s.visceral, s.notes, ex.rows[0].id]);
          log.push(`update body_scan ${s.date}`);
        } else {
          await pool.query(`insert into body_scans (date, weight, body_fat_pct, lean_mass_lbs, fat_mass_lbs, visceral_fat, source, notes, created_at) values ($1,$2,$3,$4,$5,$6,'wyze',$7,$8)`,
            [s.date, s.weight, s.bf, s.lean, s.fat, s.visceral, s.notes, now]);
          log.push(`insert body_scan ${s.date}`);
        }
      }

      // ─── Daily weights ──────────────────────────────────────
      const weights: [string, number, string?][] = [
        ["2026-07-25", 250.2], ["2026-07-27", 252.0], ["2026-07-28", 252.0], ["2026-07-29", 251.5],
        ["2026-08-01", 251.5], ["2026-08-03", 248.5], ["2026-08-04", 248.7], ["2026-08-05", 248.5],
        ["2026-08-06", 247.8], ["2026-08-07", 248.7], ["2026-08-08", 248.9], ["2026-08-09", 248.9],
        ["2026-08-11", 248.0], ["2026-08-12", 246.9, "Morning weight 6:46am."],
      ];
      for (const [date, w, note] of weights) {
        const ex = await pool.query("select id from body_scans where date=$1 and source=$2", [date, "wyze_daily"]);
        if (ex.rowCount) {
          await pool.query(`update body_scans set weight=$1, notes=$2 where id=$3`, [w, note ?? null, ex.rows[0].id]);
          log.push(`update daily ${date}`);
        } else {
          await pool.query(`insert into body_scans (date, weight, source, notes, created_at) values ($1,$2,'wyze_daily',$3,$4)`,
            [date, w, note ?? null, now]);
          log.push(`insert daily ${date}: ${w}`);
        }
      }

      // ─── Macro logs ─────────────────────────────────────────
      const macros = [
        { date: "2026-08-10", cal: 2477, p: 224.5, f: 126.4, c: 134.1, fib: 44.0,
          notes: "MacroFactor (Yesterday view Aug 11 eve). 154% of 1607 kcal. Net non-fiber carbs 90.1g." },
        { date: "2026-08-11", cal: 1901, p: 181.3, f: 91.7, c: 81.0, fib: null,
          notes: "MacroFactor. Target 1607/216/59/51. Steps 4992 (7d). Fat overshoot. Meals: Egg&Steak Keto Bowl, Core Power, protein jello, protein bar, Freezer Burger Burritos, CC Pumpkin Pudding, popcorn." },
        { date: "2026-08-12", cal: 1927, p: 210.0, f: 86.0, c: 72.0, fib: null,
          notes: "MacroFactor 4:06pm capture — day not over. Protein hit (210/216). Meals: Egg&Steak Keto Bowl 699, Core Power 230, Protein Jello 176, Built bar 150, Freezer Burritos 369, CC Pumpkin Pudding 269, Pie Filling 35." },
      ];
      for (const m of macros) {
        const ex = await pool.query("select id from macro_logs where date=$1 and source=$2", [m.date, "macrofactor"]);
        if (ex.rowCount) {
          await pool.query(`update macro_logs set calories=$1, protein_g=$2, carbs_g=$3, fat_g=$4, fiber_g=$5, notes=$6, verified_by_user=1 where id=$7`,
            [m.cal, m.p, m.c, m.f, m.fib, m.notes, ex.rows[0].id]);
          log.push(`update macros ${m.date}`);
        } else {
          await pool.query(`insert into macro_logs (date, calories, protein_g, carbs_g, fat_g, fiber_g, source, verified_by_user, notes, created_at) values ($1,$2,$3,$4,$5,$6,'macrofactor',1,$7,$8)`,
            [m.date, m.cal, m.p, m.c, m.f, m.fib, m.notes, now]);
          log.push(`insert macros ${m.date}: ${m.cal} kcal`);
        }
      }

      // ─── Nutrition target (recovered from MacroFactor header) ───
      const existingT = await pool.query("select id, calories from nutrition_targets where effective_date <= $1 order by effective_date desc, id desc limit 1", ["2026-08-12"]);
      if (existingT.rowCount && existingT.rows[0].calories === 1607) {
        log.push("target already 1607");
      } else {
        await pool.query(`insert into nutrition_targets (effective_date, calories, protein_grams_min, protein_grams_max, fasting_hours_min, fasting_hours_max, source, notes, created_at) values ($1,1607,210,216,16,18,'macrofactor',$2,$3)`,
          ["2026-08-12", "Recovered from MacroFactor header (1607/216/59/51).", now]);
        log.push("insert target 1607 kcal");
      }

      // ─── Coach memory ───────────────────────────────────────
      const facts: [string, string][] = [
        ["goal_visual", "I have an AI-generated 6-frame body composition projection: Today 249 lb → 225 → 210 → 195 (~15% BF, goal) → 188 (~12%) → 184 (~10%). Visual reference for the cut."],
        ["body_stats", "I am 6'3\" tall."],
        ["body_stats", "My chronological age is 40 (metabolic age per WYZE reads 44)."],
        ["body_stats", "My BMR per WYZE Aug 10 scan is 1998 kcal."],
      ];
      for (const [kind, fact] of facts) {
        const ex = await pool.query("select id from coach_memory where fact=$1", [fact]);
        if (!ex.rowCount) {
          await pool.query(`insert into coach_memory (kind, fact, source, confidence, created_at) values ($1,$2,$3,'high',$4)`,
            [kind, fact, source, now]);
          log.push(`insert memory: ${fact.slice(0, 40)}…`);
        }
      }

      // ─── Workout logs — schema is per-set (exercise, target_body_part, set_number, reps, load_lbs, rpe, notes) ───
      // No source column, so idempotency key: (date, exercise, notes contains 'screenshot_batch_2026-08-12')
      type Ex = { name: string; part: string; sets: number; repsMin: number; repsMax: number };
      const monday: Ex[] = [
        { name: "Deadlift", part: "back", sets: 3, repsMin: 5, repsMax: 6 },
        { name: "Leg press", part: "quads", sets: 3, repsMin: 10, repsMax: 12 },
        { name: "Flat bench press", part: "chest", sets: 3, repsMin: 8, repsMax: 10 },
        { name: "Chest-supported row", part: "back", sets: 3, repsMin: 8, repsMax: 12 },
        { name: "Incline dumbbell bench", part: "chest", sets: 3, repsMin: 8, repsMax: 12 },
        { name: "Lat pulldown", part: "back", sets: 3, repsMin: 8, repsMax: 12 },
        { name: "Standing DB shoulder press", part: "shoulders", sets: 3, repsMin: 8, repsMax: 10 },
        { name: "Hanging knee raises", part: "core", sets: 3, repsMin: 10, repsMax: 15 },
      ];
      const tuesday: Ex[] = [
        { name: "Deadlift (trap-bar)", part: "back", sets: 3, repsMin: 5, repsMax: 6 },
        { name: "Bulgarian split squat", part: "quads", sets: 3, repsMin: 8, repsMax: 10 },
        { name: "Chin-ups", part: "back", sets: 3, repsMin: 6, repsMax: 10 },
        { name: "Reverse-grip bench press", part: "chest", sets: 3, repsMin: 8, repsMax: 10 },
        { name: "Landmine press", part: "shoulders", sets: 3, repsMin: 8, repsMax: 10 },
        { name: "DB curls", part: "biceps", sets: 3, repsMin: 10, repsMax: 12 },
      ]; // hip thrust + rope pressdowns skipped

      const NOTE_MARK = `[${source}]`;

      async function logDay(date: string, label: string, exercises: Ex[]) {
        const ex = await pool.query("select count(*)::int as n from workout_logs where date=$1 and notes like $2", [date, `%${NOTE_MARK}%`]);
        if (ex.rows[0].n > 0) { log.push(`workout ${date} already logged (${ex.rows[0].n} rows)`); return; }
        let setCount = 0;
        for (const e of exercises) {
          for (let s = 1; s <= e.sets; s++) {
            await pool.query(
              `insert into workout_logs (date, exercise, target_body_part, set_number, reps, load_lbs, rpe, is_substitution, substituted_for, notes, logged_at)
               values ($1,$2,$3,$4,NULL,NULL,NULL,0,NULL,$5,$6)`,
              [date, e.name, e.part, s, `${label} — completed per plan. Prescription ${e.sets}x${e.repsMin}-${e.repsMax}. Weight/reps not captured in screenshot. ${NOTE_MARK}`, now]
            );
            setCount++;
          }
        }
        log.push(`logged ${setCount} sets across ${exercises.length} exercises for ${date}`);
      }
      await logDay("2026-08-10", "Monday Full Body Strength", monday);
      await logDay("2026-08-11", "Tuesday Full Body B", tuesday);

      res.json({ ok: true, log });
    } catch (err: any) {
      console.error("[backfill] failed", err);
      res.status(500).json({ ok: false, error: err.message, log });
    }
  });
}
