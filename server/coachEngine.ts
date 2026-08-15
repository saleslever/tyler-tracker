/**
 * Coach engine — the reasoning layer.
 *
 * Given a CoachContext (from coachStorage.buildCoachContext) and a user message,
 * produce a coach response. Uses Anthropic's Claude Sonnet 4.6 via direct API.
 *
 * SECURITY: Never commits keys. Reads ANTHROPIC_API_KEY from process.env only.
 * If unset, engine returns a diagnostic message so the UI still functions.
 *
 * OUTPUTS: The coach can return prose AND structured decisions (workout plans,
 * memory updates, target changes). Decisions are proposed, not auto-applied —
 * except workout logging which is user-initiated.
 */
import type { CoachContext } from "./coachStorage";
import { logConversation, addCoachMemory, upsertWorkoutPlan } from "./coachStorage";

const COACH_MODEL = "claude-sonnet-4-5-20250929";  // Anthropic API model id for Claude Sonnet 4.6
const COACH_MAX_TOKENS = 2048;

export interface CoachResponse {
  text: string;
  decisions?: {
    memoryToAdd?: { kind: string; fact: string }[];
    workoutPlanToSet?: any;
    remindersToSet?: { task: string; dueTime?: string }[];
  };
  contextSnapshot: any;
  model: string;
  error?: string;
}

/**
 * Build the system prompt from durable memory + hard-coded coach rules.
 */
function buildSystemPrompt(ctx: CoachContext): string {
  const memoryBlock = ctx.memory
    .map(m => `- [${m.kind}] ${m.fact}`)
    .join("\n") || "- (no memory yet)";

  // Compute anchored days-sober (last drink July 30 2026)
  const daysSober = Math.max(0, Math.floor((Date.now() - new Date("2026-07-31T00:00:00").getTime()) / 864e5) + 1);

  return `You are ATLAS — Tyler's personal fitness coach. A strict, blunt, best-in-class trainer with the presence of a stoic warrior general. Modern luxury, spartan heroic vibe.

# YOUR CORE MISSION
Build Tyler into a dangerous, ripped basketball player. Even muscle-group distribution, no gaps, no double-counted compound lifts.

# TYLER'S FRAMEWORK (PERMANENT — never ask him to restate any of this)
- Date of birth: March 6, 1986. Age 40.
- Starting weight: 252.2 lb. Target: 195 lb at 12–15% body fat with visible abs.
- HARD DEADLINE: March 6, 2027 (his 41st birthday). Non-negotiable.
- Diet: keto/low-carb 6 days/week. 16–20h fasting daily. 200g protein daily. 1800–2000 kcal on training/rest days; 3000 kcal on Saturdays (high-carb + basketball day).
- Training split: heavy lifting Mon/Tue/Thu/Fri.
- Weekly set targets: 18 sets/week per body part (shoulders, chest, back, biceps, triceps, legs) + 9 sets abs.
- Daily habits Tyler tracks: 16–20h fast, low-carb (except Sat), 10k steps, 1 gallon water, no alcohol, 200g protein, 1800–2000 kcal, lifting 4x/wk, 10g creatine, no nicotine past 3pm.
- Sobriety: last drink July 30, 2026. Day ${daysSober} sober as of ${ctx.today}. Never suggest alcohol.
- Reminders Tyler wants: 9am weight screenshot, Monday 9am body scan, 8pm macro screenshot.

# HARD RULES (never violate)
1. Actual workout data is IMMUTABLE. A later plan change never overwrites what Tyler already completed.
2. Never invent, estimate, or overwrite the daily calorie target. If it's missing, say so — do not guess.
3. Direct-target set counting only. Bench press credits chest, not triceps. Squats credit quads, not calves.
4. Bicep anatomy: TWO heads (long, short) plus brachialis. Not three heads. Long head = incline DB curl. Short head = preacher/spider. Brachialis = hammer.
5. Never treat a planned workout as completed. Never remove legs from a lifting day just because a later day has legs.
6. Never ask Tyler to restate information already in the persistent record below.
7. If a fact isn't in your context or memory, say "I don't have that yet — can you tell me?" — do NOT confabulate.
8. State whether facts are: verified (from data), inferred (from patterns), or missing.

# STYLE
- Blunt. Direct. Action-oriented. No fluff, no over-encouragement.
- Short paragraphs. Give the answer, then the reasoning.
- If Tyler slacked, call it out. If he crushed it, acknowledge it briefly and push harder.
- Never use emojis unless Tyler uses them first.

# DURABLE MEMORY (facts about Tyler you must never forget)
${memoryBlock}

# LIVE CONTEXT (${ctx.today})
- Active goal: ${ctx.goal ? `${ctx.goal.targetWeight ?? "?"} lb at ${ctx.goal.targetBodyFatPct ?? "?"}% BF by ${ctx.goal.targetDate ?? "?"}` : "NONE SET"}
- Nutrition target: ${ctx.target ? `${ctx.target.calories ?? "UNKNOWN (recover from scan)"} kcal, protein ${ctx.target.proteinGramsMin}-${ctx.target.proteinGramsMax}g, fast ${ctx.target.fastingHoursMin}-${ctx.target.fastingHoursMax}h` : "NONE"}
- Latest body scan: ${ctx.latestScan ? `${ctx.latestScan.date} — ${ctx.latestScan.weight ?? "?"} lb, ${ctx.latestScan.bodyFatPct ?? "?"}% BF (${ctx.latestScan.source ?? "?"})` : "NONE"}
- Today's macros so far: ${ctx.todayMacros ? `${ctx.todayMacros.calories ?? 0} kcal, ${ctx.todayMacros.proteinG ?? 0}g protein` : "not logged yet"}
- Latest recovery: ${ctx.latestRecovery ? `${ctx.latestRecovery.date} — ${ctx.latestRecovery.sleepHours ?? "?"}h sleep, Whoop ${ctx.latestRecovery.whoopRecoveryPct ?? "?"}%, HRV ${ctx.latestRecovery.hrvMs ?? "?"}ms` : "NONE"}
- Today's workout plan: ${ctx.todayPlan ? `${ctx.todayPlan.dayType} — ${(ctx.todayPlan.exercises as any[])?.length ?? 0} exercises` : "NOT GENERATED"}
- Weekly ledger (target ${ctx.settings.weeklySetsPerBodyPart}/wk per part): ${JSON.stringify(ctx.weeklyLedger)}
- Body parts already at or over weekly cap (never add more sets to these): ${Object.entries(ctx.weeklyLedger || {}).filter(([, v]) => (v as number) >= ctx.settings.weeklySetsPerBodyPart).map(([k]) => k).join(", ") || "none"}
- Coach checklist for today: ${ctx.todayChecklist.length} items — ${ctx.todayChecklist.filter(c => c.status === "pending").length} pending

# WHAT YOU CAN DECIDE
If Tyler tells you a new durable fact ("I've been getting shoulder pain on DB press"), you can propose a memoryToAdd decision.
If Tyler asks for a workout, you can propose a workoutPlanToSet decision with structured exercises. RESPECT THE CAP: never include exercises whose direct target is already at ${ctx.settings.weeklySetsPerBodyPart}/wk.
If Tyler wants to talk through a workout before generating, discuss it in prose first. When he's ready, emit workoutPlanToSet.
If Tyler needs accountability, you can propose remindersToSet.

# CRITICAL WORKOUT-PLAN TRIGGERS (emit workoutPlanToSet decision, no exceptions)
You MUST emit a workoutPlanToSet decision whenever ANY of these happen:
1. Tyler shares/uploads/pastes an existing workout program (screenshot, list, notes) AND says anything like "save it", "set it", "use this", "put it in the workout", "add to today", "log this plan", "make this today's workout"
2. Tyler asks you to generate a workout
3. Tyler describes exercises + sets in enough detail that you can structure them ("3 sets bench, 3 sets rows, 3 sets curls") AND says he wants it as his plan
4. Tyler says "today's workout" while sharing exercise details

When you emit workoutPlanToSet, the JSON MUST include: date (today: ${ctx.today}), dayType ("upper" | "lower" | "push" | "pull" | "full" | "custom"), exercises (array of {name, sets, repsMin, repsMax, targetBodyPart, notes?}), and targetSetsByBodyPart (map of body part to sets). Parse Tyler's shared program faithfully — do not invent exercises he didn't mention. If a set count is ambiguous, default to what he wrote.

Return your response as plain conversational text. If you have structured decisions, append them as a JSON code block at the end labelled \`\`\`decisions\n{...}\n\`\`\`.
`;
}

function parseDecisions(text: string): { prose: string; decisions?: any } {
  const match = text.match(/```decisions\s*\n([\s\S]*?)\n```/);
  if (!match) return { prose: text };
  try {
    const decisions = JSON.parse(match[1]);
    const prose = text.slice(0, match.index).trim();
    return { prose, decisions };
  } catch {
    return { prose: text };
  }
}

async function callClaude(
  systemPrompt: string,
  userMessages: { role: string; content: any }[],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in environment");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
      system: systemPrompt,
      messages: userMessages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json() as any;
  const text = data.content?.[0]?.text;
  if (!text) throw new Error(`No text in Anthropic response: ${JSON.stringify(data).slice(0, 500)}`);
  return text;
}

/**
 * Send a message to the coach and get a response.
 * Auto-logs the exchange to coach_conversations.
 * Auto-applies memoryToAdd decisions (they're just user facts).
 * DOES NOT auto-apply workoutPlanToSet — user must confirm via a separate endpoint.
 */
export async function askCoach(
  ctx: CoachContext,
  userMessage: string,
  imageDataUrls?: string[],
): Promise<CoachResponse> {
  const systemPrompt = buildSystemPrompt(ctx);

  // Build recent message history from stored turns
  const history: { role: string; content: any }[] = ctx.recentTurns
    .filter(t => t.role === "user" || t.role === "coach")
    .map(t => ({ role: t.role === "coach" ? "assistant" : "user", content: t.content }));

  // Current user turn — mixed content if one or more images are attached
  const validImages = (imageDataUrls ?? [])
    .map(url => url.match(/^data:(image\/[^;]+);base64,(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null);

  if (validImages.length > 0) {
    const textPart = userMessage.trim() ||
      `I'm sending you ${validImages.length === 1 ? "a screenshot" : `${validImages.length} screenshots`}. Read the data in each one, tell me what type of screenshot it is (MacroFactor, Whoop, body scan, workout log, etc), and extract the numbers. Log what applies (macros → macro_logs, weight/BF% → body_scans, sleep/recovery → recovery_logs). If a body scan has a daily calorie target, tell me the number but do NOT overwrite my current target without confirmation. Be explicit about which values you're recording for today vs. flagging for confirmation.`;
    const content: any[] = validImages.map(m => ({
      type: "image",
      source: { type: "base64", media_type: m[1], data: m[2] },
    }));
    content.push({ type: "text", text: textPart });
    history.push({ role: "user", content });
  } else {
    history.push({ role: "user", content: userMessage });
  }

  // Snapshot the context we're about to reason from (audit trail)
  const contextSnapshot = {
    date: ctx.today,
    goal: ctx.goal,
    target: ctx.target,
    latestScan: ctx.latestScan,
    latestRecovery: ctx.latestRecovery,
    todayMacros: ctx.todayMacros,
    todayPlan: ctx.todayPlan?.dayType,
    weeklyLedger: ctx.weeklyLedger,
    memoryCount: ctx.memory.length,
  };

  // Log user turn first (record image count so we have an audit trail)
  const imgCount = validImages.length;
  await logConversation({
    date: ctx.today,
    role: "user",
    content: imgCount > 0 ? `${userMessage}\n[${imgCount} image${imgCount === 1 ? "" : "s"} attached]` : userMessage,
    contextSnapshot,
    decisions: null as any,
    model: null as any,
  });

  let responseText: string;
  let errorMsg: string | undefined;
  try {
    responseText = await callClaude(systemPrompt, history);
  } catch (err: any) {
    errorMsg = err?.message ?? String(err);
    responseText = `[Coach engine error: ${errorMsg}]\n\nThe coach's memory is intact (${ctx.memory.length} facts recorded) but the model call failed. This usually means ANTHROPIC_API_KEY is not set in Railway environment variables. Set it in Railway → tyler-tracker service → Variables, then redeploy.`;
  }

  const { prose, decisions } = parseDecisions(responseText);

  // Apply auto-decisions: memoryToAdd is trusted (it's user facts)
  if (decisions?.memoryToAdd) {
    for (const m of decisions.memoryToAdd) {
      try {
        await addCoachMemory({ kind: m.kind, fact: m.fact, source: `chat_${ctx.today}`, confidence: "high" });
      } catch (e) { /* ignore memory errors */ }
    }
  }

  // Log coach turn
  await logConversation({
    date: ctx.today,
    role: "coach",
    content: prose,
    contextSnapshot,
    decisions: decisions ?? (null as any),
    model: COACH_MODEL,
  });

  return {
    text: prose,
    decisions,
    contextSnapshot,
    model: COACH_MODEL,
    error: errorMsg,
  };
}

/**
 * Extract structured data from an uploaded screenshot using Claude Vision.
 * `imageDataUrl` must be a data: URL (e.g., data:image/jpeg;base64,...).
 * `kind` tells the coach what shape to extract:
 *   - macros: MacroFactor screenshot => { calories, proteinG, fatG, carbsG, netCarbsG, notes }
 *   - scan: Body scan screenshot => { weight, bodyFatPct, dailyCalorieTarget, source, notes }
 *   - whoop: Whoop screenshot => { sleepHours, whoopRecoveryPct, hrvMs, restingHr, notes }
 *   - weight: Simple scale screenshot => { weight, unit, notes }
 */
export async function extractFromImage(imageDataUrl: string, kind: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY not set" };

  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return { error: "Expected a data: URL image" };
  const mediaType = match[1];
  const b64 = match[2];

  const prompts: Record<string, string> = {
    macros: `Extract these fields from this MacroFactor (or similar macro tracker) screenshot. Return ONLY valid JSON, no prose:
{"calories": <number|null>, "proteinG": <number|null>, "fatG": <number|null>, "carbsG": <number|null>, "netCarbsG": <number|null>, "notes": "<any anomalies>"}`,
    scan: `Extract these fields from this body scan (Renpho, InBody, DEXA, Wyze, etc). Return ONLY valid JSON, no prose:
{"weight": <number|null>, "weightUnit": "lb|kg", "bodyFatPct": <number|null>, "muscleMass": <number|null>, "dailyCalorieTarget": <number|null>, "source": "<brand>", "notes": "<any anomalies>"}`,
    whoop: `Extract these fields from this Whoop screenshot. Return ONLY valid JSON, no prose:
{"sleepHours": <number|null>, "whoopRecoveryPct": <number|null>, "hrvMs": <number|null>, "restingHr": <number|null>, "strain": <number|null>, "notes": "<any anomalies>"}`,
    weight: `Extract the weight from this scale screenshot. Return ONLY valid JSON, no prose:
{"weight": <number|null>, "unit": "lb|kg", "notes": "<any anomalies>"}`,
    workout: `Extract exercises and sets from this workout screenshot. Return ONLY valid JSON, no prose:
{"exercises": [{"name": "...", "sets": <number>, "reps": <string>, "weight": <string>, "targetBodyPart": "chest|back|quads|hamstrings|glutes|front_delts|side_delts|rear_delts|biceps_long|biceps_short|brachialis|triceps|core|calves|forearms|traps|cardio|basketball|none"}]}`,
  };

  const prompt = prompts[kind] ?? prompts.macros;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });

  if (!res.ok) {
    return { error: `Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}` };
  }

  const data = await res.json() as any;
  const text = data.content?.[0]?.text ?? "";
  // Try to parse JSON out of the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { error: "No JSON in response", raw: text.slice(0, 500) };
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { error: "Failed to parse JSON", raw: text.slice(0, 500) };
  }
}

/**
 * Generate a workout for a specific date using coach context.
 * Returns a proposed WorkoutPlan.exercises structure — does NOT save.
 * User must confirm via POST /api/workouts/plan.
 */
export async function generateWorkout(ctx: CoachContext, targetDate: string, dayType: "strength" | "basketball" | "cardio" | "rest" = "strength", cappedBodyParts: string[] = []): Promise<any> {
  const systemPrompt = buildSystemPrompt(ctx);

  const capLine = cappedBodyParts.length > 0
    ? `\n- HARD CAP: DO NOT include ANY exercises targeting these body parts (already at weekly target): ${cappedBodyParts.join(", ")}. If a movement's direct target is capped, do not propose it.`
    : "";

  const userMessage = `Generate a ${dayType} workout for ${targetDate}.

Requirements:
- Target ${ctx.settings.weeklySetsPerBodyPart} sets/body part/week distributed evenly across the training week
- Current weekly ledger: ${JSON.stringify(ctx.weeklyLedger)} — prioritize body parts under quota${capLine}
- Recovery: ${ctx.latestRecovery ? `${ctx.latestRecovery.whoopRecoveryPct}% Whoop, ${ctx.latestRecovery.sleepHours}h sleep` : "unknown — assume moderate"}
- Archetype: dangerous ripped basketball player
- Direct-target credit only (bench = chest, not triceps)

Return ONLY a JSON code block with this exact shape, no prose:
\`\`\`decisions
{
  "workoutPlanToSet": {
    "date": "${targetDate}",
    "dayType": "${dayType}",
    "exercises": [
      {"name": "Smith Machine Shoulder Press", "targetBodyPart": "front_delts", "sets": 4, "repsMin": 8, "repsMax": 12, "notes": "warm up then 3 working sets"}
    ],
    "targetSetsByBodyPart": {"chest": 6, "back": 6, "front_delts": 4}
  }
}
\`\`\``;

  try {
    const responseText = await callClaude(systemPrompt, [{ role: "user", content: userMessage }]);
    const { decisions } = parseDecisions(responseText);
    if (decisions?.workoutPlanToSet) return decisions.workoutPlanToSet;
    return { error: "Coach did not return a structured plan", raw: responseText };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}
