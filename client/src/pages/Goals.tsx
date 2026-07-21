import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Goal } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, Check, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "business", label: "Business", color: "hsl(40 15% 82%)" },
  { key: "health", label: "Health", color: "hsl(145 40% 55%)" },
  { key: "wealth", label: "Wealth", color: "hsl(45 80% 60%)" },
  { key: "personal", label: "Personal", color: "hsl(220 40% 70%)" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  done: "bg-foreground/10 text-foreground border-foreground/20",
  paused: "bg-secondary text-muted-foreground border-border",
};

export default function Goals() {
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("business");
  const [targetDate, setTargetDate] = useState("");

  const create = useMutation({
    mutationFn: async (g: any) => { await apiRequest("POST", "/api/goals", g); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) => {
      await apiRequest("PATCH", `/api/goals/${id}`, patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/goals/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
  });

  const add = () => {
    if (!title.trim()) return;
    create.mutate({ title: title.trim(), category, targetDate: targetDate || null, progress: 0, status: "active" });
    setTitle("");
    setTargetDate("");
    setCategory("business");
  };

  const active = goals.filter((g) => g.status === "active");
  const paused = goals.filter((g) => g.status === "paused");
  const done = goals.filter((g) => g.status === "done");

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-10 py-6 md:py-10">
      <PageHeader title="Goals" subtitle="Longer-term targets. Progress compounds." />

      {/* Add */}
      <section className="card-plain p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_160px_auto] gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What are you aiming at?"
            className="h-10 rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
            data-testid="goal-title"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
            data-testid="goal-category"
          >
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-10 rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
            data-testid="goal-date"
          />
          <button
            onClick={add}
            className="h-10 px-4 rounded bg-foreground text-background text-sm font-medium hover:brightness-90 flex items-center gap-2"
            data-testid="add-goal"
          >
            <Plus className="w-4 h-4" /> Add Goal
          </button>
        </div>
      </section>

      {/* Active */}
      <Section title="Active" items={active} update={update} del={del} />
      {paused.length > 0 && <Section title="Paused" items={paused} update={update} del={del} />}
      {done.length > 0 && <Section title="Completed" items={done} update={update} del={del} muted />}
    </div>
  );
}

function Section({ title, items, update, del, muted }: any) {
  return (
    <section className="mb-6">
      <div className="microlabel mb-3">{title}</div>
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground py-6 text-center card-plain">No goals here yet.</div>
      )}
      <div className="space-y-3">
        {items.map((g: Goal) => (
          <GoalCard key={g.id} goal={g} update={update} del={del} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function GoalCard({ goal, update, del, muted }: { goal: Goal; update: any; del: any; muted?: boolean }) {
  const cat = CATEGORIES.find((c) => c.key === goal.category) ?? CATEGORIES[0];

  return (
    <div className={cn("card-plain p-5", muted && "opacity-60")} data-testid={`goal-card-${goal.id}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{ color: cat.color, borderColor: `${cat.color}30`, background: `${cat.color}0d` }}
            >
              {cat.label}
            </span>
            <span
              className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border", STATUS_STYLES[goal.status])}
            >
              {goal.status}
            </span>
            {goal.targetDate && (
              <span className="text-xs text-muted-foreground">
                by {new Date(goal.targetDate + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          <div className={cn("text-base font-medium", goal.status === "done" && "line-through")}>{goal.title}</div>
        </div>
        <div className="flex items-center gap-1">
          {goal.status === "active" && (
            <>
              <button
                onClick={() => update.mutate({ id: goal.id, patch: { status: "paused" } })}
                className="w-8 h-8 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground"
                title="Pause"
              ><Pause className="w-3.5 h-3.5" /></button>
              <button
                onClick={() => update.mutate({ id: goal.id, patch: { status: "done", progress: 100 } })}
                className="w-8 h-8 rounded flex items-center justify-center hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400"
                title="Mark done"
              ><Check className="w-3.5 h-3.5" /></button>
            </>
          )}
          {goal.status === "paused" && (
            <button
              onClick={() => update.mutate({ id: goal.id, patch: { status: "active" } })}
              className="w-8 h-8 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground"
              title="Resume"
            ><Play className="w-3.5 h-3.5" /></button>
          )}
          <button
            onClick={() => del.mutate(goal.id)}
            className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
            title="Delete"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={goal.progress}
          onChange={(e) => update.mutate({ id: goal.id, patch: { progress: Number(e.target.value) } })}
          className="flex-1 accent-foreground"
          data-testid={`goal-progress-${goal.id}`}
        />
        <div className="w-12 text-right text-sm num-display text-foreground">{goal.progress}%</div>
      </div>
    </div>
  );
}
