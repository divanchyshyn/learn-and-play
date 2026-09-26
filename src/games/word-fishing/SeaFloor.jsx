import { paint } from './SeaArtDefs.jsx';

// The seabed that is always there, whoever is fishing: layered sand with ripples,
// a rock cluster with weed, kelp at the edges, the old anchor lying on its side,
// a piece of driftwood, and a scatter of stones.
//
// The sand is the second stretched drawing in the scene (its dune lines are
// abstract, so stretching them costs nothing), while the grain, the light
// dapples and the pebbles are CSS tiles: a CSS tile stays round where a pattern
// inside a stretched drawing would be squashed into ellipses.
//
// Every sprite here is decorative, never focusable and never read out.

const BASE = { 'aria-hidden': 'true', focusable: 'false' };

export function SandFloor() {
  return <div className="sea-bed" aria-hidden="true">
    <svg className="sand-far" viewBox="0 0 1200 120" preserveAspectRatio="none" focusable="false">
      <path d="M0 52 Q 170 18 350 38 Q 520 56 700 30 Q 880 6 1050 32 Q 1130 44 1200 34 L1200 120 L0 120 Z" fill={paint('sand-deep')} opacity=".7" />
    </svg>
    <svg className="sand-main" viewBox="0 0 1200 120" preserveAspectRatio="none" focusable="false">
      <path
        d="M0 44 Q 140 10 300 30 Q 450 48 600 26 Q 760 2 920 26 Q 1040 42 1200 26 L1200 120 L0 120 Z"
        fill={paint('sand')}
      />
      <path
        className="sand-ridge"
        d="M0 44 Q 140 10 300 30 Q 450 48 600 26 Q 760 2 920 26 Q 1040 42 1200 26 Q 1050 44 900 40 Q 740 20 600 42 Q 450 62 300 46 Q 150 28 0 58 Z"
        fill={paint('sand-ridge')}
        opacity=".75"
      />
      <path className="sand-ripple" d="M60 66 Q 200 54 340 66" />
      <path className="sand-ripple" d="M420 88 Q 560 78 700 88" />
      <path className="sand-ripple" d="M840 62 Q 980 52 1120 62" />
      <path className="sand-ripple sand-ripple-faint" d="M180 96 Q 300 88 420 96" />
      <path className="sand-ripple sand-ripple-faint" d="M760 104 Q 880 96 1000 104" />
    </svg>
    <span className="sand-grain" />
    <span className="sand-light" />
  </div>;
}

// Kelp grows from the sand: three blades with a midrib each, so it reads as a
// plant and not as a green line.
export function Kelp() {
  return <svg className="reef-art" viewBox="0 0 44 92" {...BASE}>
    <path d="M13 92 C 3 74 15 58 7 40 C 2 28 7 14 13 4 C 20 16 22 30 17 44 C 11 60 23 76 13 92 Z" fill={paint('weed')} />
    <path d="M27 92 C 20 78 30 64 24 48 C 20 38 24 26 29 18 C 35 28 36 40 32 50 C 27 64 36 78 27 92 Z" fill={paint('weed-dark')} opacity=".92" />
    <path d="M38 92 C 33 80 41 68 36 56 C 33 48 36 38 40 32 C 45 40 46 50 43 58 C 39 70 46 80 38 92 Z" fill={paint('weed')} opacity=".85" />
    <path className="kelp-mid" d="M13 88 C 8 72 15 58 11 42 C 8 30 11 18 13 8" />
    <path className="kelp-mid" d="M28 88 C 24 76 31 62 27 50 C 23 40 26 30 29 22" />
    <ellipse className="kelp-root" cx="18" cy="90" rx="13" ry="3.6" />
  </svg>;
}

export function RockCluster() {
  return <svg className="reef-art" viewBox="0 0 140 72" {...BASE}>
    <path d="M62 70 Q 64 42 82 32 Q 102 22 118 40 Q 130 54 128 70 Z" fill={paint('rock-dark')} />
    <path d="M4 70 Q 6 40 30 30 Q 56 20 70 42 Q 78 54 76 70 Z" fill={paint('rock')} />
    <path className="rock-face" d="M20 48 Q 32 34 50 40 Q 40 52 30 66 Q 24 58 20 48 Z" fill={paint('rock-light')} opacity=".55" />
    <path className="rock-crack" d="M46 32 Q 54 46 44 60" />
    <path className="rock-crack" d="M104 34 Q 112 48 104 62" />
    <path d="M86 70 Q 88 58 102 58 Q 118 58 122 70 Z" fill={paint('rock')} opacity=".95" />
    <path className="rock-moss" d="M8 68 Q 18 52 36 50 Q 24 60 22 70 Z" fill={paint('moss')} opacity=".85" />
    <path className="rock-moss" d="M96 68 Q 106 56 120 56 Q 110 62 108 70 Z" fill={paint('moss')} opacity=".6" />
    <path className="reef-weed" d="M122 68 C 132 56 122 46 132 34" />
    <path className="reef-weed" d="M116 70 C 122 60 114 52 120 42" />
    <circle className="reef-shell-dot" cx="64" cy="70" r="2.6" />
    <circle className="reef-shell-dot" cx="78" cy="70" r="2" />
  </svg>;
}

export function Stones() {
  return <svg className="reef-art" viewBox="0 0 150 40" {...BASE}>
    <ellipse cx="20" cy="30" rx="15" ry="9" fill={paint('pebble')} />
    <ellipse cx="56" cy="33" rx="10" ry="6" fill={paint('pebble')} opacity=".9" />
    <ellipse cx="86" cy="31" rx="17" ry="8" fill={paint('pebble')} />
    <ellipse cx="124" cy="33" rx="11" ry="5.6" fill={paint('pebble')} opacity=".85" />
    <path className="stone-gleam" d="M12 24 Q 20 20 28 25" />
    <path className="stone-gleam" d="M78 25 Q 86 21 94 26" />
  </svg>;
}

export function Driftwood() {
  return <svg className="reef-art" viewBox="0 0 118 34" {...BASE}>
    <path d="M4 26 Q 30 12 62 16 Q 92 20 114 12 Q 112 24 96 28 Q 60 34 26 32 Q 12 31 4 26 Z" fill={paint('driftwood')} />
    <path className="log-end" d="M96 16 Q 112 14 114 12 Q 113 20 100 22 Z" fill={paint('wood-deep')} opacity=".8" />
    <path className="log-line" d="M14 26 Q 44 16 74 20 Q 94 23 108 17" />
    <path d="M46 18 Q 50 4 62 3 Q 60 12 56 19 Z" fill={paint('driftwood')} />
    <circle className="log-knot" cx="34" cy="23" r="3.2" />
    <path className="reef-weed" d="M20 24 C 12 18 20 10 12 4" />
    <path className="reef-weed" d="M84 22 C 78 16 86 10 80 6" />
    <circle className="barnacle" cx="64" cy="20" r="2" />
    <circle className="barnacle" cx="72" cy="22" r="1.6" />
  </svg>;
}

export function Anchor() {
  return <svg className="reef-art" viewBox="0 0 64 88" {...BASE}>
    <circle className="anchor-ring" cx="32" cy="13" r="7" />
    <path className="anchor-shank" d="M32 20 L32 64" />
    <path className="anchor-stock" d="M12 30 Q 32 26 52 30" />
    <path className="anchor-arm" d="M32 66 C 16 66 6 56 4 40" />
    <path className="anchor-arm" d="M32 66 C 48 66 58 56 60 40" />
    <path className="anchor-fluke" d="M4 40 L-2 26 L18 32 Z" />
    <path className="anchor-fluke" d="M60 40 L66 26 L46 32 Z" />
    <path className="anchor-shine" d="M29 24 L29 60" />
    <path className="anchor-shine" d="M17 30 Q 32 28 47 30" />
    <path className="reef-weed" d="M20 44 C 12 36 22 26 14 18" />
    <path className="reef-weed" d="M46 52 C 54 44 44 36 52 26" />
    <circle className="barnacle" cx="38" cy="56" r="2.4" />
    <circle className="barnacle" cx="24" cy="52" r="1.8" />
    <circle className="barnacle" cx="34" cy="40" r="1.6" />
  </svg>;
}


