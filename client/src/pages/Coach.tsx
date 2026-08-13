/**
 * Coach — Atlas HUD hero page.
 * Atlas video loops center-stage. Live stats etched around him HUD-style.
 * Chat docks below like a command deck. Red rim-light pulse while thinking.
 * All existing wiring (queries, mutations, decisions, attachments) preserved.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Zap, AlertTriangle, Paperclip, X, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const isThinking = sendMutation.isPending;

  // Weekly ledger — top 4 muscle groups by set count for HUD readout
  const ledger = ctx?.weeklyLedger ?? {};
  const ledgerTop = Object.entries(ledger)
    .filter(([, v]) => (v as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 4);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] hud-grid" data-testid="page-coach">
      {/* Atmospheric backdrop glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[500px] rounded-full opacity-30 blur-3xl"
             style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* HUD header — Atlas name plate */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 accent-red" />
            <div>
              <div className="serif accent-red">ATLAS · TIER I OPERATOR</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {ctx?.memory.length ?? "..."} facts on file · discipline over motivation
              </div>
            </div>
          </div>
          {pendingNag > 0 && (
            <div className="hud-stat !py-2 !px-3" data-testid="badge-nag">
              <div className="serif" style={{ color: 'hsl(var(--primary))' }}>PENDING</div>
              <div className="num-mono text-lg" style={{ color: 'hsl(var(--primary))' }}>{pendingNag}</div>
            </div>
          )}
        </div>

        {/* HERO ROW — Atlas center, HUD rails left/right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-6 items-center">
          {/* LEFT HUD RAIL */}
          <div className="space-y-3 order-2 lg:order-1">
            {ctx?.latestScan && (
              <HudStat
                label="LAST SCAN"
                value={`${ctx.latestScan.weight ?? "?"}`}
                unit="LB"
                sub={`${ctx.latestScan.bodyFatPct ?? "?"}% BF`}
                testId="hud-scan"
              />
            )}
            {ctx?.target && (
              <HudStat
                label="TARGET · FEB 2027"
                value={`${ctx.goal?.targetWeight ?? "?"}`}
                unit="LB"
                sub={`${ctx.goal?.targetBodyFatPct ?? "?"}% · ${ctx.target.calories ?? "?"} kcal · ${ctx.target.proteinG ?? "?"}g P`}
                testId="hud-target"
              />
            )}
            {ctx?.todayMacros && (
              <HudStat
                label="TODAY · MACROS"
                value={`${ctx.todayMacros.calories ?? 0}`}
                unit="KCAL"
                sub={`${ctx.todayMacros.proteinG ?? 0}g P · ${ctx.todayMacros.carbsG ?? 0}g C · ${ctx.todayMacros.fatG ?? 0}g F`}
                testId="hud-macros"
              />
            )}
          </div>

          {/* CENTER — ATLAS */}
          <div className="flex flex-col items-center justify-center order-1 lg:order-2">
            <div
              className="atlas-frame w-56 h-56 md:w-72 md:h-72"
              data-thinking={isThinking ? "true" : "false"}
              data-testid="atlas-avatar"
            >
              <video
                src="/atlas-loop.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-4 text-center">
              <div className="serif-hero font-display" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)' }}>
                Atlas
              </div>
              <div className="serif mt-1">
                {isThinking ? 'THINKING…' : 'STANDING WATCH'}
              </div>
            </div>
          </div>

          {/* RIGHT HUD RAIL */}
          <div className="space-y-3 order-3">
            {ctx?.latestRecovery && (
              <HudStat
                label="WHOOP · RECOVERY"
                value={`${ctx.latestRecovery.whoopRecoveryPct ?? "?"}`}
                unit="%"
                sub={`${ctx.latestRecovery.sleepHours ?? "?"}h sleep · strain ${ctx.latestRecovery.whoopStrain ?? "?"}`}
                testId="hud-recovery"
              />
            )}
            {ledgerTop.length > 0 && (
              <div className="hud-stat" data-testid="hud-ledger">
                <div className="serif">WEEKLY LEDGER · {Object.values(ledger).reduce((s: number, v) => s + (v as number), 0)} SETS</div>
                <div className="mt-2 space-y-1.5">
                  {ledgerTop.map(([group, count]) => (
                    <div key={group} className="flex items-center justify-between text-xs">
                      <span className="uppercase tracking-wider text-muted-foreground">{group}</span>
                      <span className="num-mono accent-bronze font-semibold">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <HudStat
              label="TODAY · PLAN"
              value={ctx?.todayPlan?.dayType ?? "REST"}
              unit=""
              sub={ctx?.today ?? ""}
              testId="hud-plan"
            />
          </div>
        </div>

        {ctx?.target && ctx.target.calories == null && (
          <div className="mb-4 flex items-center gap-2 text-xs accent-red hud-stat" data-testid="alert-calories-missing">
            <AlertTriangle className="w-3 h-3" />
            Calorie target not set. Atlas won't guess — recover it from your last body scan.
          </div>
        )}

        {/* CHAT DECK */}
        <div className="border border-primary/20 rounded-lg bg-card/40 backdrop-blur">
          <div className="px-4 md:px-6 py-3 border-b border-primary/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full accent-red" style={{ background: 'hsl(var(--primary))' }} />
              <div className="serif">COMMAND CHANNEL</div>
            </div>
            <div className="text-xs text-muted-foreground">Cmd/Ctrl+Enter to send</div>
          </div>

          {/* Scroll region */}
          <div
            ref={scrollRef}
            className="overflow-y-auto space-y-3 p-4 md:p-6"
            style={{ maxHeight: 'min(50vh, 500px)', minHeight: '260px' }}
            data-testid="chat-scroll-region"
          >
            {messages.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30 accent-red" />
                <p className="text-sm font-display italic">
                  "Speak, and I will listen. Log your weight. Tell me what you ate.
                  Ask for today's workout. I remember everything."
                </p>
                <p className="text-xs mt-2 opacity-60">— Atlas</p>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-sm accent-red pl-2" data-testid="indicator-thinking">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="serif">ATLAS RESPONDING…</span>
              </div>
            )}
          </div>

          {/* Input dock */}
          <div className="border-t border-primary/15 p-3 md:p-4">
            {images.length > 0 && (
              <div className="mb-3 p-2 rounded-md bg-muted/40 border border-primary/10" data-testid="image-preview">
                <div className="text-xs text-muted-foreground mb-2">
                  {images.length} image{images.length === 1 ? "" : "s"} attached — Atlas will read them all.
                </div>
                <div className="flex gap-2 flex-wrap">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group" data-testid={`image-thumb-${idx}`}>
                      <img src={img.dataUrl} alt={img.name} className="w-16 h-16 object-cover rounded border border-primary/20" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 bg-background border border-primary/30 rounded-full w-5 h-5 flex items-center justify-center"
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
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                data-testid="input-file-hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="self-end border-primary/25 hover:bg-primary/10"
                onClick={() => fileInputRef.current?.click()}
                disabled={isThinking}
                data-testid="button-attach-image"
                title="Attach screenshots — MacroFactor, Whoop, body scan, workout"
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
                placeholder={images.length > 0 ? "Add a note (optional) then send." : "Report in. Weight, macros, mood, or 'generate my workout'."}
                rows={2}
                className="resize-none bg-background/60 border-primary/20 focus:border-primary/60"
                disabled={isThinking}
                data-testid="input-message"
              />
              <Button
                onClick={submit}
                disabled={isThinking || (!input.trim() && images.length === 0)}
                className="self-end"
                data-testid="button-send"
              >
                {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HudStat({ label, value, unit, sub, testId }: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  testId?: string;
}) {
  return (
    <div className="hud-stat" data-testid={testId}>
      <div className="serif">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="num-display text-3xl md:text-4xl font-display">{value}</span>
        {unit && <span className="serif text-xs opacity-70">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function MessageBubble({ message }: { message: Conversation }) {
  const isUser = message.role === "user";
  const isCoach = message.role === "coach";
  const proposedWorkout = message.decisions?.workoutPlanToSet;
  const saveWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (!proposedWorkout) return;
      const r = await apiRequest("POST", "/api/fitness/workouts/plan", {
        date: proposedWorkout.date,
        dayType: proposedWorkout.dayType,
        exercises: proposedWorkout.exercises,
        targetSetsByBodyPart: proposedWorkout.targetSetsByBodyPart ?? {},
        source: "coach_chat",
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/workouts/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
    },
  });

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")} data-testid={`message-${message.role}-${message.id}`}>
      <div
        className={cn(
          "max-w-[85%] rounded-md px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed",
          isUser && "user-bubble",
          isCoach && "coach-bubble",
          message.role === "system" && "bg-muted/40 border border-border text-xs italic",
        )}
      >
        {isCoach && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] font-bold mb-1.5" style={{ color: 'hsl(var(--primary))' }}>
            <Zap className="w-3 h-3" /> ATLAS
          </div>
        )}
        {message.content}
        {proposedWorkout && Array.isArray(proposedWorkout.exercises) && proposedWorkout.exercises.length > 0 && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold mb-2" style={{ color: 'hsl(var(--primary))' }}>
              PROPOSED WORKOUT · {proposedWorkout.date} · {proposedWorkout.dayType}
            </div>
            <ul className="text-xs space-y-1 mb-3">
              {proposedWorkout.exercises.map((ex: any, i: number) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{i + 1}. {ex.name}</span>
                  <span className="opacity-60 whitespace-nowrap num-mono">{ex.sets}×{ex.repsMin ?? "?"}-{ex.repsMax ?? "?"}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => saveWorkoutMutation.mutate()}
                disabled={saveWorkoutMutation.isPending || saveWorkoutMutation.isSuccess}
                className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 uppercase tracking-wider font-bold"
                data-testid="button-save-coach-workout"
              >
                {saveWorkoutMutation.isSuccess ? "Saved ✓" : saveWorkoutMutation.isPending ? "Saving…" : "Save as plan"}
              </button>
              <a
                href={`/#/generate-workout`}
                className="text-xs px-3 py-1.5 rounded border border-current/20 hover:bg-current/5 uppercase tracking-wider"
              >
                Open workout page
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
