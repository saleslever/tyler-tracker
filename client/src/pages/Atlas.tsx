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
import { Loader2, Send, Paperclip, X } from "lucide-react";
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
  const [pendingUserMsg, setPendingUserMsg] = useState<{ content: string; images: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      setPendingUserMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/overview"] });
    },
    onError: () => {
      // On error, restore the text so the user doesn't lose it
      if (pendingUserMsg) setInput(pendingUserMsg.content);
      setPendingUserMsg(null);
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
        createdAt: new Date().toISOString(),
      }]
    : serverMessages;
  const isThinking = sendMutation.isPending;
  const hasMessages = messages.length > 0;

  // Auto-scroll to bottom whenever messages or thinking state changes
  useEffect(() => {
    const el = bottomRef.current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  // On first load with existing messages, jump straight to bottom (no smooth)
  useEffect(() => {
    if (serverMessages.length > 0 && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationQuery.isSuccess]);

  function submit(msg?: string) {
    const trimmed = (msg ?? input).trim();
    if (sendMutation.isPending) return;
    if (!trimmed && images.length === 0) return;
    const imageDataUrls = images.map(i => i.dataUrl);
    // Clear input IMMEDIATELY and show user bubble optimistically
    setPendingUserMsg({ content: trimmed, images: imageDataUrls });
    setInput("");
    setImages([]);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMutation.mutate({ message: trimmed, imageDataUrls });
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
    <div
      className="parchment flex flex-col overflow-hidden atlas-shell"
    >
      {/* ─── MESSAGES SCROLLER (with sticky top bar inside) ─── */}
      <div
        ref={scrollerRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-contain relative",
          !hasMessages && "flex flex-col justify-center"
        )}
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as any}
      >
        {/* Sticky Atlas header — stays visible while scrolling */}
        {hasMessages && (
          <div
            className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background/90 backdrop-blur"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/40 bg-black shrink-0 shadow-md">
              <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                <source src="/atlas-loop.mp4" type="video/mp4" />
              </video>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-bold tracking-[0.14em] leading-none">ATLAS</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] tracking-[0.24em] uppercase text-primary font-semibold">Online · Ready</span>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl w-full mx-auto px-4">

          {/* ── HERO (no messages) ── */}
          {!hasMessages && (
            <div className="py-6 flex flex-col items-center">
              <div className="relative">
                <div className="absolute -inset-6 rounded-full border border-primary/20 animate-pulse pointer-events-none" />
                <div className="absolute -inset-14 rounded-full border border-primary/10 pointer-events-none" />
                <div className="absolute -inset-24 rounded-full border border-primary/5 pointer-events-none" />
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-primary/30 bg-black shadow-2xl">
                  <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                    <source src="/atlas-loop.mp4" type="video/mp4" />
                  </video>
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
            <div className="py-4 space-y-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40 flex-shrink-0 mr-2 bg-black">
                    <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                      <source src="/atlas-loop.mp4" type="video/mp4" />
                    </video>
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

      {/* ─── INPUT (pinned) ─── */}
      <div
        className="flex-shrink-0 border-t border-border/40 bg-background/95 backdrop-blur"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="max-w-2xl mx-auto px-3 pt-2 pb-2">
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
  const lines = content.split(/\n/);
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
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      bulletBuffer.push(bullet[1]);
      continue;
    }
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
        {isUser
          ? <div className="whitespace-pre-wrap">{message.content}</div>
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
