import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Journal } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { addDays } from "@/lib/analytics";
import { useToday } from "@/hooks/useToday";
import { ChevronLeft, ChevronRight, Save, Check } from "lucide-react";

function pretty(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function JournalPage() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const { data: entry } = useQuery<Journal | null>({ queryKey: ["/api/journal", date] });

  const [wins, setWins] = useState("");
  const [lessons, setLessons] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setWins(entry?.wins ?? "");
    setLessons(entry?.lessons ?? "");
    setTomorrow(entry?.tomorrow ?? "");
    setNotes(entry?.notes ?? "");
    setSavedAt(null);
  }, [entry, date]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/journal/${date}`, { wins, lessons, tomorrow, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal", date] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 py-6 md:py-10">
      <PageHeader
        title="Journal"
        subtitle="Wins, lessons, and where you're headed next."
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate(addDays(date, -1))}
              className="w-9 h-9 flex items-center justify-center rounded border border-border hover:bg-secondary"
              data-testid="prev-day"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDate(today)}
              className="h-9 px-3 rounded border border-border hover:bg-secondary text-xs uppercase tracking-wider"
            >
              Today
            </button>
            <button
              onClick={() => setDate(addDays(date, 1))}
              disabled={date >= today}
              className="w-9 h-9 flex items-center justify-center rounded border border-border hover:bg-secondary disabled:opacity-30"
              data-testid="next-day"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="text-sm text-muted-foreground mb-6">{pretty(date)}</div>

      <div className="space-y-5">
        <Field label="Wins" placeholder="Three wins from today…" value={wins} onChange={setWins} testId="wins" />
        <Field label="Lessons" placeholder="What did today teach you?" value={lessons} onChange={setLessons} testId="lessons" />
        <Field label="Tomorrow" placeholder="What's the plan for tomorrow?" value={tomorrow} onChange={setTomorrow} testId="tomorrow" />
        <Field label="Notes" placeholder="Anything else on your mind…" value={notes} onChange={setNotes} testId="notes" rows={6} />

        <div className="flex items-center justify-end gap-3 pt-2">
          {savedAt && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> Saved at {savedAt}
            </div>
          )}
          <button
            onClick={() => save.mutate()}
            className="h-10 px-5 rounded bg-foreground text-background text-sm font-medium hover:brightness-90 flex items-center gap-2"
            data-testid="save-journal"
          >
            <Save className="w-4 h-4" />
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, placeholder, value, onChange, testId, rows = 3,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  rows?: number;
}) {
  return (
    <div>
      <div className="microlabel mb-2">{label}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded bg-secondary/30 border border-border px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-foreground/40 resize-none"
        data-testid={`journal-${testId}`}
      />
    </div>
  );
}
