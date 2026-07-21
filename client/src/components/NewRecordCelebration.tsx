import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DailyLog, BossSeal, Record_ } from "@shared/schema";
import { HABITS, habitHit, addDays } from "@/lib/analytics";
import { xpBetween } from "@/lib/xp";
import { playSound, haptic } from "@/hooks/useSound";
import { Fleuron } from "./Ornament";

/**
 * NewRecordCelebration — auto-tracks personal records and fires a bright
 * "★ NEW RECORD" overlay whenever a new max is set.
 *
 * Records tracked (all keys must match the server-seeded rows):
 *   best_perfect_streak — max consecutive boss seals
 *   best_week_perfect    — max seals in any Mon-Sun window
 *   longest_sober        — max consecutive days with alcohol=0
 *   best_week_xp         — max XP earned across any 7-day window
 *   most_lifts_week      — max total lifts across any 7-day window
 *   most_habits_day      — max habits hit on any single day
 *
 * How it works:
 *   - Recompute candidate values from logs+seals whenever they change
 *   - For each record where candidate > stored value, PATCH /api/records/:key
 *     with value + setOnDate + seenAt=null → server saves it, and the overlay
 *     fires because seenAt is null.
 *   - User taps to dismiss → we PATCH seenAt = now → overlay hides.
 */

interface Props {
  logs: DailyLog[];
  seals: BossSeal[];
}

// Guard against re-processing the same record within one session
const inFlightForKey = new Set<string>();
// Records that were seeded from 0 in this session — never celebrate these
const seededThisSession = new Set<string>();
// Records that we've fired the celebration for this session — never re-fire
const firedThisSession = new Set<string>();

export function NewRecordCelebration({ logs, seals }: Props) {
  const { data: records = [] } = useQuery<Record_[]>({ queryKey: ["/api/records"] });

  const patchRecord = useMutation({
    mutationFn: async ({ key, patch }: { key: string; patch: Partial<Record_> }) => {
      return apiRequest("PATCH", `/api/records/${key}`, patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/records"] }),
  });

  const today = new Date().toISOString().slice(0, 10);

  // Compute candidates.
  const candidates = useMemo(() => {
    if (!logs.length) return {};

    const sealDates = new Set(seals.map((s) => s.date));
    const logByDate = new Map(logs.map((l) => [l.date, l]));
    const sortedDates = Array.from(new Set(logs.map((l) => l.date))).sort();
    const first = sortedDates[0] ?? today;
    const last = today >= sortedDates[sortedDates.length - 1] ? today : sortedDates[sortedDates.length - 1];

    // best_perfect_streak
    let bestPerfectStreak = 0;
    {
      let cur = first;
      let s = 0;
      let safety = 0;
      while (cur <= last && safety++ < 5000) {
        if (sealDates.has(cur)) {
          s++;
          if (s > bestPerfectStreak) bestPerfectStreak = s;
        } else s = 0;
        cur = addDays(cur, 1);
      }
    }

    // longest_sober — consecutive days with noAlcohol === 1
    let longestSober = 0;
    {
      let s = 0;
      for (const d of sortedDates) {
        const log = logByDate.get(d);
        if ((log?.noAlcohol ?? 0) === 1) {
          s++;
          if (s > longestSober) longestSober = s;
        } else s = 0;
      }
    }

    // most_habits_day
    let mostHabitsDay = 0;
    for (const l of logs) {
      let n = 0;
      for (const h of HABITS) if (habitHit(l, h)) n++;
      if (n > mostHabitsDay) mostHabitsDay = n;
    }

    // Rolling-window (7 days) max for xp, workouts, perfect seals
    let bestWeekXP = 0;
    let bestWeekPerfect = 0;
    let mostLiftsWeek = 0;
    {
      let cur = first;
      let safety = 0;
      while (cur <= last && safety++ < 5000) {
        const from = addDays(cur, -6);
        const xp = xpBetween(logs, from, cur);
        if (xp > bestWeekXP) bestWeekXP = xp;
        // Perfect seals + workouts over window
        let perfect = 0;
        let workouts = 0;
        let d = from;
        let inner = 0;
        while (d <= cur && inner++ < 10) {
          if (sealDates.has(d)) perfect++;
          if ((logByDate.get(d)?.workout ?? 0) === 1) workouts++;
          d = addDays(d, 1);
        }
        if (perfect > bestWeekPerfect) bestWeekPerfect = perfect;
        if (workouts > mostLiftsWeek) mostLiftsWeek = workouts;
        cur = addDays(cur, 1);
      }
    }

    return {
      best_perfect_streak: bestPerfectStreak,
      best_week_perfect: bestWeekPerfect,
      longest_sober: longestSober,
      best_week_xp: bestWeekXP,
      most_lifts_week: mostLiftsWeek,
      most_habits_day: mostHabitsDay,
    } as Record<string, number>;
  }, [logs, seals, today]);

  // Push updates whenever a candidate exceeds the stored value.
  // Only fire the ceremony when the PRIOR value was > 0 (i.e. a genuine
  // improvement). Silently seed the first record without a celebration.
  useEffect(() => {
    for (const rec of records) {
      const cand = candidates[rec.key];
      if (cand == null) continue;
      if (cand > rec.value && !inFlightForKey.has(rec.key)) {
        inFlightForKey.add(rec.key);
        const shouldCelebrate = rec.value > 0; // don't celebrate 0 -> N
        if (!shouldCelebrate) seededThisSession.add(rec.key);
        patchRecord.mutate(
          {
            key: rec.key,
            patch: {
              value: cand,
              setOnDate: today,
              // If prior was 0, mark as already seen so overlay doesn't fire
              seenAt: shouldCelebrate ? null : new Date().toISOString(),
            },
          },
          {
            onSettled: () => {
              inFlightForKey.delete(rec.key);
            },
          },
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, records]);

  // Find an unseen record to celebrate. Skip anything that was seeded
  // (0 -> N) or already fired this session.
  const unseen = records.find(
    (r) =>
      r.seenAt == null &&
      r.value > 0 &&
      !seededThisSession.has(r.key) &&
      !firedThisSession.has(r.key),
  );

  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (unseen && dismissed !== unseen.key) {
      firedThisSession.add(unseen.key);
      playSound("record");
      haptic("success");
    }
  }, [unseen?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unseen || dismissed === unseen.key) return null;

  const onDismiss = () => {
    setDismissed(unseen.key);
    firedThisSession.add(unseen.key);
    patchRecord.mutate({ key: unseen.key, patch: { seenAt: new Date().toISOString() } });
  };

  return (
    <div
      className="fixed inset-0 z-[195] flex items-center justify-center cursor-pointer"
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      data-testid="record-overlay"
      style={{
        background:
          "radial-gradient(circle at 50% 45%, hsl(48 60% 14%) 0%, hsl(30 25% 6%) 55%, black 100%)",
      }}
    >
      <div className="relative flex flex-col items-center gap-5 text-center px-8 max-w-[720px] record-in">
        <div
          className="text-[11px] tracking-[0.5em] uppercase animate-star-burst"
          style={{ color: "hsl(48 80% 70%)", fontFamily: "'Inter', sans-serif" }}
        >
          ★ New Personal Record ★
        </div>
        <div
          className="serif-hero uppercase leading-none"
          style={{
            fontSize: "clamp(56px, 10vw, 130px)",
            color: "hsl(48 80% 65%)",
            letterSpacing: "0.05em",
            textShadow: "0 0 80px hsl(48 80% 40% / 0.6)",
          }}
        >
          {unseen.value.toLocaleString()}
        </div>
        <div
          className="serif uppercase tracking-[0.35em]"
          style={{ color: "hsl(48 30% 90%)", fontSize: "clamp(14px, 1.8vw, 20px)" }}
        >
          {unseen.label} {unseen.unit ? `· ${unseen.unit}` : ""}
        </div>
        <Fleuron size={36} />
        <div className="microlabel opacity-70" style={{ letterSpacing: "0.4em" }}>
          tap to continue
        </div>
      </div>
      <style>{`
        @keyframes record-in {
          0%   { opacity: 0; transform: scale(0.88); filter: blur(6px); }
          100% { opacity: 1; transform: scale(1);    filter: blur(0);   }
        }
        .record-in { animation: record-in 900ms ease-out both; }
      `}</style>
    </div>
  );
}
