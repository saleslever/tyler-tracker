import { cn } from "@/lib/utils";
import type { Rank } from "@/lib/xp";

/**
 * RankShield — an inline SVG heraldic shield that evolves by tier.
 *
 * Composition escalates:
 *   I   Squire     bare shield + tier numeral
 *   II  Warden     + laurel branches on both sides
 *   III Knight     + helm + plume above
 *   IV  Vanguard   + crossed swords behind
 *   V   Baron      + coronet (short crown)
 *   VI  Duke       + tall crown with fleurons
 *   VII King       + full royal crown + rays
 *   VIII Sovereign + full crown + wings + star halo
 *
 * Every tier uses the rank's color for the accent and background.
 * The base shield always shows a fleur-de-lis + a Roman numeral banner.
 */

interface Props {
  rank: Rank;
  size?: number;
  glow?: boolean;
  className?: string;
}

export function RankShield({ rank, size = 88, glow = false, className }: Props) {
  const tier = rank.tier;
  const accent = rank.color;
  const bg = rank.bgColor;
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center shrink-0",
        glow && "animate-rank-glow",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`Rank ${rank.name} — Tier ${rank.numeral}`}
        role="img"
      >
        {/* Tier IV: Crossed swords behind shield */}
        {tier >= 4 && <SwordsBehind accent={accent} />}
        {/* Tier II+: Laurel wreath (both sides) */}
        {tier >= 2 && <Laurels accent={accent} tier={tier} />}
        {/* Base shield body */}
        <Shield bg={bg} accent={accent} />
        {/* Central emblem: fleur-de-lis */}
        <FleurDeLis accent={accent} />
        {/* Roman numeral banner across the belt */}
        <NumeralBanner numeral={rank.numeral} accent={accent} bg={bg} />
        {/* Tier III+: Helm with plume above */}
        {tier >= 3 && tier < 5 && <HelmPlume accent={accent} />}
        {/* Tier V-VI: Coronet / crown */}
        {tier === 5 && <Coronet accent={accent} />}
        {tier === 6 && <DukeCrown accent={accent} />}
        {tier >= 7 && <RoyalCrown accent={accent} />}
        {/* Tier VII+: Rays behind */}
        {tier >= 7 && <Rays accent={accent} />}
        {/* Tier VIII: Wings + star halo */}
        {tier >= 8 && <Wings accent={accent} />}
        {tier >= 8 && <StarHalo accent={accent} />}
      </svg>
    </div>
  );
}

/* ============ SVG components ============ */

function Shield({ bg, accent }: { bg: string; accent: string }) {
  // Classic heater shield with slight inner border.
  return (
    <g>
      <path
        d="M 50 15 L 82 22 L 82 55 Q 82 78 50 92 Q 18 78 18 55 L 18 22 Z"
        fill={bg}
        stroke={accent}
        strokeWidth={2}
      />
      <path
        d="M 50 20 L 78 26 L 78 55 Q 78 74 50 87 Q 22 74 22 55 L 22 26 Z"
        fill="none"
        stroke={accent}
        strokeWidth={0.6}
        opacity={0.5}
      />
    </g>
  );
}

function FleurDeLis({ accent }: { accent: string }) {
  return (
    <g transform="translate(50 47) scale(0.8)" fill={accent}>
      <path d="M 0 -12 Q 3 -6 0 0 Q -3 -6 0 -12 Z" />
      <path d="M 0 -8 Q 10 -4 6 6 Q 2 3 0 -8 Z" />
      <path d="M 0 -8 Q -10 -4 -6 6 Q -2 3 0 -8 Z" />
      <rect x="-9" y="4" width="18" height="2.4" rx="1.2" />
      <circle cx="0" cy="-13" r="2.2" />
    </g>
  );
}

function NumeralBanner({ numeral, accent, bg }: { numeral: string; accent: string; bg: string }) {
  return (
    <g>
      <rect x="30" y="65" width="40" height="14" rx="1.5" fill={bg} stroke={accent} strokeWidth={1.2} />
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontWeight="700"
        fontSize="10"
        fill={accent}
        letterSpacing="1"
      >
        {numeral}
      </text>
    </g>
  );
}

function Laurels({ accent, tier }: { accent: string; tier: number }) {
  // Two curved branches that fatten with tier
  const opacity = 0.7 + Math.min(0.3, (tier - 2) * 0.06);
  return (
    <g opacity={opacity} fill={accent}>
      {/* Left */}
      <g transform="translate(15 55) rotate(-15)">
        <ellipse cx="0" cy="-14" rx="2.4" ry="4.8" />
        <ellipse cx="-2" cy="-7"  rx="2.4" ry="4.8" />
        <ellipse cx="-3" cy="0"   rx="2.4" ry="4.8" />
        <ellipse cx="-2" cy="7"   rx="2.4" ry="4.8" />
        <ellipse cx="0" cy="14"   rx="2.4" ry="4.8" />
      </g>
      {/* Right (mirror) */}
      <g transform="translate(85 55) rotate(15) scale(-1 1)">
        <ellipse cx="0" cy="-14" rx="2.4" ry="4.8" />
        <ellipse cx="-2" cy="-7"  rx="2.4" ry="4.8" />
        <ellipse cx="-3" cy="0"   rx="2.4" ry="4.8" />
        <ellipse cx="-2" cy="7"   rx="2.4" ry="4.8" />
        <ellipse cx="0" cy="14"   rx="2.4" ry="4.8" />
      </g>
    </g>
  );
}

function HelmPlume({ accent }: { accent: string }) {
  return (
    <g>
      {/* Helm dome */}
      <path d="M 40 14 Q 50 6 60 14 L 60 20 L 40 20 Z" fill={accent} opacity={0.85} />
      <line x1="42" y1="17" x2="58" y2="17" stroke="#0b0b0b" strokeWidth={0.8} />
      {/* Plume */}
      <path d="M 50 6 Q 62 -4 66 4 Q 60 8 54 12 Z" fill={accent} opacity={0.9} />
    </g>
  );
}

function Coronet({ accent }: { accent: string }) {
  // Short coronet — a band with three fleurons
  return (
    <g fill={accent}>
      <rect x="34" y="12" width="32" height="4" rx="0.6" />
      <path d="M 40 12 L 42 6 L 44 12 Z" />
      <path d="M 48 12 L 50 4 L 52 12 Z" />
      <path d="M 56 12 L 58 6 L 60 12 Z" />
    </g>
  );
}

function DukeCrown({ accent }: { accent: string }) {
  // Taller crown with pointed fleurons
  return (
    <g fill={accent}>
      <rect x="32" y="12" width="36" height="5" rx="0.6" />
      <circle cx="36" cy="12" r="1.2" />
      <circle cx="44" cy="12" r="1.2" />
      <circle cx="50" cy="12" r="1.2" />
      <circle cx="56" cy="12" r="1.2" />
      <circle cx="64" cy="12" r="1.2" />
      <path d="M 36 12 L 38 4  L 40 12 Z" />
      <path d="M 44 12 L 46 2  L 48 12 Z" />
      <path d="M 52 12 L 54 2  L 56 12 Z" />
      <path d="M 60 12 L 62 4  L 64 12 Z" />
    </g>
  );
}

function RoyalCrown({ accent }: { accent: string }) {
  // Full crown with cross on top
  return (
    <g fill={accent}>
      <path d="M 30 14 L 34 4 L 42 12 L 50 0 L 58 12 L 66 4 L 70 14 Z" />
      <rect x="30" y="14" width="40" height="4" />
      {/* Cross above */}
      <rect x="48" y="-4" width="4" height="8" />
      <rect x="46" y="-1" width="8" height="2.5" />
      {/* Jewels */}
      <circle cx="42" cy="16" r="1.2" fill="#0b0b0b" />
      <circle cx="50" cy="16" r="1.2" fill="#0b0b0b" />
      <circle cx="58" cy="16" r="1.2" fill="#0b0b0b" />
    </g>
  );
}

function SwordsBehind({ accent }: { accent: string }) {
  return (
    <g opacity={0.55} stroke={accent} strokeWidth={1.2} strokeLinecap="round">
      <line x1="18" y1="20" x2="82" y2="88" />
      <line x1="82" y1="20" x2="18" y2="88" />
      {/* Pommels */}
      <circle cx="18" cy="20" r="1.6" fill={accent} />
      <circle cx="82" cy="20" r="1.6" fill={accent} />
      {/* Guards */}
      <line x1="14" y1="24" x2="22" y2="16" strokeWidth={1.6} />
      <line x1="78" y1="16" x2="86" y2="24" strokeWidth={1.6} />
    </g>
  );
}

function Rays({ accent }: { accent: string }) {
  return (
    <g opacity={0.45} stroke={accent} strokeWidth={0.8}>
      {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((deg, i) => (
        <line
          key={i}
          x1="50"
          y1="50"
          x2="50"
          y2="4"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </g>
  );
}

function Wings({ accent }: { accent: string }) {
  return (
    <g fill={accent} opacity={0.75}>
      {/* Left wing */}
      <path d="M 18 40 Q -4 46 -2 60 Q 8 52 18 52 Z" />
      <path d="M 18 46 Q 0 54 4 66 Q 12 58 18 58 Z" />
      {/* Right wing */}
      <path d="M 82 40 Q 104 46 102 60 Q 92 52 82 52 Z" />
      <path d="M 82 46 Q 100 54 96 66 Q 88 58 82 58 Z" />
    </g>
  );
}

function StarHalo({ accent }: { accent: string }) {
  const stars = [
    { x: 12, y: 10, s: 2.2 },
    { x: 50, y: -2, s: 3.0 },
    { x: 88, y: 10, s: 2.2 },
  ];
  return (
    <g fill={accent}>
      {stars.map((s, i) => (
        <path
          key={i}
          d={`M ${s.x} ${s.y - s.s} L ${s.x + s.s * 0.3} ${s.y - s.s * 0.3} L ${s.x + s.s} ${s.y} L ${s.x + s.s * 0.3} ${s.y + s.s * 0.3} L ${s.x} ${s.y + s.s} L ${s.x - s.s * 0.3} ${s.y + s.s * 0.3} L ${s.x - s.s} ${s.y} L ${s.x - s.s * 0.3} ${s.y - s.s * 0.3} Z`}
        />
      ))}
    </g>
  );
}
