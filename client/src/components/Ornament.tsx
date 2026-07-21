/**
 * Heraldic fleuron ornament — a small SVG divider used between ritual sections.
 * Amber gold color, ~24-32px tall, purely decorative.
 */
export function Fleuron({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ color: "hsl(38 65% 55%)" }}
      >
        {/* central diamond */}
        <path
          d="M16 6 L20 16 L16 26 L12 16 Z"
          fill="currentColor"
          fillOpacity="0.7"
        />
        {/* left leaf */}
        <path
          d="M4 16 Q9 12 12 16 Q9 20 4 16 Z"
          fill="currentColor"
          fillOpacity="0.5"
        />
        {/* right leaf */}
        <path
          d="M28 16 Q23 12 20 16 Q23 20 28 16 Z"
          fill="currentColor"
          fillOpacity="0.5"
        />
        {/* center dot */}
        <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      </svg>
      <div className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
    </div>
  );
}

/**
 * A small standalone gold laurel/quill-style corner accent.
 * Used inside cards to hint at heraldic language without dominating.
 */
export function CornerFlourish({ position = "tl" }: { position?: "tl" | "tr" | "bl" | "br" }) {
  const posClass =
    position === "tl" ? "top-3 left-3" :
    position === "tr" ? "top-3 right-3" :
    position === "bl" ? "bottom-3 left-3" :
    "bottom-3 right-3";
  const rotate =
    position === "tl" ? "" :
    position === "tr" ? "rotate-90" :
    position === "br" ? "rotate-180" :
    "-rotate-90";
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24" fill="none"
      className={`absolute ${posClass} ${rotate} pointer-events-none`}
      style={{ color: "hsl(38 55% 55% / 0.6)" }}
      aria-hidden="true"
    >
      <path d="M2 12 Q6 4 12 2" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M2 12 Q6 8 10 8" stroke="currentColor" strokeWidth="0.6" fill="none" opacity="0.6" />
      <circle cx="2" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="2" r="1" fill="currentColor" />
    </svg>
  );
}
