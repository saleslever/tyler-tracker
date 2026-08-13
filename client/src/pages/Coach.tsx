/**
 * Coach — OVERVIEW dashboard.
 * Replicates Palette 2 Light "DISCIPLINA / FORTIS CORDE" structure:
 * hero strength score, 7-day trend, score breakdown, training summary,
 * body composition donut, weekly goals, achievements, calendar strip,
 * lifetime stats. Atlas is presented as the OPERATOR card with the video
 * loop, and chat opens as a slide-over drawer. All existing wiring
 * (queries, mutations, decisions, attachments) is preserved.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Send, Paperclip, X, Shield, MessageSquare,
  Dumbbell, Utensils, Moon, Flame, TrendingUp, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import atlasStill from "@/assets/atlas.png";

interface Conversation {
  id: number;
  date: string;
  role: "user" | "coach" | "system";
  content: string;
  model?: string | null;
  createdAt: string;
  decisions?: any;
}

interface CoachContext {
  today: string;
  settings: any;
  goal: any;
  target: any;
  latestScan: any;
  latestRecovery: any;
  todayMacros: any;
  todayPlan: any;
  weeklyLedger: Record<string, number>;
  memory: Array<{ id: number; kind: string; fact: string }>;
  todayChecklist: any[];
}

interface OverviewData {
  today: string;
  strengthScore: {
    composite: number;
    delta: number;
    pillars: { trainingLoad: number; nutrition: number; recovery: number; consistency: number };
  };
  trend: {
    series: { date: string; label: string; score: number }[];
    weeklyAverage: number;
    vsLastWeek: number;
  };
  trainingSummary: { name: string; volume: number; sets: number; intensity: number; personalRecord: number }[];
  bodyComp: { weight: number | null; bodyFatPct: number | null; leanMassPct: number | null; scanDate: string | null };
  weeklyGoals: { label: string; current: number; target: number; icon: string }[];
  achievements: { title: string; sub: string; date: string; kind: string }[];
  calendar: { date: string; day: number; label: string; kind: string; isToday: boolean }[];
  lifetimeStats: { workouts: number; totalVolumeKg: number; longestStreakWeeks: number; avgScore: number };
  target: any;
  goal: any;
  weeklyLedger: Record<string, number>;
}

export default function Coach() {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversationQuery = useQuery<Conversation[]>({
    queryKey: ["/api/coach/conversation"],
  });
  const contextQuery = useQuery<CoachContext>({
    queryKey: ["/api/coach/context"],
    refetchInterval: 60000,
  });
  const overviewQuery = useQuery<OverviewData>({
    queryKey: ["/api/fitness/overview"],
    refetchInterval: 60000,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; imageDataUrls?: string[] }) => {
      const body: any = { message: payload.message };
      if (payload.imageDataUrls && payload.imageDataUrls.length > 0) body.imageDataUrls = payload.imageDataUrls;
      const res = await apiRequest("POST", "/api/coach/chat", body);
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      setImages([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/memory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/overview"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversationQuery.data, chatOpen]);

  function submit() {
    const trimmed = input.trim();
    if (sendMutation.isPending) return;
    if (!trimmed && images.length === 0) return;
    sendMutation.mutate({ message: trimmed, imageDataUrls: images.map(i => i.dataUrl) });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const accepted: { dataUrl: string; name: string }[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 15 * 1024 * 1024) { alert(`${file.name} is over 15MB, skipping.`); continue; }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const r = reader.result; if (typeof r === "string") resolve(r); else reject(new Error("read failed")); };
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      accepted.push({ dataUrl, name: file.name });
    }
    if (accepted.length > 0) setImages(prev => [...prev, ...accepted]);
  }

  function removeImage(idx: number) { setImages(prev => prev.filter((_, i) => i !== idx)); }

  const ctx = contextQuery.data;
  const ov = overviewQuery.data;
  const messages = conversationQuery.data ?? [];
  const isThinking = sendMutation.isPending;

  // Loading skeleton
  if (!ov) {
    return (
      <div className="parchment min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const maxTrend = Math.max(...ov.trend.series.map(s => s.score), 1);
  const minTrend = Math.min(...ov.trend.series.map(s => s.score), 0);
  const trendRange = Math.max(maxTrend - minTrend, 1);

  return (
    <div className="parchment min-h-screen">
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8">

        {/* ───────── Header ───────── */}
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-5xl font-black tracking-tight leading-none">OVERVIEW</h1>
            <p className="mt-3 text-xs tracking-[0.24em] uppercase text-primary font-medium">
              All that stands between you and greatness is discipline.
            </p>
            <div className="mt-4 h-px w-64 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="ornament-panel !py-2 !px-4 flex items-center gap-2 hover:bg-primary/5 transition text-sm font-display tracking-widest uppercase"
            data-testid="button-open-atlas"
          >
            <Shield className="w-4 h-4 text-primary" />
            Atlas
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </button>
        </header>

        {/* ───────── Main grid ───────── */}
        <div className="grid grid-cols-12 gap-6">

          {/* LEFT + CENTER: Score + Trend row */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            {/* Hero score + 7-day trend */}
            <div className="grid grid-cols-12 gap-6">
              {/* Today's Strength Score */}
              <div className="col-span-12 md:col-span-7 ornament-panel">
                <div className="section-title mb-6">Today's Strength Score</div>
                <div className="flex items-center justify-center gap-4">
                  <LaurelSVG side="left" />
                  <div className="hero-numeral" data-testid="text-strength-score">{ov.strengthScore.composite}</div>
                  <LaurelSVG side="right" />
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <span className={cn("font-mono font-bold", ov.strengthScore.delta >= 0 ? "text-primary" : "text-muted-foreground")}>
                    {ov.strengthScore.delta >= 0 ? "▲" : "▼"} {Math.abs(ov.strengthScore.delta)}
                  </span>
                  <span className="text-xs tracking-widest uppercase text-muted-foreground">vs Yesterday</span>
                </div>

                {/* Score Breakdown */}
                <div className="mt-8 border border-card-border rounded p-4">
                  <div className="text-[10px] tracking-[0.24em] uppercase text-center text-accent mb-4">Score Breakdown</div>
                  <div className="grid grid-cols-4 gap-3">
                    <PillarStat label="Training Load" value={ov.strengthScore.pillars.trainingLoad} />
                    <PillarStat label="Nutrition" value={ov.strengthScore.pillars.nutrition} />
                    <PillarStat label="Recovery" value={ov.strengthScore.pillars.recovery} />
                    <PillarStat label="Consistency" value={ov.strengthScore.pillars.consistency} />
                  </div>
                </div>
              </div>

              {/* 7 Day Trend */}
              <div className="col-span-12 md:col-span-5 ornament-panel">
                <div className="section-title mb-6">7 Day Trend</div>
                <TrendChart series={ov.trend.series} minTrend={minTrend} trendRange={trendRange} />
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-card-border pt-4">
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Weekly Average</div>
                    <div className="font-display text-3xl font-bold mt-1" data-testid="text-weekly-avg">{ov.trend.weeklyAverage}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-muted-foreground">vs Last Week</div>
                    <div className={cn("font-display text-3xl font-bold mt-1 flex items-center gap-1", ov.trend.vsLastWeek >= 0 ? "text-primary" : "text-muted-foreground")}>
                      {ov.trend.vsLastWeek >= 0 ? "▲" : "▼"} {Math.abs(ov.trend.vsLastWeek)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Training Summary + Body Composition */}
            <div className="grid grid-cols-12 gap-6">
              {/* Training Summary */}
              <div className="col-span-12 md:col-span-7 ornament-panel">
                <div className="section-title mb-6">
                  <Dumbbell className="w-3 h-3" />
                  Training Summary
                </div>
                {ov.trainingSummary.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground italic">
                    No sets logged in the last 30 days
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground border-b border-card-border">
                        <th className="text-left py-2 font-medium">Exercise</th>
                        <th className="text-left py-2 font-medium">Volume</th>
                        <th className="text-left py-2 font-medium">Intensity</th>
                        <th className="text-right py-2 font-medium">PR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ov.trainingSummary.map((ex) => (
                        <tr key={ex.name} className="border-b border-card-border/50 last:border-0">
                          <td className="py-3 font-display font-medium tracking-wider text-xs uppercase" data-testid={`text-exercise-${ex.name}`}>{ex.name}</td>
                          <td className="py-3 font-mono text-xs">{ex.volume.toLocaleString()} lb</td>
                          <td className="py-3">
                            <div className="intensity-dots">
                              {[1,2,3,4,5].map(n => (
                                <div key={n} className={cn("intensity-dot", n <= ex.intensity && "on")} />
                              ))}
                            </div>
                          </td>
                          <td className="py-3 text-right font-mono text-xs font-bold">{ex.personalRecord} lb</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Body Composition */}
              <div className="col-span-12 md:col-span-5 ornament-panel">
                <div className="section-title mb-6">Body Composition</div>
                <BodyCompDonut bodyComp={ov.bodyComp} />
              </div>
            </div>

            {/* Operator card + calendar strip + lifetime stats */}
            <div className="grid grid-cols-12 gap-6">
              {/* OPERATOR (Atlas) */}
              <div className="col-span-12 md:col-span-4 ornament-panel">
                <div className="section-title mb-4">Operator</div>
                <div className="relative flex flex-col items-center">
                  <button
                    onClick={() => setChatOpen(true)}
                    className="atlas-frame w-32 h-32 rounded-full overflow-hidden border-2 border-primary/40 hover:border-primary transition"
                    data-testid="button-atlas-avatar"
                    data-thinking={isThinking ? "true" : "false"}
                  >
                    <video autoPlay loop muted playsInline className="w-full h-full object-cover" poster={atlasStill}>
                      <source src="/atlas-loop.mp4" type="video/mp4" />
                    </video>
                  </button>
                  <div className="mt-4 text-center">
                    <div className="font-display text-lg font-bold tracking-widest">ATLAS</div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-1">Command · Ready</div>
                  </div>
                  <button
                    onClick={() => setChatOpen(true)}
                    className="mt-4 flex items-center gap-2 text-xs font-display tracking-widest uppercase text-primary hover:underline"
                    data-testid="button-hail-atlas"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Hail Atlas
                  </button>
                </div>
              </div>

              {/* Calendar strip */}
              <div className="col-span-12 md:col-span-4 ornament-panel">
                <div className="section-title mb-4">Calendar</div>
                <div className="flex justify-between">
                  {ov.calendar.map((c) => (
                    <div key={c.date} className={cn("cal-day", c.isToday && "today")}>
                      <div className="text-[9px] tracking-widest text-muted-foreground">{c.label}</div>
                      <div className={cn("text-lg font-bold", c.isToday && "text-primary")}>{c.day}</div>
                      <CalendarIcon kind={c.kind} isToday={c.isToday} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Lifetime Stats */}
              <div className="col-span-12 md:col-span-4 ornament-panel">
                <div className="section-title mb-4">Lifetime Statistics</div>
                <div className="grid grid-cols-2 gap-4">
                  <LifetimeStat label="Workouts" value={ov.lifetimeStats.workouts.toString()} />
                  <LifetimeStat label="Total Volume" value={`${(ov.lifetimeStats.totalVolumeKg/1000).toFixed(1)}M KG`} />
                  <LifetimeStat label="Longest Streak" value={`${ov.lifetimeStats.longestStreakWeeks} WKS`} />
                  <LifetimeStat label="Avg Score" value={ov.lifetimeStats.avgScore.toString()} />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT RAIL: Weekly Goals + Achievements */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="ornament-panel">
              <div className="section-title mb-6">Weekly Goals</div>
              <div className="space-y-5">
                {ov.weeklyGoals.map((g) => (
                  <div key={g.label} className="flex items-center gap-3" data-testid={`goal-${g.label}`}>
                    <GoalIcon kind={g.icon} />
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <div className="text-[10px] tracking-[0.2em] uppercase font-display font-medium">{g.label}</div>
                        <div className="text-xs font-mono font-bold">{g.current}/{g.target}</div>
                      </div>
                      <div className="goal-bar">
                        <div className="goal-bar-fill" style={{ width: `${Math.min(100, (g.current / g.target) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ornament-panel">
              <div className="section-title mb-6">Achievements</div>
              {ov.achievements.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  Keep grinding. Achievements unlock as you rack up wins.
                </div>
              ) : (
                <div className="space-y-4">
                  {ov.achievements.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-3" data-testid={`achievement-${a.title}`}>
                      <AchievementIcon kind={a.kind} />
                      <div className="flex-1">
                        <div className="font-display font-bold text-sm tracking-wider text-primary">{a.title}</div>
                        <div className="text-xs text-foreground mt-0.5">{a.sub}</div>
                        <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1">{formatDate(a.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-center py-4">
              <div className="font-display text-lg font-black tracking-widest">DISCIPLINE</div>
              <div className="font-display text-lg font-black tracking-widest text-primary">EQUALS FREEDOM.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Atlas chat drawer ───────── */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        input={input}
        setInput={setInput}
        images={images}
        setImages={setImages}
        submit={submit}
        isThinking={isThinking}
        scrollRef={scrollRef}
        fileInputRef={fileInputRef}
        handleFiles={handleFiles}
        removeImage={removeImage}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function LaurelSVG({ side }: { side: "left" | "right" }) {
  return (
    <svg className={side === "left" ? "laurel-left" : "laurel-right"} viewBox="0 0 60 120" fill="none" stroke="currentColor" strokeWidth="1.5">
      {side === "left" ? (
        <>
          <path d="M55 60 Q30 60 15 30" strokeLinecap="round" />
          <path d="M55 60 Q30 60 15 90" strokeLinecap="round" />
          <ellipse cx="20" cy="35" rx="6" ry="10" transform="rotate(-30 20 35)" fill="currentColor" opacity="0.6" />
          <ellipse cx="28" cy="45" rx="6" ry="10" transform="rotate(-20 28 45)" fill="currentColor" opacity="0.6" />
          <ellipse cx="38" cy="55" rx="6" ry="10" transform="rotate(-10 38 55)" fill="currentColor" opacity="0.6" />
          <ellipse cx="20" cy="85" rx="6" ry="10" transform="rotate(30 20 85)" fill="currentColor" opacity="0.6" />
          <ellipse cx="28" cy="75" rx="6" ry="10" transform="rotate(20 28 75)" fill="currentColor" opacity="0.6" />
          <ellipse cx="38" cy="65" rx="6" ry="10" transform="rotate(10 38 65)" fill="currentColor" opacity="0.6" />
        </>
      ) : (
        <>
          <path d="M5 60 Q30 60 45 30" strokeLinecap="round" />
          <path d="M5 60 Q30 60 45 90" strokeLinecap="round" />
          <ellipse cx="40" cy="35" rx="6" ry="10" transform="rotate(30 40 35)" fill="currentColor" opacity="0.6" />
          <ellipse cx="32" cy="45" rx="6" ry="10" transform="rotate(20 32 45)" fill="currentColor" opacity="0.6" />
          <ellipse cx="22" cy="55" rx="6" ry="10" transform="rotate(10 22 55)" fill="currentColor" opacity="0.6" />
          <ellipse cx="40" cy="85" rx="6" ry="10" transform="rotate(-30 40 85)" fill="currentColor" opacity="0.6" />
          <ellipse cx="32" cy="75" rx="6" ry="10" transform="rotate(-20 32 75)" fill="currentColor" opacity="0.6" />
          <ellipse cx="22" cy="65" rx="6" ry="10" transform="rotate(-10 22 65)" fill="currentColor" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

function PillarStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</div>
      <div className="font-display font-black text-2xl text-primary">{value.toFixed(1)}</div>
    </div>
  );
}

function TrendChart({ series, minTrend, trendRange }: { series: { label: string; score: number }[]; minTrend: number; trendRange: number }) {
  const W = 300, H = 140, PAD = 16;
  const chartW = W - PAD * 2, chartH = H - PAD * 2;
  const pts = series.map((s, i) => {
    const x = PAD + (i / Math.max(series.length - 1, 1)) * chartW;
    const y = PAD + chartH - ((s.score - minTrend) / trendRange) * chartH;
    return { x, y, ...s };
  });
  const path = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const yTicks = 3;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => Math.round(minTrend + (trendRange * (yTicks - 1 - i)) / (yTicks - 1)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
      {/* y-axis ticks */}
      {yTickValues.map((v, i) => {
        const y = PAD + (i / (yTicks - 1)) * chartH;
        return (
          <g key={i}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
            <text x={0} y={y + 3} fontSize="8" fill="currentColor" fillOpacity="0.5" fontFamily="var(--font-mono)">{v}</text>
          </g>
        );
      })}
      {/* trend line */}
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* points */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />
      ))}
      {/* x-axis labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 2} fontSize="8" fill="currentColor" fillOpacity="0.5" textAnchor="middle" letterSpacing="1">{p.label}</text>
      ))}
    </svg>
  );
}

function BodyCompDonut({ bodyComp }: { bodyComp: any }) {
  if (bodyComp.weight == null || bodyComp.bodyFatPct == null) {
    return (
      <div className="py-8 text-center">
        <div className="text-sm text-muted-foreground italic mb-2">No scan on record</div>
        <div className="text-xs text-muted-foreground">Upload a body scan to see composition</div>
      </div>
    );
  }
  const bf = bodyComp.bodyFatPct;
  const lean = bodyComp.leanMassPct;
  const water = bodyComp.waterPct ?? Math.max(0, 100 - bf - lean); // fallback

  const R = 45, C = 2 * Math.PI * R;
  const bfArc = (bf / 100) * C;
  const leanArc = (lean / 100) * C;

  return (
    <div>
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 120 120" className="w-40 h-40">
          {/* background ring */}
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="12" />
          {/* lean mass arc — bronze */}
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="hsl(var(--accent))" strokeWidth="12"
            strokeDasharray={`${leanArc} ${C}`}
            transform="rotate(-90 60 60)"
            strokeLinecap="butt"
          />
          {/* body fat arc — red */}
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="hsl(var(--primary))" strokeWidth="12"
            strokeDasharray={`${bfArc} ${C}`}
            strokeDashoffset={`-${leanArc}`}
            transform="rotate(-90 60 60)"
            strokeLinecap="butt"
          />
          {/* center laurel */}
          <text x="60" y="66" fontSize="18" textAnchor="middle" fill="hsl(var(--accent))" fontFamily="var(--font-display)" fontWeight="900">Ω</text>
        </svg>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Lean</span>
          </div>
          <div className="font-mono text-sm font-bold mt-1">{lean?.toFixed(1)}%</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Fat</span>
          </div>
          <div className="font-mono text-sm font-bold mt-1">{bf?.toFixed(1)}%</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-foreground/30" />
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground">Weight</span>
          </div>
          <div className="font-mono text-sm font-bold mt-1">{bodyComp.weight?.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}

function GoalIcon({ kind }: { kind: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    helmet: <Shield className="w-4 h-4" />,
    wreath: <Award className="w-4 h-4" />,
    bowl: <Utensils className="w-4 h-4" />,
    moon: <Moon className="w-4 h-4" />,
  };
  return (
    <div className="w-9 h-9 rounded-full border border-primary/40 flex items-center justify-center text-primary bg-primary/5 flex-shrink-0">
      {iconMap[kind] ?? <Flame className="w-4 h-4" />}
    </div>
  );
}

function AchievementIcon({ kind }: { kind: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    discipline: <Shield className="w-5 h-5" />,
    pr: <TrendingUp className="w-5 h-5" />,
    consistency: <Award className="w-5 h-5" />,
  };
  return (
    <div className="w-10 h-10 rounded border border-accent/50 flex items-center justify-center text-accent bg-accent/5 flex-shrink-0">
      {iconMap[kind] ?? <Flame className="w-5 h-5" />}
    </div>
  );
}

function CalendarIcon({ kind, isToday }: { kind: string; isToday: boolean }) {
  const color = isToday ? "text-primary" : kind === "training" ? "text-primary" : kind === "nutrition" ? "text-accent" : "text-muted-foreground/40";
  const map: Record<string, React.ReactNode> = {
    training: <Dumbbell className={cn("w-3.5 h-3.5", color)} />,
    nutrition: <Utensils className={cn("w-3.5 h-3.5", color)} />,
    rest: <Moon className={cn("w-3.5 h-3.5", color)} />,
  };
  return <>{map[kind] ?? map.rest}</>;
}

function LifetimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">{label}</div>
      <div className="font-display font-black text-xl">{value}</div>
    </div>
  );
}

function formatDate(date: string): string {
  try {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  } catch { return date; }
}

// ─────────────────────────────────────────────────────────────
// Chat Drawer
// ─────────────────────────────────────────────────────────────
function ChatDrawer(props: {
  open: boolean; onClose: () => void; messages: Conversation[];
  input: string; setInput: (s: string) => void;
  images: { dataUrl: string; name: string }[]; setImages: (fn: any) => void;
  submit: () => void; isThinking: boolean;
  scrollRef: React.RefObject<HTMLDivElement>; fileInputRef: React.RefObject<HTMLInputElement>;
  handleFiles: (fl: FileList | null) => Promise<void>; removeImage: (i: number) => void;
}) {
  const {
    open, onClose, messages, input, setInput, images,
    submit, isThinking, scrollRef, fileInputRef, handleFiles, removeImage,
  } = props;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative parchment w-full max-w-lg h-full flex flex-col border-l border-card-border shadow-2xl">
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-card-border">
            <div className="flex items-center gap-3">
              <div className="atlas-frame w-10 h-10 rounded-full overflow-hidden border-2 border-primary/40" data-thinking={isThinking ? "true" : "false"}>
                <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                  <source src="/atlas-loop.mp4" type="video/mp4" />
                </video>
              </div>
              <div>
                <div className="font-display font-bold tracking-widest">ATLAS</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  {isThinking ? "Analyzing..." : "Command · Ready"}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded hover:bg-primary/5" data-testid="button-close-chat">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="font-display text-xs tracking-widest uppercase text-muted-foreground">
                  Speak, warrior. Atlas is listening.
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-card-border text-foreground"
                )}>
                  <div className="text-[9px] tracking-widest uppercase mb-1 opacity-60 font-display">
                    {m.role === "user" ? "You" : "Atlas"}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-card border border-card-border rounded px-3 py-2 flex items-center gap-2 text-sm">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs tracking-widest uppercase text-muted-foreground">Atlas analyzing</span>
                </div>
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div className="px-4 py-2 border-t border-card-border flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={img.dataUrl} className="w-16 h-16 object-cover rounded border border-card-border" alt={img.name} />
                  <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-card-border flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} data-testid="button-attach">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Speak to Atlas..."
              className="flex-1 min-h-[44px] max-h-32 resize-none"
              data-testid="input-message"
            />
            <Button onClick={submit} disabled={isThinking} size="icon" data-testid="button-send">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
