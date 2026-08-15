/**
 * Atlas — full-screen hero chat page (Cipher-style).
 * The Coach OS home for actually TALKING to Atlas.
 * Big centered Atlas avatar/video, huge serif ATLAS name, ONLINE·READY status,
 * intro card, 3 quick-start chips, conversation flow below, sticky input at bottom.
 * Mobile-first — matches the Cipher/Sales Lever reference exactly, but in
 * parchment/palette-2-light with a dark-mode inverse.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Paperclip, X, Play } from "lucide-react";
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

const QUICK_STARTS = [
  "Build this week's workout",
  "Check my streaks",
  "Log today's macros",
];

export default function Atlas() {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [playVideo, setPlayVideo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const conversationQuery = useQuery<Conversation[]>({
    queryKey: ["/api/coach/conversation"],
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
      setShowIntro(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/overview"] });
    },
  });

  const messages = conversationQuery.data ?? [];
  const isThinking = sendMutation.isPending;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  function submit(msg?: string) {
    const trimmed = (msg ?? input).trim();
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
    if (accepted.length > 0) setImages((prev) => [...prev, ...accepted]);
  }

  return (
    <div className="parchment min-h-screen flex flex-col">
      <div className="relative z-10 flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pt-6 pb-32">

        {/* ───────── Hero — collapses once conversation begins ───────── */}
        <div className={cn(
          "transition-all duration-500 ease-out",
          hasMessages ? "opacity-90" : "opacity-100"
        )}>
          {/* Halo + Atlas orb */}
          <div className="relative flex justify-center mt-2 mb-6">
            <div className={cn(
              "relative rounded-full overflow-hidden border-2 border-primary/40 bg-black transition-all duration-500",
              hasMessages ? "w-24 h-24" : "w-48 h-48 md:w-56 md:h-56"
            )}>
              {/* Halo rings */}
              {!hasMessages && (
                <>
                  <div className="absolute -inset-6 rounded-full border border-primary/20 animate-pulse pointer-events-none" />
                  <div className="absolute -inset-12 rounded-full border border-primary/10 pointer-events-none" />
                </>
              )}
              <video
                ref={videoRef}
                autoPlay={playVideo}
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                poster="/atlas-poster.jpg"
              >
                <source src="/atlas-loop.mp4" type="video/mp4" />
              </video>
              {!playVideo && !hasMessages && (
                <button
                  onClick={() => { setPlayVideo(true); videoRef.current?.play(); }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
                  aria-label="Play Atlas intro"
                >
                  <Play className="w-10 h-10 text-white/90 fill-white/90" />
                </button>
              )}
              {/* Corner data ticks — the HUD detail */}
              <div className="absolute top-2 left-2 text-[8px] tracking-widest text-primary/70 font-mono">TGT:195</div>
              <div className="absolute top-2 right-2 text-[8px] tracking-widest text-primary/70 font-mono">D-{daysUntilBirthday()}</div>
              <div className="absolute bottom-2 left-2 text-[8px] tracking-widest text-primary/70 font-mono">STR:16</div>
              <div className="absolute bottom-2 right-2 text-[8px] tracking-widest text-primary/70 font-mono">18/WK</div>
            </div>
          </div>

          {/* Name */}
          <h1 className={cn(
            "font-display text-center font-black tracking-[0.16em] leading-none text-foreground transition-all duration-500",
            hasMessages ? "text-2xl md:text-3xl" : "text-6xl md:text-7xl"
          )}>
            ATLAS
          </h1>

          {/* Tagline */}
          {!hasMessages && (
            <p className="mt-4 text-center text-sm md:text-base text-muted-foreground italic px-4">
              Coach OS · Forging your 195lb frame by March 6, 2027
            </p>
          )}

          {/* Status pill */}
          <div className={cn(
            "flex items-center justify-center gap-2 transition-all duration-500",
            hasMessages ? "mt-3" : "mt-6"
          )}>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs tracking-[0.28em] uppercase text-primary font-semibold">
              Online · Ready
            </span>
          </div>
        </div>

        {/* ───────── Intro card — hidden once conversation starts ───────── */}
        {!hasMessages && showIntro && (
          <>
            <div className="mt-8 flex items-start gap-3 mx-2">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40 flex-shrink-0 bg-black">
                <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                  <source src="/atlas-loop.mp4" type="video/mp4" />
                </video>
              </div>
              <div className="bg-card border border-card-border rounded-lg px-4 py-3 text-sm leading-relaxed">
                I'm <span className="text-primary font-semibold">Atlas</span>. I have live access to your fitness data,
                habits, weekly training log, and body-scan history. Send me a
                workout to save, a macro screenshot to log, or ask me anything.
              </div>
            </div>

            {/* Quick-start chips */}
            <div className="mt-6 flex flex-wrap justify-center gap-2 px-2">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="text-xs px-4 py-2 rounded-full bg-card border border-card-border hover:border-primary hover:bg-primary/5 transition tracking-wide"
                  data-testid={`quickstart-${q.slice(0,10)}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ───────── Conversation ───────── */}
        {hasMessages && (
          <div ref={scrollRef} className="mt-8 space-y-4 flex-1 overflow-y-auto">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-card border border-card-border rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span className="text-xs tracking-widest uppercase text-muted-foreground">Atlas analyzing</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ───────── Sticky input ───────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background to-transparent pt-4 pb-4 md:pb-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Reserve room for bottom nav on mobile */}
        <div className="max-w-2xl mx-auto px-4 md:mb-0 mb-14">
          {images.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={img.dataUrl} alt={img.name} className="w-14 h-14 rounded object-cover border border-card-border" />
                  <button
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 bg-background border border-card-border rounded-full w-5 h-5 flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-card border border-card-border rounded-2xl px-3 py-2 shadow-lg">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-primary/5 flex-shrink-0"
              aria-label="Attach image"
              data-testid="button-attach"
            >
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Talk to Atlas... or paste a workout / macro screenshot"
              rows={1}
              className="flex-1 resize-none border-0 focus-visible:ring-0 bg-transparent min-h-[40px] max-h-32 text-sm"
              data-testid="input-atlas-message"
            />
            <button
              onClick={() => submit()}
              disabled={isThinking || (!input.trim() && images.length === 0)}
              className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 flex-shrink-0"
              data-testid="button-send"
              aria-label="Send"
            >
              {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground/70 mt-2 tracking-wide">
            Atlas remembers everything. Direct, honest, no bullshit.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Days-until-birthday helper (goal deadline 3/6/27) ───
function daysUntilBirthday(): number {
  const now = new Date();
  const target = new Date("2027-03-06T00:00:00");
  const ms = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ─── Message bubble w/ decision-card save (matches Coach.tsx behavior) ───
function MessageBubble({ message }: { message: Conversation }) {
  const isUser = message.role === "user";
  const proposed = message.decisions?.workoutPlanToSet;
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!proposed) return;
      const r = await apiRequest("POST", "/api/fitness/workouts/plan", {
        date: proposed.date,
        dayType: proposed.dayType,
        exercises: proposed.exercises,
        targetSetsByBodyPart: proposed.targetSetsByBodyPart ?? {},
        source: "coach_chat",
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/workouts/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/overview"] });
    },
  });

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40 flex-shrink-0 mr-2 mt-1 bg-black">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source src="/atlas-loop.mp4" type="video/mp4" />
          </video>
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-card border border-card-border text-foreground rounded-bl-sm"
      )}>
        <div className="whitespace-pre-wrap">{message.content}</div>
        {proposed && Array.isArray(proposed.exercises) && proposed.exercises.length > 0 && (
          <div className="mt-3 pt-3 border-t border-current/10">
            <div className="text-[10px] tracking-[0.22em] uppercase font-bold mb-2 text-primary">
              Proposed Workout · {proposed.date} · {proposed.dayType}
            </div>
            <ul className="text-xs space-y-1 mb-3">
              {proposed.exercises.map((ex: any, i: number) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{i + 1}. {ex.name}</span>
                  <span className="opacity-70 whitespace-nowrap font-mono">
                    {ex.sets}×{ex.repsMin ?? "?"}-{ex.repsMax ?? "?"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || saveMutation.isSuccess}
                className="text-xs px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 uppercase tracking-wider font-bold"
                data-testid="button-save-atlas-workout"
              >
                {saveMutation.isSuccess ? "Saved ✓" : saveMutation.isPending ? "Saving…" : "Save as today's plan"}
              </button>
              <a
                href="/#/generate"
                className="text-xs px-3 py-2 rounded border border-current/20 hover:bg-current/5 uppercase tracking-wider inline-flex items-center"
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
