// The seabed: the scenery that is always there (sand, rocks, kelp) plus the ten
// decorations a finished trip unlocks. Everything is inline SVG, so the scene
// stays dependency-free and nothing binary ships with the game.
//
// Every sprite is decorative only – it never catches a pointer and never
// reaches assistive tech (see the `aria-hidden` wrappers in SeaScene.jsx).

const BASE = { 'aria-hidden': 'true', focusable: 'false' };

export function Sand() {
  return <svg className="reef-art reef-sand" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d="M0 22 Q 30 8 62 18 Q 96 30 128 18 Q 160 6 196 16 Q 220 22 240 14 L240 40 L0 40 Z" />
  </svg>;
}

export function Rock() {
  return <svg className="reef-art" viewBox="0 0 80 42" {...BASE}>
    <path d="M4 40 Q 8 18 26 14 Q 44 8 60 18 Q 76 26 76 40 Z" />
    <path className="rock-light" d="M22 22 Q 30 16 40 18 Q 32 24 24 30 Z" />
  </svg>;
}

export function Kelp() {
  return <svg className="reef-art" viewBox="0 0 40 84" {...BASE}>
    <path className="kelp-blade" d="M10 82 C 4 60 12 38 6 10" />
    <path className="kelp-blade" d="M22 82 C 18 58 26 40 20 16" />
    <path className="kelp-blade" d="M33 82 C 30 62 36 46 31 26" />
  </svg>;
}

export function Anchor() {
  return <svg className="reef-art" viewBox="0 0 40 52" {...BASE}>
    <circle className="metal" cx="20" cy="8" r="5" />
    <path className="metal-bar" d="M20 13 L20 40" />
    <path className="metal-bar" d="M8 20 L32 20" />
    <path className="metal-bar" d="M20 40 Q 6 40 5 26 M20 40 Q 34 40 35 26" />
  </svg>;
}

export function Starfish() {
  return <svg className="reef-art" viewBox="0 0 40 40" {...BASE}>
    <path d="M20 2 L24.4 13.9 L37.1 14.4 L27.1 22.3 L30.6 34.6 L20 27.5 L9.4 34.6 L12.9 22.3 L2.9 14.4 L15.6 13.9 Z" />
    <circle className="star-dot" cx="20" cy="19" r="2.6" />
  </svg>;
}

export function Coral() {
  return <svg className="reef-art" viewBox="0 0 60 62" {...BASE}>
    <path className="coral-base" d="M8 60 Q 30 50 52 60 Z" />
    <path className="coral-arm" d="M30 58 L30 28" />
    <path className="coral-arm" d="M30 34 C 18 26 13 18 13 8" />
    <path className="coral-arm" d="M30 40 C 43 32 47 22 47 12" />
    <path className="coral-arm" d="M30 46 C 23 42 19 36 19 28" />
  </svg>;
}

export function Shell() {
  return <svg className="reef-art" viewBox="0 0 42 34" {...BASE}>
    <path d="M4 32 C 4 14 21 3 21 3 C 21 3 38 14 38 32 Z" />
    <path className="shell-rib" d="M21 8 L13 32 M21 8 L29 32 M21 6 L21 32" />
  </svg>;
}

export function Seagrass() {
  return <svg className="reef-art" viewBox="0 0 42 78" {...BASE}>
    <path className="kelp-blade" d="M7 76 C 1 56 11 34 4 12" />
    <path className="kelp-blade" d="M19 76 C 14 54 24 36 17 16" />
    <path className="kelp-blade" d="M31 76 C 27 58 35 44 29 24" />
  </svg>;
}

export function Crab() {
  return <svg className="reef-art" viewBox="0 0 48 36" {...BASE}>
    <path className="crab-leg" d="M10 24 L2 32 M38 24 L46 32 M12 28 L5 34 M36 28 L43 34" />
    <ellipse className="crab-body" cx="24" cy="24" rx="15" ry="10" />
    <path className="crab-claw" d="M9 16 Q 2 10 4 4 Q 12 4 13 12 Z" />
    <path className="crab-claw" d="M39 16 Q 46 10 44 4 Q 36 4 35 12 Z" />
    <circle className="crab-eye" cx="18" cy="12" r="3" />
    <circle className="crab-eye" cx="30" cy="12" r="3" />
  </svg>;
}

export function Jellyfish() {
  return <svg className="reef-art" viewBox="0 0 40 58" {...BASE}>
    <path className="jelly-dome" d="M4 26 Q 4 4 20 4 Q 36 4 36 26 Q 20 20 4 26 Z" />
    <path className="jelly-tentacle" d="M12 27 C 8 36 14 42 10 52" />
    <path className="jelly-tentacle" d="M20 28 C 17 38 23 44 19 55" />
    <path className="jelly-tentacle" d="M28 27 C 32 36 26 42 30 52" />
  </svg>;
}

export function Octopus() {
  return <svg className="reef-art" viewBox="0 0 50 50" {...BASE}>
    <path className="octo-head" d="M25 4 Q 42 4 42 22 Q 42 34 25 34 Q 8 34 8 22 Q 8 4 25 4 Z" />
    <path className="octo-arm" d="M12 30 C 4 34 6 44 12 48" />
    <path className="octo-arm" d="M18 32 C 12 38 16 46 22 48" />
    <path className="octo-arm" d="M32 32 C 38 38 34 46 28 48" />
    <path className="octo-arm" d="M38 30 C 46 34 44 44 38 48" />
    <circle className="octo-eye" cx="18" cy="18" r="4" />
    <circle className="octo-eye" cx="32" cy="18" r="4" />
  </svg>;
}

export function Seahorse() {
  return <svg className="reef-art" viewBox="0 0 36 58" {...BASE}>
    <path className="sea-fin" d="M27 18 L35 23 L27 28 Z" />
    <path className="sea-body" d="M20 12 C 31 16 31 28 22 32 C 13 36 13 44 20 48 C 25 51 20 55 15 52" />
    <circle className="sea-head" cx="19" cy="10" r="7.4" />
    <path className="sea-snout" d="M13 11 L2 14" />
    <circle className="sea-eye" cx="20" cy="8" r="1.9" />
  </svg>;
}

export function Wreck() {
  return <svg className="reef-art" viewBox="0 0 120 86" {...BASE}>
    <path className="wreck-sail" d="M57 10 Q 78 16 82 32 L 57 36 Z" />
    <path className="wreck-mast" d="M60 48 L57 8" />
    <path className="wreck-hull" d="M6 46 Q 60 28 114 46 Q 100 78 60 80 Q 20 78 6 46 Z" />
    <path className="wreck-rim" d="M6 46 Q 60 30 114 46 Q 60 41 6 46 Z" />
    <circle className="wreck-hole" cx="40" cy="58" r="7" />
    <circle className="wreck-hole" cx="76" cy="58" r="6" />
    <path className="wreck-weed" d="M22 46 C 18 40 24 34 20 28" />
    <path className="wreck-weed" d="M100 46 C 104 40 98 34 102 28" />
  </svg>;
}

export function Chest() {
  return <svg className="reef-art" viewBox="0 0 62 48" {...BASE}>
    <circle className="coin" cx="12" cy="18" r="4.4" />
    <circle className="coin" cx="22" cy="13" r="3.4" />
    <circle className="coin" cx="50" cy="17" r="3.8" />
    <path className="chest-lid" d="M4 24 Q 4 4 31 4 Q 58 4 58 24 Z" />
    <rect className="chest-body" x="6" y="22" width="50" height="24" rx="4" />
    <path className="chest-band" d="M14 6 L14 46 M48 6 L48 46" />
    <circle className="chest-lock" cx="31" cy="30" r="5.4" />
  </svg>;
}

// Every reward a finished trip can unlock, by id (see REEF_REWARDS in trip.js).
const REEF_ART = {
  starfish: Starfish,
  coral: Coral,
  shell: Shell,
  seagrass: Seagrass,
  crab: Crab,
  jellyfish: Jellyfish,
  octopus: Octopus,
  seahorse: Seahorse,
  wreck: Wreck,
  chest: Chest,
};

// One decoration. An id this version does not draw is simply skipped.
export function ReefArt({ id }) {
  const Art = REEF_ART[id];
  return Art ? <Art /> : null;
}

