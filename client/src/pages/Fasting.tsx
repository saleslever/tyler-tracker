import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Fast } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Flame, Plus, Trash2, Utensils, Timer, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/* ============ Body-state stages ============
   Roughly aligned with the intermittent-fasting literature Zero/Fastic use:
   0h-4h    Fed
   4h-12h   Anabolic (post-absorptive)
   12h-16h  Catabolic (blood-sugar drops, glycogen shrinks)
   16h-24h  Fat burn / early ketosis
   24h-48h  Deep ketosis / autophagy
================================================ */
const STAGES = [
  { hours: 0,  label: "Fed",           icon: "🍽",  color: "hsl(30 25% 55%)" },
  { hours: 4,  label: "Anabolic",      icon: "⚙️",  color: "hsl(38 70% 60%)" },
  { hours: 12, label: "Catabolic",     icon: "🔥",  color: "hsl(20 75% 58%)" },
  { hours: 16, label: "Fat Burn",      icon: "⚡",  color: "hsl(45 90% 60%)" },
  { hours: 18, label: "Ketosis",       icon: "🧠",  color: "hsl(48 95% 62%)" },
  { hours: 24, label: "Deep Ketosis",  icon: "💎",  color: "hsl(180 45% 60%)" },
  { hours: 36, label: "Autophagy",     icon: "🩸",  color: "hsl(300 40% 60%)" },
];

function currentStage(hours: number) {
  let stage = STAGES[0];
  for (const s of STAGES) if (hours >= s.hours) stage = s;
  return stage;
}

function fmtElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** ISO string → local "Sun, 6:47 AM" style label */
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** ISO → "YYYY-MM-DDTHH:MM" for datetime-local <input> */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

const GOAL_PRESETS = [13, 14, 16, 18, 20, 24];

export default function Fasting() {
  const { toast } = useToast();
  const { data: active } = useQuery<Fast | null>({ queryKey: ["/api/fasts/active"] });
  const { data: all = [] } = useQuery<Fast[]>({ queryKey: ["/api/fasts"] });

  // Force re-render every second while a fast is active so the timer ticks
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [startEditOpen, setStartEditOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [pendingGoal, setPendingGoal] = useState(18);

  // Derived state
  const elapsed = active ? now - new Date(active.startedAt).getTime() : 0;
  const elapsedHours = elapsed / 3600000;
  const goalHours = active?.goalHours ?? 18;
  const pct = active ? Math.min(1, elapsedHours / goalHours) : 0;
  const stage = currentStage(elapsedHours);

  const closed = useMemo(() => all.filter((f) => f.endedAt), [all]);
  const stats = useMemo(() => {
    if (closed.length === 0) return null;
    const durs = closed.map((f) => (new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime()) / 3600000);
    const total = durs.reduce((a, b) => a + b, 0);
    const avg = total / durs.length;
    const longest = Math.max(...durs);
    const shortest = Math.min(...durs);
    return { count: durs.length, total, avg, longest, shortest };
  }, [closed]);

  async function startFast(goal: number) {
    setBusy(true);
    try {
      await apiRequest("POST", "/api/fasts/start", { goalHours: goal });
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts/active"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts"] });
      setGoalPickerOpen(false);
    } catch (e) {
      toast({ title: "Could not start fast", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function endFast() {
    if (!active) return;
    if (!confirm(`End this fast? You're at ${fmtDuration(elapsedHours)}.`)) return;
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/fasts/${active.id}/end`, {});
      const closedFast = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts/active"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      const dur = (new Date(closedFast.endedAt).getTime() - new Date(closedFast.startedAt).getTime()) / 3600000;
      toast({ title: `Fast complete — ${fmtDuration(dur)}`, description: "Logged to today." });
    } catch (e) {
      toast({ title: "Could not end fast", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function editStart(newLocal: string) {
    if (!active) return;
    setBusy(true);
    try {
      await apiRequest("PATCH", `/api/fasts/${active.id}`, { startedAt: localInputToIso(newLocal) });
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts/active"] });
      setStartEditOpen(false);
    } catch (e) {
      toast({ title: "Could not update start time", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function editGoal(g: number) {
    if (!active) return;
    setBusy(true);
    try {
      await apiRequest("PATCH", `/api/fasts/${active.id}`, { goalHours: g });
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts/active"] });
      setGoalPickerOpen(false);
    } catch (e) {
      toast({ title: "Could not update goal", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function deleteFast(id: number) {
    if (!confirm("Delete this fast? This can't be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/fasts/${id}`, undefined);
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    } catch (e) {
      toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4 md:mb-6">
        <div>
          <div className="microlabel">Discipline · Growth · Legacy</div>
          <div className="serif text-2xl md:text-3xl mt-1" style={{ fontWeight: 700 }}>Fasting</div>
        </div>
        <button
          onClick={() => setManualOpen(true)}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:border-foreground/60 rounded px-3 py-2 flex items-center gap-1.5 transition-colors"
          data-testid="btn-manual-fast"
        >
          <Plus className="w-3.5 h-3.5" /> Log past fast
        </button>
      </div>

      {/* ============ Timer Ring ============ */}
      <div className="card-lux relative overflow-hidden">
        <div className="p-6 md:p-10 flex flex-col items-center">
          <TimerRing
            pct={pct}
            elapsedMs={elapsed}
            stage={stage}
            active={!!active}
            goalHours={goalHours}
          />

          {/* Started / Goal row */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-8">
            <div className="text-center">
              <div className="microlabel opacity-70">Started</div>
              <div className="mt-1 font-semibold text-sm md:text-base" style={{ letterSpacing: "0.02em" }} data-testid="text-started">
                {active ? fmtWhen(active.startedAt) : "—"}
              </div>
              {active && (
                <button
                  onClick={() => setStartEditOpen(true)}
                  className="mt-1 text-[10px] uppercase tracking-widest text-[#B08D57] hover:underline"
                  data-testid="btn-edit-start"
                >
                  Edit start
                </button>
              )}
            </div>
            <div className="text-center">
              <div className="microlabel opacity-70">Goal</div>
              <div className="mt-1 font-semibold text-sm md:text-base" style={{ letterSpacing: "0.02em" }} data-testid="text-goal">
                {active
                  ? fmtWhen(new Date(new Date(active.startedAt).getTime() + goalHours * 3600000).toISOString())
                  : `${goalHours}h`}
              </div>
              {active && (
                <button
                  onClick={() => { setPendingGoal(goalHours); setGoalPickerOpen(true); }}
                  className="mt-1 text-[10px] uppercase tracking-widest text-[#B08D57] hover:underline"
                  data-testid="btn-edit-goal"
                >
                  Edit {goalHours}h goal
                </button>
              )}
            </div>
          </div>

          {/* Big action button */}
          <div className="mt-8 w-full max-w-md">
            {active ? (
              <button
                onClick={endFast}
                disabled={busy}
                className="w-full py-4 rounded-md bg-[#B08D57] hover:bg-[#C9A063] text-black font-semibold uppercase tracking-[0.2em] text-sm transition-colors disabled:opacity-60"
                data-testid="btn-end-fast"
              >
                End Fast
              </button>
            ) : (
              <button
                onClick={() => { setPendingGoal(18); setGoalPickerOpen(true); }}
                disabled={busy}
                className="w-full py-4 rounded-md bg-[#B08D57] hover:bg-[#C9A063] text-black font-semibold uppercase tracking-[0.2em] text-sm transition-colors disabled:opacity-60"
                data-testid="btn-start-fast"
              >
                Start Fasting
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ Stats ============ */}
      {stats && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total Fasts" value={String(stats.count)} icon={<Utensils className="w-3.5 h-3.5" />} />
          <StatTile label="Average" value={fmtDuration(stats.avg)} icon={<Timer className="w-3.5 h-3.5" />} />
          <StatTile label="Longest" value={fmtDuration(stats.longest)} icon={<Flame className="w-3.5 h-3.5" />} accent />
          <StatTile label="Shortest" value={fmtDuration(stats.shortest)} icon={<TrendingUp className="w-3.5 h-3.5" />} />
        </div>
      )}

      {/* ============ Body-state legend ============ */}
      <div className="mt-6 card-lux p-4 md:p-6">
        <div className="microlabel mb-3">Body State Legend</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {STAGES.map((s) => {
            const isActive = active && stage.label === s.label;
            return (
              <div
                key={s.label}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm border transition-colors",
                  isActive ? "border-[#B08D57] bg-[#B08D57]/10" : "border-border"
                )}
                data-testid={`legend-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className="text-lg leading-none">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: isActive ? s.color : undefined }}>{s.label}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.hours}h+</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ Recent fasts list ============ */}
      {closed.length > 0 && (
        <div className="mt-6 card-lux p-4 md:p-6">
          <div className="flex items-baseline justify-between mb-3">
            <div className="microlabel">Recent fasts</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{closed.length} total</div>
          </div>
          <div className="divide-y divide-border/60">
            {closed.slice(0, 12).map((f) => {
              const dur = (new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime()) / 3600000;
              const hit = dur >= f.goalHours;
              return (
                <div key={f.id} className="flex items-center gap-3 py-2.5" data-testid={`fast-row-${f.id}`}>
                  <div className={cn("w-1 h-8 rounded-full", hit ? "bg-[#B08D57]" : "bg-muted-foreground/40")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{fmtDuration(dur)} <span className="text-muted-foreground text-xs font-normal">/ {f.goalHours}h goal{f.manual === 1 ? " · manual" : ""}</span></div>
                    <div className="text-[11px] text-muted-foreground truncate">{fmtWhen(f.startedAt)} → {fmtWhen(f.endedAt!)}</div>
                  </div>
                  <button
                    onClick={() => deleteFast(f.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid={`btn-delete-fast-${f.id}`}
                    aria-label="Delete fast"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ Goal picker dialog ============ */}
      <Dialog open={goalPickerOpen} onOpenChange={setGoalPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{active ? "Change goal" : "Choose your fasting window"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-2">
            {GOAL_PRESETS.map((h) => (
              <button
                key={h}
                onClick={() => setPendingGoal(h)}
                className={cn(
                  "py-3 rounded-md border text-sm font-semibold transition-colors",
                  pendingGoal === h
                    ? "border-[#B08D57] bg-[#B08D57]/10 text-[#B08D57]"
                    : "border-border hover:border-foreground/40"
                )}
                data-testid={`btn-goal-${h}`}
              >
                {h}h
              </button>
            ))}
          </div>
          <DialogFooter>
            <button
              onClick={() => setGoalPickerOpen(false)}
              className="h-9 px-4 rounded border border-border text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => (active ? editGoal(pendingGoal) : startFast(pendingGoal))}
              disabled={busy}
              className="h-9 px-4 rounded bg-[#B08D57] text-black text-sm font-semibold hover:bg-[#C9A063] disabled:opacity-60"
              data-testid="btn-confirm-goal"
            >
              {active ? "Update goal" : `Start ${pendingGoal}h fast`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Edit start time dialog ============ */}
      <EditStartDialog
        open={startEditOpen}
        onClose={() => setStartEditOpen(false)}
        initial={active ? isoToLocalInput(active.startedAt) : ""}
        onSave={editStart}
        busy={busy}
      />

      {/* ============ Manual entry dialog ============ */}
      <ManualEntryDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSaved={() => setManualOpen(false)}
      />
    </div>
  );
}

/* ============ Sub-components ============ */

function StatTile({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="card-lux p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <div className="microlabel">{label}</div>
      </div>
      <div className={cn("num-display text-2xl mt-2", accent && "text-[#B08D57]")}>{value}</div>
    </div>
  );
}

function TimerRing({
  pct, elapsedMs, stage, active, goalHours,
}: {
  pct: number; elapsedMs: number; stage: typeof STAGES[number]; active: boolean; goalHours: number;
}) {
  // SVG ring: 260px diameter, thick track
  const size = 280;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const elapsedHours = elapsedMs / 3600000;

  return (
    <div className="relative" style={{ width: size, height: size, maxWidth: "100%" }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="hsl(40 10% 18%)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={active ? stage.color : "hsl(38 60% 45%)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.9s linear, stroke 0.6s ease",
            filter: active ? `drop-shadow(0 0 12px ${stage.color})` : undefined,
          }}
        />
        {/* Stage tick marks around the ring */}
        {STAGES.filter((s) => s.hours > 0 && s.hours <= Math.max(goalHours, 24)).map((s) => {
          const angle = (s.hours / goalHours) * 2 * Math.PI;
          const inner = r - stroke / 2 - 4;
          const outer = r + stroke / 2 + 4;
          const cx = size / 2;
          const cy = size / 2;
          const x1 = cx + inner * Math.cos(angle);
          const y1 = cy + inner * Math.sin(angle);
          const x2 = cx + outer * Math.cos(angle);
          const y2 = cy + outer * Math.sin(angle);
          const passed = elapsedHours >= s.hours;
          return (
            <line
              key={s.label}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={passed ? s.color : "hsl(40 10% 30%)"}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={s.hours <= goalHours + 6 ? 1 : 0}
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {active ? (
          <>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest" style={{ color: stage.color }}>
              <span className="text-base leading-none">{stage.icon}</span>
              <span className="font-semibold" data-testid="text-stage">{stage.label}</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Elapsed · {Math.round(elapsedHours / goalHours * 100)}%
            </div>
            <div className="num-display text-4xl md:text-5xl mt-2 tabular-nums" data-testid="text-elapsed">
              {fmtElapsed(elapsedMs)}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Ready</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mt-1">Choose a window</div>
            <div className="num-display text-4xl md:text-5xl mt-2 opacity-40 tabular-nums">00:00:00</div>
          </>
        )}
      </div>
    </div>
  );
}

function EditStartDialog({
  open, onClose, initial, onSave, busy,
}: {
  open: boolean; onClose: () => void; initial: string; onSave: (v: string) => void; busy: boolean;
}) {
  const [val, setVal] = useState(initial);
  useEffect(() => { if (open) setVal(initial); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>When did you start?</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Input
            type="datetime-local"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            data-testid="input-start-time"
          />
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-9 px-4 rounded border border-border text-sm">Cancel</button>
          <button
            onClick={() => onSave(val)}
            disabled={busy || !val}
            className="h-9 px-4 rounded bg-[#B08D57] text-black text-sm font-semibold hover:bg-[#C9A063] disabled:opacity-60"
            data-testid="btn-save-start"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualEntryDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  // Default: yesterday 8pm → today 12pm
  const defaults = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(20, 0, 0, 0);
    const end = new Date(now); end.setHours(12, 0, 0, 0);
    return { start: isoToLocalInput(start.toISOString()), end: isoToLocalInput(end.toISOString()) };
  }, [open]);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [goal, setGoal] = useState(18);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStart(defaults.start); setEnd(defaults.end); setGoal(18); } }, [open, defaults]);

  const durH = useMemo(() => {
    const s = new Date(start).getTime(); const e = new Date(end).getTime();
    if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
    return (e - s) / 3600000;
  }, [start, end]);

  async function save() {
    if (durH <= 0) {
      toast({ title: "End must be after start", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/api/fasts", {
        startedAt: localInputToIso(start),
        endedAt: localInputToIso(end),
        goalHours: goal,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/fasts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      toast({ title: `Logged ${fmtDuration(durH)} fast` });
      onSaved();
    } catch (e) {
      toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log a past fast</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <div className="microlabel mb-1">Started</div>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} data-testid="input-manual-start" />
          </div>
          <div>
            <div className="microlabel mb-1">Ended</div>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="input-manual-end" />
          </div>
          <div>
            <div className="microlabel mb-1">Goal was</div>
            <div className="grid grid-cols-3 gap-2">
              {GOAL_PRESETS.map((h) => (
                <button
                  key={h}
                  onClick={() => setGoal(h)}
                  className={cn(
                    "py-2 rounded-md border text-sm font-semibold transition-colors",
                    goal === h ? "border-[#B08D57] bg-[#B08D57]/10 text-[#B08D57]" : "border-border hover:border-foreground/40"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
          {durH > 0 && (
            <div className="text-center text-xs text-muted-foreground pt-2">
              Duration: <span className="text-[#B08D57] font-semibold">{fmtDuration(durH)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="h-9 px-4 rounded border border-border text-sm">Cancel</button>
          <button
            onClick={save}
            disabled={busy || durH <= 0}
            className="h-9 px-4 rounded bg-[#B08D57] text-black text-sm font-semibold hover:bg-[#C9A063] disabled:opacity-60"
            data-testid="btn-save-manual"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
