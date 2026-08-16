/**
 * Atlas — mobile-first full-screen chat, iMessage / Perplexity-style.
 *
 * Layout uses dvh so it survives iOS keyboard + safe-area.
 * When there's no conversation: giant centered orb + intro state.
 * When there's a conversation: compact 40px avatar in a top bar, messages
 * scroll in the middle, input pinned at the bottom.
 * Input clears IMMEDIATELY on send. Autoscroll uses a bottom sentinel + scrollIntoView.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Send, Paperclip, X, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtlasThinkingSound } from "@/hooks/useAtlasThinkingSound";

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
  const [isFocused, setIsFocused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [soundOptedIn, setSoundOptedIn] = useState(false);

  // Add body class while composer focused so tab bar can hide (iOS keyboard fix)
  useEffect(() => {
    if (isFocused) document.documentElement.classList.add("atlas-composing");
    else document.documentElement.classList.remove("atlas-composing");
    return () => document.documentElement.classList.remove("atlas-composing");
  }, [isFocused]);

  // (Previously tried to override --atlas-vh from visualViewport for iOS keyboard.
  // That caused the composer to collapse to zero height on some devices. Removed.
  // The layout now relies on plain position:fixed top/bottom which iOS Safari
  // handles well enough as long as we don't fight it with explicit heights.)
  const [images, setImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [pendingUserMsg, setPendingUserMsg] = useState<{ content: string; images: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversationQuery = useQuery<Conversation[]>({
    queryKey: ["/api/coach/conversation"],
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { message: string; imageDataUrls?: string[]; imageThumbnails?: string[] }) => {
      const body: any = { message: payload.message };
      if (payload.imageDataUrls && payload.imageDataUrls.length > 0) body.imageDataUrls = payload.imageDataUrls;
      if (payload.imageThumbnails && payload.imageThumbnails.length > 0) body.imageThumbnails = payload.imageThumbnails;
      // keepalive keeps the POST alive even if the tab is backgrounded or unloaded.
      // Only effective for bodies <60KB (text-only). Image sends fall back to normal fetch.
      const res = await apiRequest("POST", "/api/coach/chat", body, { keepalive: true });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPendingUserMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Only refresh the conversation itself immediately — that's what the user
      // sees. Everything else is deferred and only invalidated if Atlas actually
      // wrote to it, so we don't spam 10 background requests during the paint.
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversation"] });

      const logged = Array.isArray(data?.decisions?.logged) ? data.decisions.logged : [];
      const kinds = new Set<string>(logged.map((l: any) => l?.type));
      const wroteSomething = kinds.size > 0;

      if (wroteSomething) {
        // Defer secondary refreshes to idle time so they don't compete with
        // the paint of Atlas's incoming reply on the main thread.
        const runIdle = (fn: () => void) => {
          const w = window as any;
          if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(fn, { timeout: 800 });
          else setTimeout(fn, 400);
        };
        runIdle(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
          queryClient.invalidateQueries({ queryKey: ["/api/fitness/overview"] });
          queryClient.invalidateQueries({ queryKey: ["/api/fitness/dashboard"] });
          if (kinds.has("body_scan")) queryClient.invalidateQueries({ queryKey: ["/api/fitness/scans"] });
          if (kinds.has("macro")) queryClient.invalidateQueries({ queryKey: ["/api/fitness/macros?start=2020-01-01&end=2099-12-31"] });
          if (kinds.has("workout_completed") || kinds.has("workout_planned")) queryClient.invalidateQueries({ queryKey: ["/api/fitness/workouts"] });
          if (kinds.has("workout_planned")) queryClient.invalidateQueries({ queryKey: ["/api/coach/plan"] });
        });
      }
    },
    onError: () => {
      // Do NOT put the text back into the composer — that surprised Tyler when
      // he backgrounded the app after sending. Keep the optimistic bubble visible
      // so he can see what he sent; the next refresh of /api/coach/conversation
      // will show whether the server actually received it.
      // If we want a resend affordance later, wire it here.
    },
  });

  const serverMessages = conversationQuery.data ?? [];
  // Optimistic: append pending user message to the visible list until server echoes it back
  const messages: Conversation[] = pendingUserMsg
    ? [...serverMessages, {
        id: -1,
        date: new Date().toISOString().slice(0, 10),
        role: "user" as const,
        content: pendingUserMsg.content,
        imageUrls: pendingUserMsg.images.length > 0 ? pendingUserMsg.images : undefined,
        createdAt: new Date().toISOString(),
      } as any]
    : serverMessages;
  // Show thinking bubble whenever there's a pending message OR the mutation is
  // in flight. Using pendingUserMsg makes it appear on the SAME paint as the
  // user's bubble, instead of waiting for React to flush mutation.isPending.
  const rawThinking = sendMutation.isPending || pendingUserMsg !== null;
  const [showThinking, setShowThinking] = useState(false);
  const thinkingSinceRef = useRef<number>(0);
  useEffect(() => {
    if (rawThinking) {
      thinkingSinceRef.current = performance.now();
      setShowThinking(true);
      return;
    }
    // When mutation ends, keep the bubble visible for a minimum of 500ms so it
    // never flashes past the user's eye. Feels like a real coach thinking.
    const elapsed = performance.now() - thinkingSinceRef.current;
    const remaining = Math.max(0, 500 - elapsed);
    const t = window.setTimeout(() => setShowThinking(false), remaining);
    return () => window.clearTimeout(t);
  }, [rawThinking]);
  const isThinking = showThinking;

  // Spartan war-drum motif while Atlas is composing his response.
  // Requires an explicit user opt-in via the mute button because the 15MB MP3
  // otherwise blocks the main thread on iOS when Atlas is thinking.
  useAtlasThinkingSound(isThinking && !muted && soundOptedIn);
  const hasMessages = messages.length > 0;

  // Auto-scroll to bottom whenever messages or thinking state changes. Use
  // instant scroll (not smooth) so iOS doesn't queue it behind other work.
  useEffect(() => {
    // Jump the page scroll directly — fastest, no smooth animation queue.
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
  }, [messages.length, isThinking]);

  // On first load with existing messages, jump straight to bottom of the PAGE
  // (the whole document scrolls now, not an inner overflow container).
  useEffect(() => {
    if (serverMessages.length > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationQuery.isSuccess]);

  // Tiny click sound via Web Audio + iOS haptic
  function playClickSound() {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      setTimeout(() => ctx.close?.(), 200);
    } catch { /* ignore */ }
    try { (navigator as any).vibrate?.(8); } catch { /* ignore */ }
  }

  function submit(msg?: string) {
    const trimmed = (msg ?? input).trim();
    if (sendMutation.isPending) return;
    if (!trimmed && images.length === 0) return;
    playClickSound();
    const imageDataUrls = images.map(i => i.dataUrl);
    const imageThumbnails = images.map(i => i.thumbUrl);
    // Clear input IMMEDIATELY and show user bubble optimistically with thumbnails
    setPendingUserMsg({ content: trimmed, images: imageThumbnails });
    setInput("");
    setImages([]);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMutation.mutate({ message: trimmed, imageDataUrls, imageThumbnails });
  }

  // Downscale a data URL to a small JPEG thumbnail for chat storage.
  // Kept small (max 240px, quality 0.55) so iOS can decode 10+ inline without freezing.
  async function makeThumbnail(dataUrl: string, maxDim = 240, quality = 0.55): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const accepted: { dataUrl: string; thumbUrl: string; name: string }[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 15 * 1024 * 1024) { alert(`${file.name} is over 15MB, skipping.`); continue; }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const r = reader.result; if (typeof r === "string") resolve(r); else reject(new Error("read failed")); };
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const thumbUrl = await makeThumbnail(dataUrl);
      accepted.push({ dataUrl, thumbUrl, name: file.name });
    }
    if (accepted.length > 0) setImages((prev) => [...prev, ...accepted]);
  }

  return (
    <div
      className="parchment flex flex-col atlas-shell"
    >
      {/* ─── MESSAGES (page-level scroll now, sticky top bar inside) ─── */}
      <div
        ref={scrollerRef}
        className={cn(
          "flex-1 relative",
          !hasMessages && "flex flex-col justify-center"
        )}
      >
        {/* Fixed Atlas header — sits below fixed mobile top bar, always visible */}
        {hasMessages && (
          <div
            className="fixed left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background/90 backdrop-blur"
            style={{ top: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/40 bg-black shrink-0 shadow-md">
              <img src="/atlas-avatar.jpg" alt="Atlas" className="w-full h-full object-cover" decoding="async" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-bold tracking-[0.14em] leading-none">ATLAS</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] tracking-[0.24em] uppercase text-primary font-semibold">Online · Ready</span>
              </div>
            </div>
            <button
              onClick={() => {
                setMuted((m) => !m);
                setSoundOptedIn(true);
              }}
              className="p-2 rounded-full hover:bg-primary/5 text-muted-foreground shrink-0"
              aria-label={muted ? "Unmute cinematic score" : "Mute cinematic score"}
              data-testid="button-mute-atlas"
              title={muted ? "Score off — 'Goliath' by Scott Buckley (CC-BY 4.0)" : "Score on — 'Goliath' by Scott Buckley (CC-BY 4.0)"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        <div
          className="max-w-2xl w-full mx-auto px-4"
          style={hasMessages ? { paddingTop: "4.25rem" } : undefined}
        >

          {/* ── HERO (no messages) ── */}
          {!hasMessages && (
            <div className="py-6 flex flex-col items-center">
              <div className="relative">
                <div className="absolute -inset-6 rounded-full border border-primary/20 animate-pulse pointer-events-none" />
                <div className="absolute -inset-14 rounded-full border border-primary/10 pointer-events-none" />
                <div className="absolute -inset-24 rounded-full border border-primary/5 pointer-events-none" />
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-primary/30 bg-black shadow-2xl">
                  <img src="/atlas-avatar.jpg" alt="Atlas" className="w-full h-full object-cover" decoding="async" />
                </div>
              </div>

              <h1 className="mt-8 font-display text-5xl sm:text-6xl font-black tracking-[0.16em] leading-none">
                ATLAS
              </h1>

              <p className="mt-4 text-center text-sm text-muted-foreground italic px-6">
                Coach OS · Forging your 195lb frame by March 6, 2027
              </p>

              <div className="mt-5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] tracking-[0.28em] uppercase text-primary font-semibold">
                  Online · Ready
                </span>
              </div>

              {/* Quick-start chips */}
              <div className="mt-8 flex flex-wrap justify-center gap-2 px-2">
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
            </div>
          )}

          {/* ── CONVERSATION ── */}
          {hasMessages && (
            <div
              className="pt-4 space-y-3"
              style={{
                // Space at the bottom so the last message + typing bubble
                // clear the fixed composer (~5rem incl. images) and the tab
                // bar (~3.5rem) plus safe area. Bumped so bubble never clips.
                paddingBottom: "calc(9.5rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40 flex-shrink-0 mr-2 bg-black">
                    <img src="/atlas-avatar.jpg" alt="Atlas" className="w-full h-full object-cover" decoding="async" />
                  </div>
                  <div className="bg-card border border-card-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* ─── INPUT (pinned to viewport bottom via sticky positioning) ─── */}
      <div
        className="fixed left-0 right-0 z-30 border-t border-border/40 bg-background/95 backdrop-blur"
        style={{
          bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "0.25rem",
        }}
      >
        <div className="max-w-2xl mx-auto px-3 pt-2 pb-2">
          {images.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={img.thumbUrl} alt={img.name} className="w-14 h-14 rounded object-cover border border-card-border" />
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
          <div className="flex items-end gap-2 bg-card border border-card-border rounded-2xl px-2 py-1.5 shadow-sm">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-primary/5 flex-shrink-0 self-end"
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
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow up to 5 rows
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Talk to Atlas…"
              rows={1}
              className="flex-1 resize-none bg-transparent focus:outline-none py-2 text-[15px] leading-snug min-h-[36px] max-h-32"
              data-testid="input-atlas-message"
            />
            <button
              onClick={() => submit()}
              disabled={isThinking || (!input.trim() && images.length === 0)}
              className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 flex-shrink-0 self-end transition-opacity"
              data-testid="button-send"
              aria-label="Send"
            >
              {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny inline markdown for Atlas replies (bold, italic, bullets, paragraphs) ───
function renderInline(text: string): (string | JSX.Element)[] {
  const out: (string | JSX.Element)[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={i++} className="font-bold">{m[2]}</strong>);
    else if (m[3]) out.push(<em key={i++}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={i++} className="font-mono text-[13px] bg-muted/50 rounded px-1">{m[4]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MarkdownLite({ content }: { content: string }) {
  // Belt-and-suspenders: strip any leaked ```decisions fenced block (closed or truncated)
  // in case the server-side parser missed it (malformed JSON, missing fence, etc).
  // Also strip AI-slop markdown syntax (headers, hr dividers) that Atlas shouldn't be using.
  const cleaned = content
    .replace(/```decisions\s*\n[\s\S]*?\n```/g, "")
    .replace(/```decisions[\s\S]*$/, "")
    // Kill markdown headers — Atlas speaks like a coach, not a doc writer.
    .replace(/^\s*#{1,6}\s+/gm, "")
    // Kill horizontal rule dividers
    .replace(/^\s*---+\s*$/gm, "")
    // Kill bold/italic markdown wrappers around text — keep the words.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    // Strip leading bullet dashes — keep the line, drop the bullet char.
    .replace(/^\s*[-*+]\s+/gm, "")
    // Strip numbered list prefixes ("1. ", "2. ") — keep the line.
    .replace(/^\s*\d+\.\s+/gm, "")
    // Collapse runs of blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const lines = cleaned.split(/\n/);
  const blocks: JSX.Element[] = [];
  let buffer: string[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {buffer.map((l, i) => (
          <span key={i}>
            {renderInline(l)}
            {i < buffer.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
    buffer = [];
  };
  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    blocks.push(
      <ul key={key++} className="list-disc pl-5 space-y-0.5 my-1">
        {bulletBuffer.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    // Bullets were already stripped by the cleaner above; treat every line as prose.
    if (line.trim() === "") {
      flushParagraph();
      flushBullets();
      continue;
    }
    flushBullets();
    buffer.push(line);
  }
  flushParagraph();
  flushBullets();

  return <div className="space-y-2">{blocks}</div>;
}

// ─── Message bubble + auto-extraction receipt ───
function MessageBubble({ message }: { message: Conversation }) {
  const isUser = message.role === "user";
  const logged = (message.decisions as any)?.logged as Array<{
    type: string;
    summary: string;
    id?: string;
    undoUrl?: string;
  }> | undefined;

  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const doUndo = async (item: { id?: string; undoUrl?: string }, key: string) => {
    if (!item.undoUrl) return;
    await apiRequest("POST", item.undoUrl, { id: item.id });
    setUndone((s) => ({ ...s, [key]: true }));
    queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fitness/overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/logs/recent"] });
  };

  return (
    <div className={cn("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40 flex-shrink-0 bg-black">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source src="/atlas-loop.mp4" type="video/mp4" />
          </video>
        </div>
      )}
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-card border border-card-border text-foreground rounded-bl-sm"
      )}>
        {/* Image thumbnails (user messages with attached photos) */}
        {Array.isArray((message as any).imageUrls) && (message as any).imageUrls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(message as any).imageUrls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`attachment ${i + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-white/20"
                  loading="lazy"
                  decoding="async"
                  width={80}
                  height={80}
                />
              </a>
            ))}
          </div>
        )}
        {isUser
          ? (message.content && !message.content.startsWith("[") && <div className="whitespace-pre-wrap">{message.content}</div>)
          : <MarkdownLite content={message.content} />}
        {logged && logged.length > 0 && (
          <div className="mt-3 pt-3 border-t border-current/10 space-y-1.5">
            <div className="text-[10px] tracking-[0.22em] uppercase font-bold text-primary">
              Logged to Data Center
            </div>
            {logged.map((item, i) => {
              const key = `${message.id}-${i}`;
              const isUndone = undone[key];
              return (
                <div key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className={cn("font-mono", isUndone && "line-through opacity-50")}>
                    {item.summary}
                  </span>
                  {!isUndone && item.undoUrl && (
                    <button
                      onClick={() => doUndo(item, key)}
                      className="px-2 py-1 rounded border border-current/20 hover:bg-current/5 uppercase tracking-wider text-[10px]"
                      data-testid={`button-undo-${i}`}
                    >
                      Undo
                    </button>
                  )}
                  {isUndone && <span className="text-[10px] uppercase opacity-60">Undone</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
