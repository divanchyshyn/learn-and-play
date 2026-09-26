import { paint } from './SeaArtDefs.jsx';
import { Kelp } from './SeaFloor.jsx';

// The water itself: the surface line with its crests, the light that falls
// through it, drifting snow, the kelp at the edge, and a dim shoal far away.
//
// The surface is the one stretched drawing in the scene: a wave crest is an
// abstract line, so letting it stretch across the sea box costs nothing. The
// sun keeps its round shape because it is a CSS sprite in the sky band.

function waveBand({ from, amp, step = 150, width = 1200, depth = 46 }) {
  let d = `M0 ${from + amp} Q ${step / 2} ${from - amp} ${step} ${from}`;
  for (let x = step; x < width; x += step) d += ` T ${x + step} ${from}`;
  return `${d} L${width} ${depth} L0 ${depth} Z`;
}

export function WaveLine() {
  return <svg className="sea-waves" viewBox="0 0 1200 46" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className="wave-shadow" d={waveBand({ from: 16, amp: 7 })} />
    <path className="wave-crest" d={waveBand({ from: 10, amp: 6, step: 150 })} fill={paint('wave-crest')} />
    <path className="wave-foam" d={waveBand({ from: 7, amp: 4, step: 300 })} fill={paint('foam')} opacity=".7" />
  </svg>;
}

const SNOW = [
  { left: 7, size: 5, delay: 0, duration: 15 },
  { left: 15, size: 3, delay: 4, duration: 19 },
  { left: 26, size: 4, delay: 8, duration: 16 },
  { left: 34, size: 2, delay: 2, duration: 21 },
  { left: 45, size: 5, delay: 11, duration: 17 },
  { left: 54, size: 3, delay: 6, duration: 20 },
  { left: 63, size: 4, delay: 13, duration: 15 },
  { left: 72, size: 2, delay: 3, duration: 22 },
  { left: 81, size: 5, delay: 9, duration: 18 },
  { left: 90, size: 3, delay: 5, duration: 16 },
  { left: 96, size: 4, delay: 12, duration: 19 },
];

// Marine snow: the small drifting motes that make deep water look like water.
export function MarineSnow() {
  return <div className="sea-snow" aria-hidden="true">
    {SNOW.map((flake, index) => <span
      className="snow-flake"
      key={index}
      style={{
        left: `${flake.left}%`,
        width: `${flake.size}px`,
        height: `${flake.size}px`,
        animationDelay: `${flake.delay}s`,
        animationDuration: `${flake.duration}s`,
      }}
    />)}
  </div>;
}

// A shoal far away: pale, blurry fish that swim where the water is deep, outside
// everything the child can reach.
export function DistantShoal() {
  return <svg className="sea-shoal" viewBox="0 0 220 96" aria-hidden="true" focusable="false">
    <g className="shoal-fish shoal-fish-1"><path d="M0 40 Q 14 30 28 40 Q 14 50 0 40 Z" /><path d="M0 40 L-9 33 L-9 47 Z" /></g>
    <g className="shoal-fish shoal-fish-2"><path d="M6 62 Q 18 53 30 62 Q 18 71 6 62 Z" /><path d="M6 62 L-2 56 L-2 68 Z" /></g>
    <g className="shoal-fish shoal-fish-3"><path d="M22 26 Q 32 19 42 26 Q 32 33 22 26 Z" /><path d="M22 26 L16 21 L16 31 Z" /></g>
    <g className="shoal-fish shoal-fish-4"><path d="M40 78 Q 54 68 68 78 Q 54 88 40 78 Z" /><path d="M40 78 L31 71 L31 85 Z" /></g>
    <g className="shoal-fish shoal-fish-5"><path d="M58 46 Q 68 39 78 46 Q 68 53 58 46 Z" /><path d="M58 46 L52 41 L52 51 Z" /></g>
  </svg>;
}

// Light that reaches down from the surface: four soft fans that never move the
// page, they only shimmer in place.
export function GodRays() {
  return <>
    <span className="sea-beam beam-a" />
    <span className="sea-beam beam-b" />
    <span className="sea-beam beam-c" />
    <span className="sea-beam beam-d" />
  </>;
}

export function WaterBody() {
  return <div className="sea-water" aria-hidden="true">
    <GodRays />
    <DistantShoal />
    <MarineSnow />
    <span className="lake-kelp kelp-a"><Kelp /></span>
    <span className="lake-kelp kelp-b"><Kelp /></span>
    <span className="lake-kelp kelp-c"><Kelp /></span>
  </div>;
}
