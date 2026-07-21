import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DailyLog, Challenge, BossSeal } from "@shared/schema";
import { hitAllDailyRequired } from "@/lib/challenge";
import { playSound, haptic } from "@/hooks/useSound";
import { Fleuron } from "./Ornament";
import { Confetti } from "./Confetti";
import { XP } from "@/lib/xp";

/**
 * DailyBossVictory — fires the ONCE-A-DAY ceremony when Tyler hits every
 * required-daily habit for today AND today has not been sealed yet.
 *
 * The seal is persisted via /api/boss-seals so the ceremony truly fires only
 * once per real-world day, even across page reloads.
 *
 * The user's language: "sealed" evokes a wax stamp closing the day's ledger.
 */

const seenThisSession = new Set<string>(); // ymds we've already ceremonied

const todayYMD = () => new Date().toISOString().slice(0, 10);

interface Props {
  logs: DailyLog[];
  challenge?: Challenge | null;
}

export function DailyBossVictory({ logs, challenge }: Props) {
  const [showDate, setShowDate] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);

  const { data: seals = [] } = useQuery<BossSeal[]>({ queryKey: ["/api/boss-seals"] });

  const createSeal = useMutation({
    mutationFn: async (payload: { date: string; sealedAt: string; xpAwarded: number }) => {
      return apiRequest("POST", "/api/boss-seals", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boss-seals"] });
    },
  });

  const today = todayYMD();
  const todayLog = useMemo(() => logs.find((l) => l.date === today), [logs, today]);
  const alreadySealed = useMemo(() => seals.some((s) => s.date === today), [seals, today]);

  // Compute the day number relative to the active challenge (fallback: streak from history)
  const dayNumber = useMemo(() => {
    if (challenge?.startDate) {
      // Inclusive day 1
      const s = new Date(challenge.startDate);
      const t = new Date(today);
      const days = Math.floor((t.getTime() - s.getTime()) / 86400000) + 1;
      if (days >= 1) return days;
    }
    // Fallback: index of today's seal + 1
    return seals.length + 1;
  }, [challenge, today, seals]);

  useEffect(() => {
    if (!todayLog) return;
    if (alreadySealed) return;
    if (seenThisSession.has(today)) return;
    const victorious = hitAllDailyRequired(todayLog, challenge ?? null);
    if (!victorious) return;

    seenThisSession.add(today);
    // Persist the seal
    createSeal.mutate({
      date: today,
      sealedAt: new Date().toISOString(),
      xpAwarded: XP.BOSS_SEAL,
    });
    setShowDate(today);
    setConfettiKey((k) => k + 1);
    playSound("bossHorn");
    haptic("heavy");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLog, alreadySealed, challenge, today]);

  if (!showDate) return null;
  return (
    <>
      <Confetti trigger={confettiKey} />
      <div
        className="fixed inset-0 z-[210] flex items-center justify-center cursor-pointer"
        onClick={() => setShowDate(null)}
        role="button"
        tabIndex={0}
        data-testid="boss-victory-overlay"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, hsl(0 55% 14%) 0%, hsl(20 25% 6%) 55%, black 100%)",
        }}
      >
        <div className="relative flex flex-col items-center gap-6 text-center px-8 max-w-[760px] boss-in">
          <div
            className="text-[11px] tracking-[0.5em] uppercase"
            style={{ color: "hsl(38 60% 65%)", fontFamily: "'Inter', sans-serif" }}
          >
            — Daily Boss Vanquished —
          </div>

          {/* Wax seal */}
          <div className="relative animate-wax-stamp" style={{ width: 200, height: 200 }}>
            <svg viewBox="0 0 200 200" width={200} height={200} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="wax-grad" cx="0.35" cy="0.35" r="0.7">
                  <stop offset="0%" stopColor="#c94848" />
                  <stop offset="60%" stopColor="#8a1e1e" />
                  <stop offset="100%" stopColor="#500b0b" />
                </radialGradient>
              </defs>
              {/* Splatter edge */}
              <path
                d="M 100 12
                   C 130 18 156 30 168 52
                   C 188 60 194 82 186 104
                   C 196 128 178 152 152 162
                   C 148 186 122 196 96 188
                   C 74 198 44 184 36 158
                   C 12 152 4 128 16 106
                   C 6 82 22 58 46 50
                   C 54 26 78 12 100 12 Z"
                fill="url(#wax-grad)"
                stroke="#3b0808"
                strokeWidth="2"
              />
              {/* Inner emblem: laurel + numeral */}
              <g transform="translate(100 100)" fill="#f2d38e" opacity="0.92">
                <text
                  x="0"
                  y="10"
                  textAnchor="middle"
                  fontFamily="Cinzel, serif"
                  fontWeight="700"
                  fontSize="38"
                  letterSpacing="2"
                >
                  {dayNumber}
                </text>
                <text
                  x="0"
                  y="34"
                  textAnchor="middle"
                  fontFamily="Cinzel, serif"
                  fontSize="10"
                  letterSpacing="4"
                >
                  SEALED
                </text>
              </g>
            </svg>
          </div>

          <div
            className="serif-hero uppercase leading-none"
            style={{
              fontSize: "clamp(56px, 10vw, 120px)",
              color: "hsl(0 60% 70%)",
              letterSpacing: "0.05em",
              textShadow: "0 0 80px hsl(0 80% 40% / 0.6)",
            }}
          >
            DAY {dayNumber}
          </div>
          <Fleuron size={36} />
          <div
            className="serif uppercase"
            style={{
              fontSize: "clamp(15px, 2vw, 22px)",
              color: "hsl(38 20% 88%)",
              letterSpacing: "0.15em",
              maxWidth: 560,
            }}
          >
            The ledger is closed. The Iron Word stands.
          </div>
          <div className="mt-2 microlabel opacity-70" style={{ letterSpacing: "0.4em" }}>
            +{XP.BOSS_SEAL} XP · tap to continue
          </div>
        </div>
        <style>{`
          @keyframes boss-in {
            0%   { opacity: 0; transform: scale(0.86); filter: blur(6px); }
            100% { opacity: 1; transform: scale(1);    filter: blur(0);   }
          }
          .boss-in { animation: boss-in 900ms ease-out both; }
        `}</style>
      </div>
    </>
  );
}
