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
import { Loader2, Send, Brain, Zap, AlertTriangle, Paperclip, X } from "lucide-react";
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
  const [images, setImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversationQuery = useQuery<Conversation[]>({
    queryKey: ["/api/coach/conversation"],
  });

  const contextQuery = useQuery<CoachContext>({
    queryKey: ["/api/coach/context"],
    refetchInterval: 60000,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; imageDataUrls?: string[] }) => {
      const body: any = { message: payload.message };
      if (payload.imageDataUrls && payload.imageDataUrls.length > 0) {
        body.imageDataUrls = payload.imageDataUrls;
      }
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
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationQuery.data]);

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
      if (file.size > 15 * 1024 * 1024) {
        alert(`${file.name} is over 15MB, skipping.`);
        continue;
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const r = reader.result;
          if (typeof r === "string") resolve(r);
          else reject(new Error("read failed"));
        };
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      accepted.push({ dataUrl, name: file.name });
    }
    if (accepted.length > 0) {
      setImages(prev => [...prev, ...accepted]);
    }
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx));
  }

  const ctx = contextQuery.data;
  const messages = conversationQuery.data ?? [];

  const pendingNag = (ctx?.todayChecklist ?? []).filter((c: any) => c.status === "pending").length;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-2rem)]" data-testid="page-coach">
      <header className="pb-5 mb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="serif gold mb-1">The Coach</div>
            <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Talk to me.
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Blunt. Strict. Remembers everything.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-start">
            {ctx?.goal && (
              <div className="border border-primary/30 bg-primary/5 rounded-md px-3 py-1.5" data-testid="badge-goal">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Goal</div>
                <div className="font-semibold text-sm num-display">{ctx.goal.targetWeight}lb · {ctx.goal.targetBodyFatPct}% BF</div>
              </div>
            )}
            {ctx && (
              <div className="border border-border bg-card rounded-md px-3 py-1.5" data-testid="badge-memory">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Brain className="w-2.5 h-2.5" /> Memory
                </div>
                <div className="font-semibold text-sm num-display">{ctx.memory.length} facts</div>
              </div>
            )}
            {pendingNag > 0 && (
              <div className="border border-destructive/40 bg-destructive/5 rounded-md px-3 py-1.5" data-testid="badge-nag">
                <div className="text-[10px] uppercase tracking-wider text-destructive/80">Pending</div>
                <div className="font-semibold text-sm num-display text-destructive">{pendingNag} tasks</div>
              </div>
            )}
          </div>
        </div>

        {ctx?.target && ctx.target.calories == null && (
          <div className="mt-3 flex items-center gap-2 text-xs text-primary" data-testid="alert-calories-missing">
            <AlertTriangle className="w-3 h-3" />
            Calorie target not set. Coach won't guess — recover it from your last body scan.
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
        {images.length > 0 && (
          <div className="mb-2 p-2 rounded-md bg-muted/60 border" data-testid="image-preview">
            <div className="text-xs text-muted-foreground mb-2">
              {images.length} image{images.length === 1 ? "" : "s"} attached — Coach will read all of them with your message.
            </div>
            <div className="flex gap-2 flex-wrap">
              {images.map((img, idx) => (
                <div key={idx} className="relative group" data-testid={`image-thumb-${idx}`}>
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-20 h-20 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 bg-background border rounded-full w-5 h-5 flex items-center justify-center opacity-90 hover:opacity-100"
                    data-testid={`button-remove-image-${idx}`}
                    title={`Remove ${img.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              // Reset so selecting the same file twice still triggers onChange
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            data-testid="input-file-hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="self-end"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendMutation.isPending}
            data-testid="button-attach-image"
            title="Attach screenshots (select multiple — MacroFactor, Whoop, body scan, workout, anything)"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={images.length > 0 ? "Add a note (optional) then send — Coach will read all images." : "Ask, log, complain, or attach screenshots. Cmd/Ctrl+Enter to send."}
            rows={2}
            className="resize-none"
            disabled={sendMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={submit}
            disabled={sendMutation.isPending || (!input.trim() && images.length === 0)}
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
          "max-w-[85%] rounded-md px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed",
          isUser && "bg-primary text-primary-foreground",
          isCoach && "coach-bubble",
          message.role === "system" && "bg-amber-100 dark:bg-amber-900/30 text-xs italic",
        )}
      >
        {isCoach && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary font-semibold mb-1.5">
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
