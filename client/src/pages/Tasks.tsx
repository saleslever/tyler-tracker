import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Task } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Check, Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/10 text-red-300 border-red-500/20",
  med: "bg-secondary text-muted-foreground border-border",
  low: "bg-secondary/50 text-muted-foreground/70 border-border",
};

function TaskRow({
  task, onToggle, onDelete, onMove,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 py-3 border-b border-border last:border-b-0",
        task.completed && "opacity-50"
      )}
      data-testid={`task-row-${task.id}`}
    >
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all",
          task.completed
            ? "bg-foreground text-background border-foreground"
            : "bg-transparent border-border hover:border-foreground/60"
        )}
        data-testid={`toggle-task-${task.id}`}
      >
        {task.completed === 1 && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>

      <div className={cn("flex-1 min-w-0 text-sm", task.completed && "line-through")}>{task.title}</div>

      <span
        className={cn(
          "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border",
          PRIORITY_STYLES[task.priority]
        )}
      >
        {task.priority}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMove}
          className="w-7 h-7 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground"
          title={task.list === "today" ? "Move to backlog" : "Pull to today"}
          data-testid={`move-${task.id}`}
        >
          {task.list === "today" ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
          data-testid={`delete-${task.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TaskAdder({ list, onAdd }: { list: "today" | "backlog"; onAdd: (t: any) => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("med");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), priority, list });
    setTitle("");
    setPriority("med");
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={list === "today" ? "Add a task for today…" : "Add to backlog…"}
        className="flex-1 h-10 rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
        data-testid={`input-new-${list}`}
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="h-10 rounded bg-secondary/50 border border-border px-2 text-xs uppercase tracking-wider focus:outline-none focus:border-foreground/50"
        data-testid={`priority-${list}`}
      >
        <option value="high">High</option>
        <option value="med">Med</option>
        <option value="low">Low</option>
      </select>
      <button
        onClick={submit}
        className="h-10 w-10 rounded bg-foreground text-background flex items-center justify-center hover:brightness-90"
        data-testid={`add-${list}`}
        aria-label="Add"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function Tasks() {
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });

  const create = useMutation({
    mutationFn: async (t: any) => { await apiRequest("POST", "/api/tasks", t); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/tasks/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const today = tasks.filter((t) => t.list === "today").sort((a, b) => a.completed - b.completed);
  const backlog = tasks.filter((t) => t.list === "backlog").sort((a, b) => a.completed - b.completed);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-6 md:py-10">
      <PageHeader title="Tasks" subtitle="Today's focus and backlog." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-plain p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="serif text-base">Today</div>
              <div className="text-xs text-muted-foreground mt-1">
                {today.filter((t) => !t.completed).length} open · {today.filter((t) => t.completed).length} done
              </div>
            </div>
          </div>
          <TaskAdder list="today" onAdd={(t) => create.mutate(t)} />
          <div>
            {today.length === 0 && (
              <div className="text-sm text-muted-foreground py-10 text-center">
                No tasks yet. Add one above to lock in today's focus.
              </div>
            )}
            {today.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() =>
                  update.mutate({
                    id: t.id,
                    patch: {
                      completed: t.completed ? 0 : 1,
                      completedAt: t.completed ? null : new Date().toISOString(),
                    },
                  })
                }
                onDelete={() => del.mutate(t.id)}
                onMove={() => update.mutate({ id: t.id, patch: { list: "backlog" } })}
              />
            ))}
          </div>
        </section>

        <section className="card-plain p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="serif text-base">Backlog</div>
              <div className="text-xs text-muted-foreground mt-1">
                {backlog.filter((t) => !t.completed).length} queued
              </div>
            </div>
          </div>
          <TaskAdder list="backlog" onAdd={(t) => create.mutate(t)} />
          <div>
            {backlog.length === 0 && (
              <div className="text-sm text-muted-foreground py-10 text-center">Backlog is clear.</div>
            )}
            {backlog.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() =>
                  update.mutate({
                    id: t.id,
                    patch: {
                      completed: t.completed ? 0 : 1,
                      completedAt: t.completed ? null : new Date().toISOString(),
                    },
                  })
                }
                onDelete={() => del.mutate(t.id)}
                onMove={() => update.mutate({ id: t.id, patch: { list: "today" } })}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
