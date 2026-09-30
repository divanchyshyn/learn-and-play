import { PHOTOS } from './photos.js';

// The water itself: a photograph of the water column with the light falling in
// from the surface at the top, the surface line as a repeating strip of real
// water, the sun's own light caught by that surface, drifting marine snow, and a
// dim shoal far away. The weed is not in here: it grows at the front of the stage
// and is painted over the sand (see ForegroundWeed in SeaFloor.jsx).
//
// The water plate is pasted with `cover`, anchored to its top edge, so the sunlit
// surface stays where the surface strip puts the waterline, and neither the plate
// nor the strip is ever stretched. The strip repeats sideways – its own two halves
// are mirrors of each other (see the asset pipeline) – and it stays still, because
// that band is the horizon: the water out there is the furthest in the scene and
// travels nowhere in view. What moves on the line is the light on it, not the water
// (see style.css).

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

// A shoal far away: pale fish that swim where the water is deep, outside
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
  return <div
    className="sea-water"
    aria-hidden="true"
    style={{ '--water-photo': `url(${PHOTOS.water})` }}
  >
    <span className="water-depth" />
    <GodRays />
    <DistantShoal />
    <MarineSnow />
  </div>;
}

// The surface: a strip of real water, repeated sideways so it spans a sea that is
// many tiles wide, with its own two edges faded into the sky above and the water
// below (see style.css). It is the only strip in the scene, and it is what tells a
// child where the water starts. It never moves: this is the sea's own furthest
// water, on the horizon, and a waterline that travelled sideways would read as a
// current running past the boat, however slowly it went.
//
// Its picture is the sea just below the horizon, so it holds no sky and, above
// all, no sun: the sun belongs to the sky plate above, and a repeated strip that
// carried its own sun would print a row of suns right across the waterline. Its
// two halves are mirrors of each other (see the asset pipeline), so the repeat has
// no seam, in the tile or at the wrap.
export function WaveLine() {
  return <span
    className="sea-waves"
    aria-hidden="true"
    style={{ '--surface-photo': `url(${PHOTOS.surface})` }}
  />;
}

// The sun's light caught by that surface: a warm wash with a small pale core, both
// straddling the waterline. It is the one layer that belongs to no photograph - it
// exists because the sky plate's sun and the water plate's bright column are the
// same light, and the strip between them cannot carry it across the line on its
// own. It sits over the strip and under everything that floats on the water (see
// style.css), and it stays exactly where it is: the one thing that moves up there
// is its own brightness, a slow breathe of light, which is how real glare behaves.
export function SurfaceGlint() {
  return <span className="sea-glint" aria-hidden="true" />;
}
