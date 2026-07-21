/**
 * Tyler's Daily Discipline heraldic crest.
 *
 * Composition (all rendered as platinum on charcoal):
 *   - Royal crown at the top (5 points + jewels)
 *   - Shield with rich dark fill
 *   - Roaring lion HEAD centered on the shield (heraldic mask style,
 *     with a flowing mane rendered in radial "sunburst" spikes)
 *   - Twin laurel branches flanking the shield
 *   - Ribbon banner below reading "TYLER'S DAILY DISCIPLINE"
 *
 * We draw the lion as a heraldic mask + sunburst mane rather than a
 * full rampant lion — it reads instantly and works at any size.
 */
export function Crest({
  size = 220,
  withRibbon = true,
  className = "",
}: {
  size?: number;
  withRibbon?: boolean;
  className?: string;
}) {
  const h = withRibbon ? 280 : 220;
  return (
    <svg
      width={size}
      height={(size * h) / 220}
      viewBox={`0 0 220 ${h}`}
      fill="none"
      className={className}
      aria-label="Tyler's Daily Discipline crest"
    >
      <defs>
        <radialGradient id="shieldFill" cx="0.5" cy="0.4" r="0.75">
          <stop offset="0" stopColor="hsl(40 22% 24%)" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="hsl(240 5% 8%)" stopOpacity="0.94" />
          <stop offset="1" stopColor="hsl(240 5% 4%)" stopOpacity="1" />
        </radialGradient>
        <linearGradient id="platStroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(40 22% 94%)" />
          <stop offset="0.5" stopColor="hsl(40 18% 82%)" />
          <stop offset="1" stopColor="hsl(40 14% 62%)" />
        </linearGradient>
        <linearGradient id="platBright" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(40 25% 96%)" />
          <stop offset="1" stopColor="hsl(40 18% 74%)" />
        </linearGradient>
        <radialGradient id="maneGrad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="hsl(40 25% 92%)" />
          <stop offset="0.7" stopColor="hsl(40 18% 78%)" />
          <stop offset="1" stopColor="hsl(40 14% 55%)" />
        </radialGradient>
        <linearGradient id="ribbonFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(40 20% 88%)" />
          <stop offset="0.5" stopColor="hsl(40 16% 78%)" />
          <stop offset="1" stopColor="hsl(40 12% 60%)" />
        </linearGradient>
        <radialGradient id="crestGlow" cx="0.5" cy="0.5" r="0.55">
          <stop offset="0" stopColor="hsl(40 24% 80%)" stopOpacity="0.22" />
          <stop offset="1" stopColor="hsl(40 24% 80%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow */}
      <ellipse cx="110" cy="130" rx="100" ry="115" fill="url(#crestGlow)" />

      {/* CROWN */}
      <g stroke="url(#platStroke)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        {/* Base band */}
        <rect x="76" y="38" width="68" height="8" rx="1" fill="url(#platBright)" fillOpacity="0.32" />
        <line x1="76" y1="46" x2="144" y2="46" strokeOpacity="0.55" />
        {/* Ornate crown outline: 5 points with fleur-like tips */}
        <path
          d="M76 38
             L82 26 L88 32 L94 20 L100 30 L106 16 L110 28 L114 16 L120 30 L126 20 L132 32 L138 26 L144 38 Z"
          fill="url(#platBright)"
          fillOpacity="0.22"
        />
        {/* Jewel dots on point tips */}
        <circle cx="82" cy="26" r="1.4" fill="url(#platBright)" />
        <circle cx="94" cy="20" r="1.6" fill="url(#platBright)" />
        <circle cx="106" cy="16" r="1.7" fill="url(#platBright)" />
        <circle cx="114" cy="16" r="1.7" fill="url(#platBright)" />
        <circle cx="126" cy="20" r="1.6" fill="url(#platBright)" />
        <circle cx="138" cy="26" r="1.4" fill="url(#platBright)" />
        {/* Center gem on the band */}
        <circle cx="110" cy="42" r="2" fill="url(#platBright)" />
      </g>

      {/* SHIELD */}
      <g>
        <path
          d="M60 54 L160 54 L160 118 Q160 162 110 192 Q60 162 60 118 Z"
          fill="url(#shieldFill)"
          stroke="url(#platStroke)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Inner shield line */}
        <path
          d="M66 58 L154 58 L154 118 Q154 158 110 184 Q66 158 66 118 Z"
          fill="none"
          stroke="url(#platStroke)"
          strokeOpacity="0.35"
          strokeWidth="0.8"
        />
      </g>

      {/* LAUREL BRANCHES */}
      <g stroke="url(#platStroke)" strokeWidth="1.2" strokeLinecap="round" fill="none" strokeOpacity="0.85">
        {/* Left */}
        <path d="M52 78 Q34 110 44 162" />
        <path d="M50 88 Q42 92 40 102" />
        <path d="M46 102 Q38 106 36 116" />
        <path d="M42 116 Q34 120 33 130" />
        <path d="M42 130 Q34 134 34 144" />
        <path d="M44 144 Q38 148 40 156" />
        <path d="M55 92 Q49 96 48 106" strokeOpacity="0.5" />
        <path d="M51 106 Q45 110 45 120" strokeOpacity="0.5" />
        <path d="M49 120 Q43 124 43 134" strokeOpacity="0.5" />
        {/* Right */}
        <path d="M168 78 Q186 110 176 162" />
        <path d="M170 88 Q178 92 180 102" />
        <path d="M174 102 Q182 106 184 116" />
        <path d="M178 116 Q186 120 187 130" />
        <path d="M178 130 Q186 134 186 144" />
        <path d="M176 144 Q182 148 180 156" />
        <path d="M165 92 Q171 96 172 106" strokeOpacity="0.5" />
        <path d="M169 106 Q175 110 175 120" strokeOpacity="0.5" />
        <path d="M171 120 Q177 124 177 134" strokeOpacity="0.5" />
      </g>

      {/* LION — heraldic mask (front-facing roar) with big radial mane */}
      <g transform="translate(110 122)">
        {/* Outer mane rays — 32 ragged rays for a fierce silhouette */}
        <g fill="url(#platBright)" stroke="url(#platStroke)" strokeWidth="0.5" strokeLinejoin="round">
          {Array.from({ length: 32 }).map((_, i) => {
            const step = 360 / 32;
            const angle = (i * step * Math.PI) / 180;
            const nextAngle = ((i + 0.5) * step * Math.PI) / 180;
            const prevAngle = ((i - 0.5) * step * Math.PI) / 180;
            const rInner = 28;
            const rTip = i % 2 === 0 ? 48 : 42;
            const tipX = Math.cos(angle) * rTip;
            const tipY = Math.sin(angle) * rTip;
            const leftX = Math.cos(prevAngle) * rInner;
            const leftY = Math.sin(prevAngle) * rInner;
            const rightX = Math.cos(nextAngle) * rInner;
            const rightY = Math.sin(nextAngle) * rInner;
            return (
              <path
                key={i}
                d={`M ${leftX} ${leftY} L ${tipX} ${tipY} L ${rightX} ${rightY} Z`}
                fillOpacity="0.92"
              />
            );
          })}
        </g>

        {/* Inner mane ring — solid platinum disc */}
        <circle r="28" fill="url(#maneGrad)" stroke="url(#platStroke)" strokeWidth="1" />

        {/* Lion FACE — front, symmetric, wide open roar */}
        <g>
          {/* Wide face shape */}
          <path
            d="M -20 -16
               C -22 -22, -14 -26, -8 -24
               C -4 -27, 4 -27, 8 -24
               C 14 -26, 22 -22, 20 -16
               C 24 -10, 24 -2, 22 4
               C 24 12, 18 20, 10 24
               C 6 28, -6 28, -10 24
               C -18 20, -24 12, -22 4
               C -24 -2, -24 -10, -20 -16 Z"
            fill="hsl(40 18% 78%)"
            stroke="url(#platStroke)"
            strokeWidth="0.8"
          />

          {/* Ear tufts */}
          <g fill="url(#platBright)" stroke="url(#platStroke)" strokeWidth="0.5">
            <path d="M -18 -18 L -24 -25 L -14 -22 Z" />
            <path d="M  18 -18 L  24 -25 L  14 -22 Z" />
          </g>

          {/* Fierce brow — angry V-shape */}
          <path
            d="M -18 -10 L -6 -6 L 0 -10 L 6 -6 L 18 -10"
            fill="none"
            stroke="hsl(240 5% 6%)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Eyes — narrowed, aggressive */}
          <path
            d="M -14 -4 Q -10 -6 -6 -4 Q -10 -2 -14 -4 Z"
            fill="hsl(240 5% 6%)"
          />
          <path
            d="M  14 -4 Q  10 -6  6 -4 Q  10 -2  14 -4 Z"
            fill="hsl(240 5% 6%)"
          />
          {/* Amber pupils */}
          <circle cx="-10" cy="-4" r="0.7" fill="hsl(40 80% 65%)" />
          <circle cx=" 10" cy="-4" r="0.7" fill="hsl(40 80% 65%)" />

          {/* Nose bridge */}
          <path
            d="M -2 -2 L -4 4 L 0 7 L 4 4 L 2 -2 Z"
            fill="hsl(40 14% 65%)"
            stroke="hsl(240 5% 6%)"
            strokeWidth="0.6"
          />
          {/* Nose (broad, triangular, black) */}
          <path
            d="M -5 4 L 5 4 L 0 10 Z"
            fill="hsl(240 5% 4%)"
          />

          {/* ROAR — big open mouth showing fangs and tongue */}
          <path
            d="M -13 12
               Q -14 20, -8 25
               Q -4 28, 0 28
               Q 4 28, 8 25
               Q 14 20, 13 12
               Q 8 15, 4 15
               L 2 15
               Q 0 16, -2 15
               L -4 15
               Q -8 15, -13 12 Z"
            fill="hsl(240 5% 4%)"
            stroke="url(#platStroke)"
            strokeWidth="0.7"
          />
          {/* Upper fangs (long, curved) */}
          <path d="M -8 14 L -6.5 22 L -5 14 Z" fill="hsl(40 25% 96%)" />
          <path d="M  8 14 L  6.5 22 L  5 14 Z" fill="hsl(40 25% 96%)" />
          {/* Smaller side teeth */}
          <path d="M -3 14 L -2.5 18 L -2 14 Z" fill="hsl(40 25% 90%)" />
          <path d="M  3 14 L  2.5 18 L  2 14 Z" fill="hsl(40 25% 90%)" />
          {/* Lower fangs */}
          <path d="M -5 22 L -4 26 L -3 22 Z" fill="hsl(40 25% 90%)" />
          <path d="M  5 22 L  4 26 L  3 22 Z" fill="hsl(40 25% 90%)" />
          {/* Tongue */}
          <path
            d="M -3 20 Q 0 26 3 20 Q 3 25 0 26 Q -3 25 -3 20 Z"
            fill="hsl(0 55% 45%)"
            opacity="0.85"
          />

          {/* Whisker dots */}
          <g fill="hsl(240 5% 4%)">
            <circle cx="-14" cy="5" r="0.7" />
            <circle cx="-15" cy="9" r="0.7" />
            <circle cx="-13" cy="12" r="0.7" />
            <circle cx=" 14" cy="5" r="0.7" />
            <circle cx=" 15" cy="9" r="0.7" />
            <circle cx=" 13" cy="12" r="0.7" />
          </g>
          {/* Whisker lines */}
          <g stroke="hsl(240 5% 6%)" strokeWidth="0.4" strokeLinecap="round" strokeOpacity="0.55">
            <path d="M -14 5 L -22 3" />
            <path d="M -15 9 L -24 9" />
            <path d="M -13 12 L -22 14" />
            <path d="M  14 5 L  22 3" />
            <path d="M  15 9 L  24 9" />
            <path d="M  13 12 L  22 14" />
          </g>
        </g>
      </g>

      {/* RIBBON BANNER */}
      {withRibbon && (
        <g>
          {/* Ribbon tails behind */}
          <path d="M 30 218 L 48 210 L 48 232 L 26 238 Z" fill="hsl(40 14% 50%)" stroke="url(#platStroke)" strokeWidth="0.6" />
          <path d="M 190 218 L 172 210 L 172 232 L 194 238 Z" fill="hsl(40 14% 50%)" stroke="url(#platStroke)" strokeWidth="0.6" />
          {/* Ribbon notches (darker inner cut) */}
          <path d="M 43 224 L 50 216 L 50 236 L 43 228 Z" fill="hsl(240 5% 8%)" stroke="url(#platStroke)" strokeWidth="0.6" />
          <path d="M 177 224 L 170 216 L 170 236 L 177 228 Z" fill="hsl(240 5% 8%)" stroke="url(#platStroke)" strokeWidth="0.6" />
          {/* Main banner */}
          <path
            d="M 48 212 L 172 212 Q 178 220 172 236 L 48 236 Q 42 220 48 212 Z"
            fill="url(#ribbonFill)"
            stroke="url(#platStroke)"
            strokeWidth="0.9"
          />
          {/* Inner banner line */}
          <path
            d="M 51 215 L 169 215 Q 174 220 169 233 L 51 233 Q 46 220 51 215 Z"
            fill="none"
            stroke="hsl(240 5% 8%)"
            strokeOpacity="0.3"
            strokeWidth="0.4"
          />
          {/* Text */}
          <text
            x="110"
            y="227"
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize="8.5"
            fontWeight="700"
            letterSpacing="1.3"
            fill="hsl(240 6% 8%)"
          >
            TYLER'S DAILY DISCIPLINE
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * Compact mark for sidebar / favicon.
 * Simplified lion head + tiny crown on top.
 * Uses hex fills (rather than gradient URLs) to avoid ID-collision when
 * multiple marks render on the same page.
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  const PLATINUM = "#E4DFD3";
  const PLAT_DIM = "#B8B0A0";
  const BG = "#17171A";
  const INK = "#0A0A0C";
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-label="TDD">
      <rect x="1" y="1" width="54" height="54" rx="10" fill={BG} stroke={PLAT_DIM} strokeWidth="0.8" />

      {/* Tiny crown */}
      <path
        d="M 18 12 L 21 6 L 25 11 L 28 4 L 31 11 L 35 6 L 38 12 Z"
        fill={PLATINUM}
      />
      <rect x="18" y="12" width="20" height="2" fill={PLATINUM} />

      {/* Mane rays — 12 short spikes around head */}
      <g fill={PLATINUM} transform="translate(28 34)">
        {Array.from({ length: 12 }).map((_, i) => {
          const step = 30;
          const a = (i * step * Math.PI) / 180;
          const a1 = ((i - 0.4) * step * Math.PI) / 180;
          const a2 = ((i + 0.4) * step * Math.PI) / 180;
          const rInner = 9, rTip = 14;
          return (
            <path
              key={i}
              d={`M ${Math.cos(a1) * rInner} ${Math.sin(a1) * rInner} L ${Math.cos(a) * rTip} ${Math.sin(a) * rTip} L ${Math.cos(a2) * rInner} ${Math.sin(a2) * rInner} Z`}
            />
          );
        })}
      </g>

      {/* Face */}
      <g transform="translate(28 34)">
        <circle r="9" fill={PLATINUM} />
        {/* Brow */}
        <path d="M -6 -3 L -2 -2 L 0 -3 L 2 -2 L 6 -3" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Eyes */}
        <circle cx="-3.5" cy="-1" r="1" fill={INK} />
        <circle cx=" 3.5" cy="-1" r="1" fill={INK} />
        {/* Nose */}
        <path d="M -1.6 2 L 1.6 2 L 0 4 Z" fill={INK} />
        {/* Roaring mouth */}
        <path d="M -3 5 Q 0 8.5 3 5 Q 2 7 0 7 Q -2 7 -3 5 Z" fill={INK} />
        {/* Fangs */}
        <path d="M -2 5.5 L -1.5 7 L -1 5.5 Z" fill={PLATINUM} />
        <path d="M 2 5.5 L 1.5 7 L 1 5.5 Z" fill={PLATINUM} />
      </g>
    </svg>
  );
}
