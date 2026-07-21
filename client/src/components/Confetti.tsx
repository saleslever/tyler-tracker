import { useEffect, useRef } from "react";

/**
 * Gold/platinum confetti burst — canvas-based, dependency-free.
 * Fires once when `trigger` changes; auto-cleans up after ~2.5s.
 *
 * Usage:
 *   const [confettiKey, setConfettiKey] = useState(0);
 *   <Confetti trigger={confettiKey} />
 *   // later: setConfettiKey((k) => k + 1);
 */
export function Confetti({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);

    // Gold + platinum palette
    const colors = [
      "hsl(38 85% 60%)",   // gold
      "hsl(38 70% 70%)",   // pale gold
      "hsl(40 15% 88%)",   // platinum
      "hsl(38 90% 50%)",   // deep gold
      "hsl(45 60% 65%)",   // brass
    ];

    type P = {
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rot: number; vrot: number;
      shape: "rect" | "circle";
      life: number;
    };

    const N = 160;
    const parts: P[] = [];
    // Two bursts — from bottom-left and bottom-right toward center-up
    const bursts = [
      { x: w * 0.15, y: h * 0.85 },
      { x: w * 0.85, y: h * 0.85 },
    ];
    bursts.forEach((b) => {
      for (let i = 0; i < N / 2; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6; // mostly upward
        const speed = 8 + Math.random() * 12;
        parts.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 4 + Math.random() * 6,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.3,
          shape: Math.random() > 0.4 ? "rect" : "circle",
          life: 1,
        });
      }
    });

    const gravity = 0.28;
    const drag = 0.992;

    let start = performance.now();
    const durationMs = 2500;

    function frame(t: number) {
      if (!ctx) return;
      const elapsed = t - start;
      const fade = Math.max(0, 1 - elapsed / durationMs);

      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life = fade;

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, w, h);
    };
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
      aria-hidden="true"
    />
  );
}
