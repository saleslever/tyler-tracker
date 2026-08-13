/**
 * Coach — the chat page. This is the front door of the new app.
 * Everything Tyler tells this coach is remembered forever (coach_memory + coach_conversations).
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Brain, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: number;
  date: string;
  role: "user" | "coach" | "system";
  content: string;
  model?: string | null;
  createdAt: string;
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

export default function Coach() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery<Conversation[]>({
    queryKey: ["/api/coach/conversation"],
  });

  const contextQuery = useQuery<CoachContext>({
    queryKey: ["/api/coach/context"],
    refetchInterval: 60000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/coach/chat", { message });
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/memory"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationQuery.data]);

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  }

  const ctx = contextQuery.data;
  const messages = conversationQuery.data ?? [];

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-6rem)]" data-testid="page-coach">
      <header className="border-b pb-4 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Coach</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Blunt, strict, remembers everything.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ctx?.goal && (
              <Badge variant="outline" data-testid="badge-goal">
                Goal: {ctx.goal.targetWeight}lb / {ctx.goal.targetBodyFatPct}% BF
              </Badge>
            )}
            {ctx?.settings && (
              <Badge variant="secondary" data-testid="badge-sets">
                {ctx.settings.weeklySetsPerBodyPart} sets/wk/part
              </Badge>
            )}
            {ctx && (
              <Badge variant="outline" className="gap-1" data-testid="badge-memory">
                <Brain className="w-3 h-3" /> {ctx.memory.length} facts
              </Badge>
            )}
          </div>
        </div>

        {ctx?.target && ctx.target.calories == null && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500" data-testid="alert-calories-missing">
            <AlertTriangle className="w-3 h-3" />
            Calorie target not set. Coach won't guess — set from your last body scan.
          </div>
        )}
      </header>

      {/* Chat scroll region */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2"
        data-testid="chat-scroll-region"
      >
        {messages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Coach is loaded with {ctx?.memory.length ?? "..."} facts about you.</p>
            <p className="text-xs mt-1">Say something. Weigh-in, macros, how you're feeling, or "generate my workout".</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {sendMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2" data-testid="indicator-thinking">
            <Loader2 className="w-4 h-4 animate-spin" />
            Coach is thinking...
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t pt-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask, log, complain. Cmd/Ctrl+Enter to send."
            rows={2}
            className="resize-none"
            disabled={sendMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={submit}
            disabled={sendMutation.isPending || !input.trim()}
            className="self-end"
            data-testid="button-send"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Context summary strip */}
        {ctx && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="context-strip">
            <ContextChip label="Today" value={ctx.today} />
            {ctx.latestScan && (
              <ContextChip
                label="Last scan"
                value={`${ctx.latestScan.weight ?? "?"}lb, ${ctx.latestScan.bodyFatPct ?? "?"}% BF`}
              />
            )}
            {ctx.latestRecovery && (
              <ContextChip
                label="Whoop"
                value={`${ctx.latestRecovery.whoopRecoveryPct ?? "?"}%, ${ctx.latestRecovery.sleepHours ?? "?"}h`}
              />
            )}
            {ctx.todayMacros && (
              <ContextChip
                label="Today"
                value={`${ctx.todayMacros.calories ?? 0}kcal, ${ctx.todayMacros.proteinG ?? 0}g P`}
              />
            )}
            <ContextChip label="Plan" value={ctx.todayPlan?.dayType ?? "not set"} />
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Conversation }) {
  const isUser = message.role === "user";
  const isCoach = message.role === "coach";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")} data-testid={`message-${message.role}-${message.id}`}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 whitespace-pre-wrap text-sm",
          isUser && "bg-primary text-primary-foreground",
          isCoach && "bg-muted",
          message.role === "system" && "bg-amber-100 dark:bg-amber-900/30 text-xs italic",
        )}
      >
        {isCoach && (
          <div className="flex items-center gap-1 text-xs opacity-60 mb-1">
            <Zap className="w-3 h-3" /> Coach
          </div>
        )}
        {message.content}
      </div>
    </div>
  );
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted/60">
      <span className="opacity-60">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
