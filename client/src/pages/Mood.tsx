import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MoodLog } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Fleuron } from "@/components/Ornament";
import { playSound, haptic } from "@/hooks/useSound";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

/**
 * Mood tracker.
 *
 * Every tap on a 1-10 button inserts a mood_log row with the value + a fresh
 * timestamp. The rolling chart shows every check-in across the selected window
 * so weight-loss / sleep / sobriety impact becomes visible over time.
 */

const RANGES = [
  { label: "24H", days: 1 },
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "All", days: 3650 },
];

/**
 * Mood scale visual language.
 *   1-3  : deep red — depression / rock bottom
 *   4-5  : slate — flat / muted
 *   6-7  : bronze — steady / good
 *   8-10 : gold — high energy / peak
 */
function colorForValue(v: number): string {
  if (v <= 3) return "#c94848";
  if (v <= 5) return "#8a8578";
  if (v <= 7) return "#c9995a";
  return "#e0b74f";
}

function labelForValue(v: number): string {
  if (v <= 2) return "Rock bottom";
  if (v <= 4) return "Low";
  if (v <= 6) return "Steady";
  if (v <= 8) return "Strong";
  return "Peak";
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function MoodPage() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [note, setNote] = useState("");
  const range = RANGES[rangeIdx];

  const { data: moods = [] } = useQuery<MoodLog[]>({ queryKey: ["/api/moods"] });

  const createMood = useMutation({
    mutationFn: async (payload: { value: number; note?: string }) =>
      apiRequest("POST", "/api/moods", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/moods"] }),
  });

  const deleteMood = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/moods/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/moods"] }),
  });

  const handleLog = (value: number) => {
    playSound(value >= 8 ? "sparkle" : value <= 3 ? "tick" : "check");
    haptic(value >= 8 ? "success" : "medium");
    createMood.mutate({ value, note: note.trim() || undefined });
    setNote("");
  };

  // ---------------- Chart data ----------------
  const chartData = useMemo(() => {
    const cutoff = Date.now() - range.days * 24 * 60 * 60 * 1000;
    return [...moods]
      .filter((m) => new Date(m.loggedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
      .map((m) => ({
        t: new Date(m.loggedAt).getTime(),
        value: m.value,
        ts: m.loggedAt,
      }));
  }, [moods, range.days]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
    const vals = chartData.map((d) => d.value);
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      avg: sum / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
    };
  }, [chartData]);

  const recent = useMemo(() => moods.slice(0, 15), [moods]);

  // Format X-axis based on range width
  const xTickFormatter = (t: number) => {
    const d = new Date(t);
    if (range.days <= 1) return d.toLocaleTimeString(undefined, { hour: "numeric" });
    if (range.days <= 7) return d.toLocaleDateString(undefined, { weekday: "short" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <PageHeader
        title="Mood"
        subtitle="Tap a number. Every check-in is stamped and charted so the ups and downs are impossible to hide."
      />

      {/* --------------- The 1-10 button strip --------------- */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs tracking-[0.3em] uppercase opacity-60" style={{ fontFamily: "'Inter', sans-serif" }}>
            How are you right now?
          </div>
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-50" style={{ fontFamily: "'Inter', sans-serif" }}>
            1 · Rock Bottom &nbsp;·&nbsp; 10 · Peak
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10" data-testid="mood-buttons">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
            const color = colorForValue(v);
            return (
              <button
                key={v}
                onClick={() => handleLog(v)}
                disabled={createMood.isPending}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center rounded-sm border-2 transition-all active:scale-95",
                  "hover:brightness-125 hover:shadow-[0_0_20px_rgba(224,183,79,0.35)]",
                )}
                style={{
                  borderColor: `${color}88`,
                  background: `linear-gradient(160deg, ${color}18 0%, #0a0908 100%)`,
                }}
                data-testid={`mood-button-${v}`}
                aria-label={`Log mood ${v} out of 10 — ${labelForValue(v)}`}
              >
                <div
                  className="num-display text-3xl leading-none"
                  style={{ color }}
                >
                  {v}
                </div>
                <div
                  className="mt-1 text-[9px] uppercase tracking-[0.2em] opacity-70"
                  style={{ fontFamily: "'Inter', sans-serif", color }}
                >
                  {labelForValue(v)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Optional note */}
        <div className="mt-4">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note — what's going on? (attached to next tap)"
            className="w-full rounded-sm border border-[#2a2a2a] bg-[#0a0908] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#e0b74f]"
            data-testid="input-mood-note"
            style={{ fontFamily: "'Inter', sans-serif" }}
          />
        </div>
      </section>

      {/* --------------- Rolling chart --------------- */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="serif-hero uppercase text-xl tracking-[0.08em]">Rolling Chart</h2>
          <div className="flex gap-1" data-testid="mood-range-tabs">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className={cn(
                  "rounded-sm border px-3 py-1 text-[10px] uppercase tracking-[0.25em] transition-colors",
                  rangeIdx === i
                    ? "border-[#e0b74f] text-[#e0b74f]"
                    : "border-[#2a2a2a] opacity-60 hover:opacity-100",
                )}
                style={{ fontFamily: "'Inter', sans-serif" }}
                data-testid={`mood-range-${r.label}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <MoodStat label="Check-ins" value={stats.count} />
          <MoodStat label="Average" value={stats.avg ? stats.avg.toFixed(1) : "—"} accent={stats.avg ? colorForValue(Math.round(stats.avg)) : undefined} />
          <MoodStat label="Low" value={stats.min || "—"} accent={stats.min ? colorForValue(stats.min) : undefined} />
          <MoodStat label="High" value={stats.max || "—"} accent={stats.max ? colorForValue(stats.max) : undefined} />
        </div>

        <div
          className="rounded-sm border border-[#2a2a2a] bg-[#0a0908] p-4"
          style={{ height: 360 }}
          data-testid="mood-chart"
        >
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center opacity-60 serif italic">
              No check-ins in this window yet. Tap a number above to start the chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e0b74f" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#e0b74f" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e1e1e" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={xTickFormatter}
                  stroke="#4a4a4a"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 10]}
                  ticks={[1, 3, 5, 7, 10]}
                  stroke="#4a4a4a"
                  fontSize={11}
                  tickLine={false}
                  width={30}
                />
                <ReferenceLine y={5} stroke="#3a3a3a" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #2a2a2a",
                    borderRadius: 2,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                  }}
                  labelFormatter={(t: number) => new Date(t).toLocaleString()}
                  formatter={(v: number) => [`${v} · ${labelForValue(v)}`, "Mood"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#e0b74f"
                  strokeWidth={2}
                  fill="url(#moodFill)"
                  dot={{ r: 3, fill: "#e0b74f", stroke: "#0a0908", strokeWidth: 1 }}
                  activeDot={{ r: 5, fill: "#e0b74f", stroke: "#0a0908", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* --------------- Recent entries --------------- */}
      <section className="mt-12">
        <h2 className="serif-hero uppercase text-xl tracking-[0.08em] mb-4">Recent Check-Ins</h2>
        {recent.length === 0 ? (
          <div className="rounded-sm border border-dashed border-[#333] py-10 text-center text-sm opacity-60 serif italic">
            No mood logs yet.
          </div>
        ) : (
          <div className="rounded-sm border border-[#2a2a2a] divide-y divide-[#1a1a1a]" data-testid="mood-list">
            {recent.map((m) => {
              const color = colorForValue(m.value);
              return (
                <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border font-bold"
                    style={{
                      borderColor: color,
                      color,
                      background: "#0a0908",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {m.value}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm" style={{ color, fontFamily: "'Inter', sans-serif" }}>
                      {labelForValue(m.value)}
                    </div>
                    <div className="text-[11px] opacity-60" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {formatDateTime(m.loggedAt)}
                    </div>
                    {m.note && (
                      <div className="mt-1 text-xs opacity-80 serif italic truncate">
                        "{m.note}"
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMood.mutate(m.id)}
                    className="rounded-sm p-2 opacity-40 transition-opacity hover:opacity-100 hover:text-[#c94848]"
                    aria-label="Delete this mood log"
                    data-testid={`button-delete-mood-${m.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-16 flex justify-center opacity-40">
        <Fleuron size={32} />
      </div>
    </div>
  );
}

function MoodStat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-sm border border-[#2a2a2a] bg-[#0a0908] px-4 py-3">
      <div className="microlabel">{label}</div>
      <div
        className="num-display text-2xl leading-none mt-1.5"
        style={{ color: accent ?? "#e5e5e5" }}
      >
        {value}
      </div>
    </div>
  );
}
