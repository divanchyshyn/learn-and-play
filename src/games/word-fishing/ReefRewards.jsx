import { paint } from './SeaArtDefs.jsx';

// The treasures the seabed grows: one finished trip, one discovery. Sixteen of
// them, from the starfish a child meets first to the sunken station that ends the
// collection. Each is a small scene rather than a glyph – the wreck has ribs, a
// snapped mast and cargo spilling out, the submarine has lit portholes and a
// turning propeller, the station has a docked mini-sub – because this is the
// reward the child keeps coming back for.
//
// Everything is inline SVG painted from the shared paints (SeaArtDefs.jsx), the
// class names carry the motion in style.css, and every sprite is decorative: it
// never catches a pointer and never reaches assistive tech.

const BASE = { 'aria-hidden': 'true', focusable: 'false' };

export function Starfish() {
  return <svg className="reef-art" viewBox="0 0 62 62" {...BASE}>
    <path className="star-arms" d="M31 5 L37.5 23 L57 23.5 L42 35 L47.5 54 L31 43 L14.5 54 L20 35 L5 23.5 L24.5 23 Z" fill={paint('star-body')} stroke={paint('star-body')} strokeWidth="5" strokeLinejoin="round" />
    <path className="star-belly" d="M31 16 L34.6 26.6 L46 27 L37 34.4 L40 46.4 L31 39.6 L22 46.4 L25 34.4 L16 27 L27.4 26.6 Z" fill={paint('star-belly')} opacity=".9" />
    <path className="star-ridge" d="M31 31 L31 10 M31 31 L54 24 M31 31 L44 52 M31 31 L18 52 M31 31 L8 24" />
    <circle className="star-centre" cx="31" cy="31" r="5.6" fill={paint('star-belly')} />
    <circle className="star-bump" cx="31" cy="17" r="1.7" />
    <circle className="star-bump" cx="31" cy="24" r="1.4" />
    <circle className="star-bump" cx="43" cy="28" r="1.6" />
    <circle className="star-bump" cx="49" cy="23" r="1.3" />
    <circle className="star-bump" cx="38" cy="43" r="1.5" />
    <circle className="star-bump" cx="24" cy="43" r="1.5" />
    <circle className="star-bump" cx="13" cy="23" r="1.3" />
    <circle className="star-bump" cx="19" cy="28" r="1.6" />
  </svg>;
}

export function Coral() {
  return <svg className="reef-art" viewBox="0 0 100 100" {...BASE}>
    <path className="coral-base" d="M14 92 Q 32 78 50 82 Q 70 78 88 92 Q 70 100 50 100 Q 30 100 14 92 Z" fill={paint('coral-bud')} opacity=".55" />
    <path className="coral-branch" d="M50 92 C 44 72 30 66 22 48" />
    <path className="coral-branch" d="M50 92 C 54 70 68 62 74 40" />
    <path className="coral-branch" d="M50 92 C 48 74 50 60 49 30" />
    <path className="coral-branch coral-twig" d="M38 74 C 30 66 30 54 24 46" />
    <path className="coral-branch coral-twig" d="M62 70 C 70 62 70 52 76 44" />
    <path className="coral-branch coral-twig" d="M50 62 C 58 56 59 44 64 34" />
    <path className="coral-branch coral-twig" d="M50 58 C 42 50 41 40 36 30" />
    <circle className="coral-tip" cx="22" cy="47" r="5" fill={paint('coral-bud')} />
    <circle className="coral-tip" cx="74" cy="39" r="5" fill={paint('coral-bud')} />
    <circle className="coral-tip" cx="49" cy="28" r="5.4" fill={paint('coral-bud')} />
    <circle className="coral-tip" cx="24" cy="45" r="3.2" fill={paint('coral-bud')} opacity=".9" />
    <circle className="coral-tip" cx="76" cy="43" r="3.2" fill={paint('coral-bud')} opacity=".9" />
    <circle className="coral-tip" cx="64" cy="33" r="3.4" fill={paint('coral-bud')} opacity=".9" />
    <circle className="coral-tip" cx="36" cy="29" r="3.4" fill={paint('coral-bud')} opacity=".9" />
    <circle className="coral-polyp" cx="30" cy="58" r="1.8" />
    <circle className="coral-polyp" cx="36" cy="72" r="1.6" />
    <circle className="coral-polyp" cx="68" cy="56" r="1.8" />
    <circle className="coral-polyp" cx="62" cy="76" r="1.6" />
    <circle className="coral-polyp" cx="46" cy="46" r="1.7" />
    <circle className="coral-polyp" cx="54" cy="40" r="1.5" />
    <circle className="reef-bubble" cx="86" cy="66" r="2.4" />
    <circle className="reef-bubble" cx="90" cy="56" r="1.6" />
  </svg>;
}

// The wreck: the first big discovery, and the one the collection is built around.
export function Wreck() {
  return <svg className="reef-art" viewBox="0 0 170 112" {...BASE}>
    {/* Timbers broken off above the hull, so she reads as a ship and not as a
        rock: pale weathered wood, thick where it snapped. */}
    <path className="wreck-rib-line" d="M24 26 L26 54 M54 14 L52 50 M88 10 L86 46 M120 14 L118 48 M154 22 L152 52" />
    <path className="wreck-rib-tip" d="M24 26 L19 17 M54 14 L52 4 M88 10 L90 1 M120 14 L122 5 M154 22 L158 13" />
    {/* The broken hull, torn open between the two halves. */}
    <path className="wreck-hull" d="M4 68 C 26 50 56 42 88 46 L 96 40 C 122 42 150 50 166 64 C 160 92 128 106 84 106 C 42 106 8 92 4 68 Z" fill={paint('wreck-hull')} />
    {/* Her own frames, sweeping down the inside of the planking. */}
    <path className="wreck-frame" d="M30 52 C 40 68 46 84 48 100 M66 44 C 70 66 72 86 70 102 M104 44 C 102 66 100 86 98 102 M142 52 C 138 68 134 84 130 100" />
    <path className="wreck-rim" d="M4 66 C 26 48 58 40 86 44 C 92 34 102 32 108 42 C 130 44 152 52 166 62 C 148 54 126 48 104 46 C 100 52 92 54 86 48 C 58 46 28 54 4 66 Z" fill={paint('wreck-rib')} />
    <path className="wreck-plank" d="M10 78 C 40 62 74 58 106 62 C 128 64 150 70 164 78" />
    <path className="wreck-plank" d="M12 88 C 42 74 76 70 108 74 C 130 76 152 82 162 90" />
    <path className="wreck-plank" d="M18 98 C 46 86 78 82 108 86 C 130 88 148 93 156 100" />
    {/* The hole that sank her, and the portholes still holding their glass. */}
    <path className="wreck-hole" d="M40 74 C 52 64 68 68 70 82 C 72 96 54 102 44 94 C 34 86 30 80 40 74 Z" fill="#2a231d" />
    <path className="wreck-hole-rim" d="M40 74 C 52 64 68 68 70 82 C 72 96 54 102 44 94" />
    <circle className="wreck-porthole" cx="26" cy="86" r="7.6" fill={paint('wreck-glass')} />
    <circle className="wreck-porthole-rim" cx="26" cy="86" r="7.6" />
    <circle className="wreck-porthole" cx="132" cy="74" r="6.6" fill={paint('wreck-glass')} />
    <circle className="wreck-porthole-rim" cx="132" cy="74" r="6.6" />
    <circle className="wreck-porthole" cx="112" cy="80" r="5.6" fill={paint('wreck-glass')} />
    <circle className="wreck-porthole-rim" cx="112" cy="80" r="5.6" />
    {/* The snapped mast, leaning overboard with a scrap of sail. */}
    <path className="wreck-mast" d="M120 50 L152 8" />
    <path className="wreck-mast-splinter" d="M150 10 L160 2 M152 12 L163 10" />
    <path className="wreck-sail" d="M150 10 C 164 18 168 30 165 42 L 140 30 Z" fill={paint('hull-band')} opacity=".45" />
    <path className="wreck-yard" d="M62 58 L112 46" />
    {/* Cargo that spilled out of her: a barrel, a crate, and gold. */}
    <ellipse className="wreck-barrel" cx="16" cy="92" rx="13" ry="10" fill={paint('wood')} />
    <path className="wreck-barrel-hoop" d="M4 88 C 10 84 22 84 28 88 M4 96 C 10 99 22 99 28 96" />
    <path className="wreck-crate" d="M148 88 L166 90 L166 102 L148 100 Z" fill={paint('wood-deep')} />
    <path className="wreck-crate-line" d="M148 94 L166 96 M155 89 L155 101" />
    <circle className="wreck-coin" cx="50" cy="100" r="3.4" fill={paint('coin')} />
    <circle className="wreck-coin" cx="60" cy="102" r="3" fill={paint('coin')} />
    <circle className="wreck-coin" cx="84" cy="100" r="3.2" fill={paint('coin')} />
    <circle className="wreck-coin" cx="96" cy="102" r="2.6" fill={paint('coin')} />
    {/* Weed growing over the ribs and a fish that moved in. */}
    <path className="reef-weed" d="M30 40 C 22 32 32 22 24 12" />
    <path className="reef-weed" d="M46 34 C 40 26 50 18 44 8" />
    <path className="reef-weed" d="M140 34 C 148 26 138 18 146 8" />
    <path className="wreck-fish" d="M56 84 Q 66 78 76 84 Q 66 90 56 84 Z" fill={paint('gold')} />
    <path className="wreck-fish-tail" d="M56 84 L49 79 L49 89 Z" fill={paint('coin')} />
    <circle className="reef-bubble" cx="88" cy="30" r="2.6" />
    <circle className="reef-bubble" cx="96" cy="22" r="1.8" />
    <path className="wreck-sand" d="M2 102 Q 40 92 86 96 Q 130 100 168 92 L168 112 L2 112 Z" fill={paint('sand')} opacity=".85" />
  </svg>;
}

export function Shell() {
  return <svg className="reef-art" viewBox="0 0 68 60" {...BASE}>
    <path className="shell-body" d="M8 46 C 6 28 22 14 42 14 C 58 14 66 26 60 36 C 70 40 68 54 52 56 C 34 58 14 56 8 46 Z" fill={paint('shell-body')} />
    <path className="shell-spiral" d="M62 34 C 46 24 24 26 10 44" />
    <path className="shell-spiral" d="M60 44 C 44 36 26 38 12 50" />
    <path className="shell-spiral shell-spiral-faint" d="M56 52 C 40 46 26 48 16 54" />
    <ellipse className="shell-mouth" cx="50" cy="46" rx="7" ry="12" transform="rotate(-38 50 46)" fill={paint('shell-inner')} />
    <path className="shell-lip" d="M56 34 Q 64 44 54 58" />
    <path className="shell-apex" d="M42 16 Q 40 6 48 4 Q 52 10 48 16 Z" fill={paint('shell-body')} />
    <path className="shell-rib" d="M22 20 L18 30 M34 16 L32 28 M46 15 L44 28" />
    <circle className="shell-gleam" cx="30" cy="26" r="2.4" />
    <path className="shell-shine" d="M20 26 Q 30 18 42 18" />
    <circle className="reef-bubble" cx="10" cy="18" r="2.4" />
    <circle className="reef-bubble" cx="16" cy="10" r="1.6" />
  </svg>;
}

export function Seagrass() {
  return <svg className="reef-art" viewBox="0 0 76 112" {...BASE}>
    <path className="grass-blade" d="M14 110 C 2 88 18 70 8 48 C 2 32 10 16 16 4 C 24 20 26 38 20 56 C 12 78 26 92 14 110 Z" fill={paint('grass-body')} />
    <path className="grass-blade" d="M34 110 C 24 86 38 66 28 44 C 22 28 30 12 36 2 C 44 18 46 36 40 54 C 32 78 46 92 34 110 Z" fill={paint('grass-body')} />
    <path className="grass-blade" d="M54 110 C 44 90 58 72 48 52 C 42 38 48 24 54 14 C 62 28 64 44 58 60 C 50 80 64 94 54 110 Z" fill={paint('grass-body')} opacity=".95" />
    <path className="grass-blade grass-blade-back" d="M6 110 C -2 92 10 78 4 60 C 0 48 4 36 8 26 C 14 40 16 54 12 68 C 6 84 14 98 6 110 Z" fill={paint('weed-dark')} opacity=".8" />
    <path className="grass-blade grass-blade-back" d="M66 110 C 60 94 70 80 64 64 C 60 52 64 40 68 32 C 74 44 76 58 72 70 C 66 86 74 98 66 110 Z" fill={paint('weed-dark')} opacity=".8" />
    <path className="grass-mid" d="M15 106 C 8 86 20 68 12 48 C 7 34 12 20 16 8" />
    <path className="grass-mid" d="M35 106 C 28 84 40 64 32 44 C 27 30 32 16 36 6" />
    <path className="grass-mid" d="M55 106 C 48 88 60 70 52 52 C 47 40 52 28 55 18" />
    <circle className="grass-seed" cx="20" cy="60" r="3" />
    <circle className="grass-seed" cx="42" cy="34" r="2.6" />
    <circle className="grass-seed" cx="60" cy="72" r="2.8" />
    <path className="grass-base" d="M8 110 Q 38 102 68 110 Q 38 114 8 110 Z" fill={paint('sand-deep')} opacity=".7" />
    <circle className="reef-bubble" cx="72" cy="46" r="2.2" />
  </svg>;
}

export function Crab() {
  return <svg className="reef-art" viewBox="-6 -10 92 78" {...BASE}>
    {/* Legs, two joints each, four to a side. */}
    <path className="crab-leg" d="M16 34 L4 42 L12 48 M20 40 L10 50 L20 54 M26 44 L18 54 L28 58 M34 46 L28 56 L38 60" />
    <path className="crab-leg" d="M64 34 L76 42 L68 48 M60 40 L70 50 L60 54 M54 44 L62 54 L52 58 M46 46 L52 56 L42 60" />
    {/* Claws held up and out. */}
    <path className="crab-arm" d="M18 28 L6 18" />
    <path className="crab-arm" d="M62 28 L74 18" />
    <path className="crab-claw" d="M9 20 C 0 14 -2 4 6 -1 C 14 -5 20 2 18 10 Z" fill={paint('crab-claw')} />
    <path className="crab-claw" d="M71 20 C 80 14 82 4 74 -1 C 66 -5 60 2 62 10 Z" fill={paint('crab-claw')} />
    <path className="crab-claw-slit" d="M2 8 L16 8 M78 8 L64 8" />
    {/* The shell: a scalloped edge at the front, a ridge across the back. */}
    <path className="crab-body" d="M40 22 C 56 22 68 30 68 42 C 68 54 56 60 40 60 C 24 60 12 54 12 42 C 12 30 24 22 40 22 Z" fill={paint('crab-shell')} />
    <path className="crab-shell-ridge" d="M16 34 C 26 26 54 26 64 34" />
    <path className="crab-shell-ridge crab-shell-ridge-faint" d="M20 44 C 30 38 50 38 60 44" />
    <path className="crab-shell-scallop" d="M18 52 Q 24 56 30 52 Q 36 57 42 52 Q 48 57 54 52 Q 60 56 62 50" />
    <path className="crab-under" d="M20 56 Q 40 66 60 56 Q 40 62 20 56 Z" fill={paint('crab-under')} opacity=".9" />
    <circle className="crab-spot" cx="30" cy="30" r="1.6" />
    <circle className="crab-spot" cx="50" cy="30" r="1.6" />
    <circle className="crab-spot" cx="40" cy="28" r="1.4" />
    {/* Stalked eyes, and a little mouth. */}
    <path className="crab-stalk" d="M31 22 L28 12 M49 22 L52 12" />
    <circle className="crab-eye" cx="27" cy="10" r="4.4" fill={paint('crab-shell')} />
    <circle className="crab-eye" cx="53" cy="10" r="4.4" fill={paint('crab-shell')} />
    <circle className="crab-eye-white" cx="27" cy="10" r="2.8" />
    <circle className="crab-eye-white" cx="53" cy="10" r="2.8" />
    <circle className="crab-pupil" cx="27.6" cy="10.4" r="1.4" />
    <circle className="crab-pupil" cx="53.6" cy="10.4" r="1.4" />
    <circle className="crab-gleam" cx="26" cy="8.6" r="0.9" />
    <circle className="crab-gleam" cx="52" cy="8.6" r="0.9" />
    <path className="crab-mouth" d="M34 54 Q 40 58 46 54" />
    <path className="crab-fringe" d="M22 50 Q 28 54 34 50 Q 40 55 46 50 Q 52 54 58 50" />
    <circle className="reef-bubble" cx="6" cy="4" r="2.4" />
    <circle className="reef-bubble" cx="12" cy="-2" r="1.6" />
  </svg>;
}

export function Octopus() {
  return <svg className="reef-art" viewBox="0 0 100 100" {...BASE}>
    {/* Arms: filled ribbons so each one can taper, with suckers along them. */}
    <path className="octo-arm" d="M22 52 C 6 56 4 74 14 90 C 20 96 30 96 34 90 C 26 86 20 74 26 62 Z" fill={paint('octo-body')} />
    <path className="octo-arm" d="M30 56 C 14 66 16 84 28 94 C 34 98 44 96 46 90 C 36 84 28 76 36 66 Z" fill={paint('octo-body')} />
    <path className="octo-arm" d="M40 58 C 28 74 36 90 50 96 C 58 98 66 94 66 88 C 52 84 44 76 50 64 Z" fill={paint('octo-body')} />
    <path className="octo-arm" d="M56 58 C 52 76 64 90 78 92 C 86 92 92 86 90 80 C 76 78 66 70 68 58 Z" fill={paint('octo-body')} />
    <path className="octo-arm" d="M70 54 C 78 66 94 68 98 80 C 100 88 94 94 88 92 C 86 82 78 76 68 70 Z" fill={paint('octo-body')} opacity=".95" />
    <path className="octo-arm" d="M16 46 C 4 50 -2 62 2 76 C 4 84 12 88 16 84 C 10 74 8 60 18 52 Z" fill={paint('octo-body')} opacity=".95" />
    {/* The mantle: a big head with a domed top. */}
    <path className="octo-head" d="M50 4 C 76 4 90 22 90 44 C 90 60 76 68 50 68 C 24 68 10 60 10 44 C 10 22 24 4 50 4 Z" fill={paint('octo-body')} />
    <path className="octo-head-shade" d="M50 4 C 24 4 10 22 10 44 C 10 60 24 68 50 68 C 34 62 26 54 26 42 C 26 26 36 10 50 4 Z" fill={paint('rock-dark')} opacity=".16" />
    <path className="octo-head-light" d="M40 12 C 58 8 74 16 80 30 C 68 16 52 12 40 16 Z" fill="#fffdf3" opacity=".35" />
    <circle className="octo-spot" cx="26" cy="30" r="4.4" fill={paint('octo-spot')} />
    <circle className="octo-spot" cx="34" cy="18" r="3.2" fill={paint('octo-spot')} />
    <circle className="octo-spot" cx="70" cy="26" r="4" fill={paint('octo-spot')} />
    <circle className="octo-spot" cx="62" cy="52" r="3.4" fill={paint('octo-spot')} />
    <circle className="octo-spot" cx="34" cy="56" r="3.8" fill={paint('octo-spot')} />
    {/* Eyes with lids, and the siphon. */}
    <ellipse className="octo-eye" cx="33" cy="38" rx="9" ry="9.6" fill="#fffdf3" />
    <ellipse className="octo-eye" cx="67" cy="38" rx="9" ry="9.6" fill="#fffdf3" />
    <ellipse className="octo-iris" cx="34" cy="39" rx="5.4" ry="6.2" fill={paint('crab-shell')} />
    <ellipse className="octo-iris" cx="68" cy="39" rx="5.4" ry="6.2" fill={paint('crab-shell')} />
    <ellipse className="octo-pupil" cx="34.6" cy="39.6" rx="3" ry="4.4" fill="#2e1b26" />
    <ellipse className="octo-pupil" cx="68.6" cy="39.6" rx="3" ry="4.4" fill="#2e1b26" />
    <circle className="octo-gleam" cx="31" cy="34" r="2.4" fill="#ffffff" />
    <circle className="octo-gleam" cx="65" cy="34" r="2.4" fill="#ffffff" />
    <path className="octo-brow" d="M22 28 Q 33 22 44 27 M56 27 Q 67 22 78 28" />
    <path className="octo-siphon" d="M88 46 C 96 44 100 50 96 56 C 92 54 88 54 84 56 Z" fill={paint('octo-body')} />
    {/* Suckers along the two front arms. */}
    <circle className="octo-sucker" cx="16" cy="66" r="2" />
    <circle className="octo-sucker" cx="14" cy="76" r="1.8" />
    <circle className="octo-sucker" cx="18" cy="85" r="1.6" />
    <circle className="octo-sucker" cx="30" cy="74" r="2" />
    <circle className="octo-sucker" cx="34" cy="84" r="1.8" />
    <circle className="octo-sucker" cx="48" cy="78" r="2" />
    <circle className="octo-sucker" cx="54" cy="88" r="1.8" />
    <circle className="octo-sucker" cx="68" cy="78" r="1.8" />
    <circle className="octo-sucker" cx="78" cy="86" r="1.6" />
    <circle className="reef-bubble" cx="8" cy="14" r="2.6" />
    <circle className="reef-bubble" cx="14" cy="4" r="1.8" />
  </svg>;
}

export function Chest() {
  return <svg className="reef-art" viewBox="0 0 84 80" {...BASE}>
    <ellipse className="chest-glow" cx="42" cy="42" rx="36" ry="24" fill={paint('lamp')} />
    {/* What is inside: a heap of gold, lit from nowhere in particular. */}
    <path className="chest-gold" d="M16 46 C 24 34 36 32 42 34 C 50 30 64 34 70 44 Q 42 52 16 46 Z" fill={paint('gold')} />
    <circle className="coin" cx="30" cy="40" r="4.4" fill={paint('coin')} />
    <circle className="coin" cx="42" cy="37" r="4.8" fill={paint('coin')} />
    <circle className="coin" cx="54" cy="40" r="4.2" fill={paint('coin')} />
    {/* The lid, standing open behind the gold. */}
    <path className="chest-lid" d="M12 46 C 10 22 26 8 42 8 C 58 8 74 22 72 46 L62 46 C 64 26 54 16 42 16 C 30 16 20 26 22 46 Z" fill={paint('chest-lid')} />
    <path className="chest-lid-inner" d="M22 46 C 20 26 30 16 42 16 C 54 16 64 26 62 46 Z" fill={paint('wood-deep')} opacity=".5" />
    <path className="chest-band" d="M20 42 C 18 24 28 12 42 12 C 56 12 66 24 64 42" />
    <circle className="coin" cx="42" cy="22" r="3.4" fill={paint('coin')} />
    {/* The chest itself: planks, iron bands, rivets and a lock. */}
    <rect className="chest-body" x="12" y="44" width="60" height="28" rx="4" fill={paint('chest-wood')} />
    <path className="chest-plank" d="M12 54 L72 54 M12 64 L72 64" />
    <path className="chest-frame" d="M12 48 L72 48" />
    <path className="chest-band" d="M22 45 L22 72 M62 45 L62 72" />
    <rect className="chest-lock" x="34" y="50" width="16" height="17" rx="3" fill={paint('brass')} />
    <rect className="chest-keyhole" x="40.6" y="54" width="2.8" height="7" rx="1.4" fill="#4a3612" />
    <circle className="chest-rivet" cx="22" cy="58" r="1.5" />
    <circle className="chest-rivet" cx="22" cy="68" r="1.5" />
    <circle className="chest-rivet" cx="62" cy="58" r="1.5" />
    <circle className="chest-rivet" cx="62" cy="68" r="1.5" />
    <path className="chest-foot" d="M14 72 L23 72 L23 77 L14 77 Z" fill={paint('wood-deep')} />
    <path className="chest-foot" d="M61 72 L70 72 L70 77 L61 77 Z" fill={paint('wood-deep')} />
    {/* Coins that rolled out, and the sand they rolled into. */}
    <circle className="coin" cx="26" cy="74" r="4.2" fill={paint('coin')} />
    <circle className="coin" cx="36" cy="76" r="3.4" fill={paint('coin')} />
    <circle className="coin" cx="58" cy="75" r="3.6" fill={paint('coin')} />
    <path className="chest-sand" d="M6 74 Q 42 66 78 74 L78 80 L6 80 Z" fill={paint('sand')} opacity=".85" />
    <path className="reef-weed" d="M74 68 C 82 60 72 52 80 44" />
    <path className="chest-sparkle" d="M74 26 L75.6 29.4 L79 31 L75.6 32.6 L74 36 L72.4 32.6 L69 31 L72.4 29.4 Z" fill="#fff3b0" />
  </svg>;
}

export function Submarine() {
  return <svg className="reef-art" viewBox="-26 0 232 122" {...BASE}>
    {/* The searchlight, sweeping the dark ahead of her. */}
    <path className="sub-beam" d="M30 60 L-24 34 Q -10 60 -24 88 Z" fill={paint('sub-light')} />
    {/* Dive planes fore and aft, and the rudder. */}
    <path className="sub-plane" d="M36 40 C 28 30 22 26 16 26 C 20 34 24 42 26 50 Z" fill={paint('sub-tower')} />
    <path className="sub-plane" d="M162 40 C 170 30 176 26 182 26 C 178 34 174 42 172 50 Z" fill={paint('sub-tower')} opacity=".9" />
    <path className="sub-rudder" d="M180 40 C 190 32 196 22 198 12 C 202 26 200 44 194 56 L180 52 Z" fill={paint('sub-tower')} />
    <path className="sub-rudder" d="M180 82 C 190 90 196 98 198 108 C 202 94 200 76 194 66 L180 70 Z" fill={paint('sub-tower')} />
    {/* The hull: a long riveted boat with a stripe along her side. */}
    <path className="sub-hull" d="M22 60 C 22 34 52 20 96 20 C 148 20 184 36 186 58 C 188 80 148 98 96 98 C 52 98 22 84 22 60 Z" fill={paint('sub-hull')} />
    <path className="sub-hull-shade" d="M30 74 C 60 88 130 92 182 70 C 176 86 146 96 96 96 C 62 96 36 88 30 74 Z" fill={paint('rock-dark')} opacity=".16" />
    <path className="sub-stripe" d="M24 68 C 60 78 130 80 184 64 L184 72 C 130 88 60 86 24 76 Z" fill={paint('sub-tower')} />
    <path className="sub-seam" d="M52 40 C 50 60 52 78 56 90 M86 24 C 84 48 84 76 86 96 M120 22 C 118 48 118 78 120 96 M154 32 C 154 52 156 76 160 90" />
    <circle className="sub-rivet" cx="66" cy="34" r="1.4" />
    <circle className="sub-rivet" cx="66" cy="50" r="1.4" />
    <circle className="sub-rivet" cx="100" cy="30" r="1.4" />
    <circle className="sub-rivet" cx="100" cy="40" r="1.4" />
    <circle className="sub-rivet" cx="136" cy="32" r="1.4" />
    <circle className="sub-rivet" cx="170" cy="44" r="1.4" />
    {/* Lit portholes. */}
    <circle className="sub-porthole-glow" cx="54" cy="56" r="11" fill={paint('sub-light')} />
    <circle className="sub-porthole-glow" cx="86" cy="54" r="11" fill={paint('sub-light')} />
    <circle className="sub-porthole-glow" cx="118" cy="54" r="11" fill={paint('sub-light')} />
    <circle className="sub-porthole" cx="54" cy="56" r="7.4" fill={paint('sub-glass')} />
    <circle className="sub-porthole" cx="86" cy="54" r="7.4" fill={paint('sub-glass')} />
    <circle className="sub-porthole" cx="118" cy="54" r="7.4" fill={paint('sub-glass')} />
    <circle className="sub-porthole-rim" cx="54" cy="56" r="7.4" />
    <circle className="sub-porthole-rim" cx="86" cy="54" r="7.4" />
    <circle className="sub-porthole-rim" cx="118" cy="54" r="7.4" />
    {/* The conning tower, with her periscope, snorkel and hatch. */}
    <path className="sub-tower" d="M96 22 C 96 8 106 0 122 0 C 138 0 146 8 146 22 Z" fill={paint('sub-tower')} />
    <path className="sub-tower-window" d="M102 12 C 106 4 116 2 122 2 C 130 2 138 5 141 12 Z" fill={paint('sub-glass')} />
    <path className="sub-hatch" d="M114 0 L134 0 L134 -6 L114 -6 Z" fill={paint('metal-deep')} />
    <path className="sub-periscope" d="M128 0 L128 -26 L138 -26 L138 -20 L132 -20 L132 0 Z" fill={paint('metal')} />
    <circle className="sub-periscope-lens" cx="133" cy="-23" r="3" fill={paint('sub-glass')} />
    <path className="sub-snorkel" d="M106 -2 L106 -16 C 106 -20 112 -20 112 -16 L112 -8" />
    {/* A propeller turning, and the water it pushes. */}
    <circle className="sub-hub" cx="190" cy="60" r="5.4" fill={paint('brass')} />
    <ellipse className="sub-blade" cx="196" cy="48" rx="4" ry="12" transform="rotate(24 196 48)" fill={paint('metal')} />
    <ellipse className="sub-blade" cx="196" cy="72" rx="4" ry="12" transform="rotate(-24 196 72)" fill={paint('metal')} />
    <ellipse className="sub-blade" cx="198" cy="60" rx="4" ry="13" fill={paint('metal')} opacity=".85" />
    <circle className="reef-bubble" cx="204" cy="46" r="3" />
    <circle className="reef-bubble" cx="210" cy="58" r="2.2" />
    <circle className="reef-bubble" cx="206" cy="70" r="2.6" />
    <path className="reef-weed" d="M60 96 C 54 88 62 80 56 72" />
    <path className="reef-weed" d="M140 96 C 146 88 138 80 144 72" />
    <circle className="barnacle" cx="76" cy="94" r="2.2" />
    <circle className="barnacle" cx="104" cy="96" r="1.8" />
  </svg>;
}

export function Seahorse() {
  return <svg className="reef-art" viewBox="0 0 62 110" {...BASE}>
    <path className="seahorse-body" d="M30 30 C 20 44 22 58 26 70 C 29 79 28 88 34 95 C 40 102 52 100 54 90 C 55 83 48 77 42 80 C 36 83 36 92 44 94 C 36 94 30 88 30 80 C 30 72 34 62 34 52 C 34 42 33 36 30 30 Z" fill={paint('seahorse-body')} />
    <path className="seahorse-belly" d="M31 34 C 25 46 26 58 29 68 C 31 74 30 80 32 86 C 26 78 24 70 26 62 C 29 52 30 42 31 34 Z" fill={paint('seahorse-belly')} opacity=".85" />
    <path className="seahorse-ring" d="M28 44 Q 34 41 39 43 M27 54 Q 33 51 38 53 M27 64 Q 33 61 37 63 M28 74 Q 34 71 38 73 M31 84 Q 37 81 41 84" />
    <path className="seahorse-fin" d="M40 44 C 52 42 58 50 55 58 C 50 63 43 61 39 58 Z" fill={paint('seahorse-belly')} opacity=".9" />
    <path className="seahorse-fin-ray" d="M42 46 L48 54 M42 50 L50 56 M42 54 L48 58" />
    <path className="seahorse-fin" d="M27 38 C 20 39 19 45 26 47 Z" fill={paint('seahorse-belly')} />
    <path className="seahorse-head" d="M30 16 C 40 12 48 18 48 26 C 48 33 40 37 34 34 C 29 32 27 24 30 16 Z" fill={paint('seahorse-body')} />
    <path className="seahorse-snout" d="M32 20 L8 24 L8 29 L32 28 Z" fill={paint('seahorse-body')} />
    <path className="seahorse-mouth" d="M8 24 L8 29" />
    <path className="seahorse-coronet" d="M30 14 C 34 6 42 4 47 9 L44 15 Z" fill={paint('seahorse-body')} />
    <path className="seahorse-coronet-spike" d="M32 8 L31 2 M38 5 L38 0 M44 6 L46 1" />
    <path className="seahorse-mane" d="M45 14 C 49 20 51 26 49 33" />
    <circle className="seahorse-eye" cx="41" cy="23" r="3.4" fill="#fffdf3" />
    <circle className="seahorse-pupil" cx="41.6" cy="23.2" r="1.7" fill="#33280f" />
    <circle className="seahorse-gleam" cx="40" cy="21.6" r="0.9" fill="#ffffff" />
    <circle className="reef-bubble" cx="18" cy="14" r="2.6" />
    <circle className="reef-bubble" cx="24" cy="6" r="1.8" />
  </svg>;
}

export function Jellyfish() {
  return <svg className="reef-art" viewBox="0 0 74 118" {...BASE}>
    <ellipse className="jelly-glow" cx="37" cy="46" rx="34" ry="30" fill={paint('jelly-glow')} />
    {/* Tentacles, thin and trailing. */}
    <path className="jelly-tentacle" d="M14 52 C 8 68 18 80 10 96 C 6 104 10 112 6 118" />
    <path className="jelly-tentacle" d="M22 54 C 16 70 26 82 18 98 C 14 106 18 112 14 118" />
    <path className="jelly-tentacle" d="M30 56 C 26 72 34 84 28 100 C 24 108 28 112 26 118" />
    <path className="jelly-tentacle" d="M37 56 C 34 74 42 86 36 102 C 33 110 37 114 34 118" />
    <path className="jelly-tentacle" d="M44 56 C 48 72 40 84 46 100 C 50 108 46 112 48 118" />
    <path className="jelly-tentacle" d="M52 54 C 58 68 48 80 54 96 C 58 104 54 110 58 116" />
    <path className="jelly-tentacle" d="M60 52 C 66 66 58 78 64 94 C 68 102 64 108 68 114" />
    {/* Oral arms: frilled ribbons under the bell. */}
    <path className="jelly-arm" d="M28 50 C 24 62 30 72 26 84 C 34 78 30 64 34 52 Z" fill={paint('jelly-dome')} />
    <path className="jelly-arm" d="M46 50 C 50 62 44 72 48 84 C 40 78 44 64 40 52 Z" fill={paint('jelly-dome')} />
    <path className="jelly-arm" d="M36 50 C 34 64 38 76 34 90 C 42 80 40 64 42 52 Z" fill={paint('jelly-dome')} opacity=".85" />
    {/* The bell, with its rim and the light inside it. */}
    <path className="jelly-bell" d="M6 48 C 6 22 20 4 37 4 C 54 4 68 22 68 48 C 62 45 54 43 46 43 C 40 47 34 47 28 43 C 20 43 12 45 6 48 Z" fill={paint('jelly-dome')} />
    <path className="jelly-rim" d="M6 48 C 14 45 22 43 28 43 C 34 47 40 47 46 43 C 54 43 62 45 68 48 C 62 53 52 56 37 56 C 22 56 12 53 6 48 Z" fill={paint('jelly-dome')} opacity=".85" />
    <path className="jelly-light" d="M18 20 C 24 10 34 6 44 8 C 32 12 24 22 22 34 C 18 30 16 25 18 20 Z" fill="#ffffff" opacity=".45" />
    <ellipse className="jelly-core" cx="37" cy="34" rx="13" ry="10" fill={paint('lantern-glass')} opacity=".55" />
    <circle className="jelly-gonad" cx="27" cy="30" r="4" fill="#f4ecff" opacity=".5" />
    <circle className="jelly-gonad" cx="47" cy="30" r="4" fill="#f4ecff" opacity=".5" />
    <circle className="jelly-gonad" cx="37" cy="24" r="3.4" fill="#f4ecff" opacity=".45" />
    <circle className="reef-bubble" cx="66" cy="24" r="2.6" />
    <circle className="reef-bubble" cx="70" cy="14" r="1.8" />
  </svg>;
}

// The station: a glass dome on a steel ring, legs, an airlock, and the little
// submarine that is docked at it.
export function Station() {
  return <svg className="reef-art" viewBox="0 0 216 172" {...BASE}>
    <ellipse className="station-halo" cx="107" cy="82" rx="72" ry="54" fill={paint('station-light')} opacity=".3" />
    {/* Aerials: one mast with a lamp, one short whip with a light. */}
    <path className="station-mast" d="M104 38 L104 4" />
    <path className="station-mast-arm" d="M96 14 L112 14 M100 22 L108 22" />
    <circle className="station-lamp-glow" cx="104" cy="4" r="11" fill={paint('station-light')} />
    <circle className="station-lamp" cx="104" cy="4" r="3.6" fill={paint('lantern-glass')} />
    <path className="station-mast" d="M142 44 L142 20" />
    <circle className="station-lamp" cx="142" cy="18" r="2.6" fill={paint('lantern-glass')} />
    {/* The dome, its glazing bars and the life inside it. */}
    <path className="station-dome" d="M45 96 C 45 60 72 34 107 34 C 142 34 169 60 169 96 Z" fill={paint('dome-glass')} />
    <path className="station-floor" d="M56 90 C 78 84 136 84 158 90" />
    <rect className="station-inner-window" x="86" y="60" width="22" height="16" rx="2" fill={paint('lantern-glass')} opacity=".85" />
    <path className="station-inner-lamp" d="M64 60 L64 74 M118 56 L118 72" />
    <path className="station-bar" d="M107 34 C 107 58 107 78 107 96" />
    <path className="station-bar" d="M74 40 C 68 58 60 80 56 96" />
    <path className="station-bar" d="M140 40 C 146 58 154 80 158 96" />
    <path className="station-bar station-bar-ring" d="M52 74 C 74 66 140 66 160 74" />
    <path className="station-dome-light" d="M64 50 C 76 40 92 36 106 36 C 88 40 74 48 68 62 C 64 58 62 54 64 50 Z" fill="#ffffff" opacity=".4" />
    <path className="station-dome-rim" d="M45 96 C 72 88 142 88 169 96" />
    {/* The ring deck, its windows, and the legs down to the sand. */}
    <rect className="station-ring" x="40" y="96" width="136" height="16" rx="4" fill={paint('station-body')} />
    <rect className="station-trim" x="40" y="96" width="136" height="4" rx="2" fill={paint('station-trim')} />
    <rect className="station-trim" x="40" y="108" width="136" height="4" rx="2" fill={paint('station-trim')} />
    <rect className="station-hull" x="48" y="112" width="120" height="18" rx="5" fill={paint('station-body')} />
    <circle className="station-window-glow" cx="84" cy="121" r="10" fill={paint('station-light')} />
    <circle className="station-window-glow" cx="108" cy="122" r="10" fill={paint('station-light')} />
    <circle className="station-window-glow" cx="132" cy="121" r="10" fill={paint('station-light')} />
    <circle className="station-window" cx="84" cy="121" r="5" fill={paint('sub-glass')} />
    <circle className="station-window" cx="108" cy="122" r="5" fill={paint('sub-glass')} />
    <circle className="station-window" cx="132" cy="121" r="5" fill={paint('sub-glass')} />
    <circle className="station-window-rim" cx="84" cy="121" r="5" />
    <circle className="station-window-rim" cx="108" cy="122" r="5" />
    <circle className="station-window-rim" cx="132" cy="121" r="5" />
    <path className="station-pipe" d="M74 96 C 74 108 80 116 88 124" />
    <path className="station-pipe" d="M142 96 C 142 108 136 116 128 124" />
    <path className="station-leg" d="M60 128 L40 160 M92 130 L84 166 M124 130 L132 166 M156 128 L176 158" />
    <path className="station-foot" d="M30 160 L50 162 L50 168 L30 166 Z" fill={paint('metal-deep')} />
    <path className="station-foot" d="M74 166 L94 168 L94 172 L74 170 Z" fill={paint('metal-deep')} />
    <path className="station-foot" d="M122 166 L142 168 L142 172 L122 170 Z" fill={paint('metal-deep')} />
    <path className="station-foot" d="M166 156 L186 158 L186 164 L166 162 Z" fill={paint('metal-deep')} />
    {/* The airlock, and the mini-sub moored to it. */}
    <rect className="station-airlock" x="30" y="112" width="30" height="30" rx="5" fill={paint('station-body')} />
    <rect className="station-door" x="38" y="118" width="16" height="24" rx="3" fill={paint('metal-deep')} />
    <rect className="station-door-window" x="41" y="122" width="10" height="9" rx="2" fill={paint('sub-glass')} />
    <circle className="station-lamp" cx="48" cy="108" r="3" fill={paint('lantern-glass')} />
    <path className="station-mooring" d="M34 120 C 26 122 24 128 26 134" />
    <path className="mini-sub" d="M2 154 C 2 142 16 134 34 134 C 52 134 66 142 66 152 C 66 162 52 168 34 168 C 16 168 2 164 2 154 Z" fill={paint('sub-hull')} />
    <path className="mini-sub-shade" d="M6 158 C 20 164 48 164 62 156 C 58 164 48 167 34 167 C 18 167 8 163 6 158 Z" fill={paint('rock-dark')} opacity=".18" />
    <path className="mini-sub-tower" d="M25 135 C 25 128 32 124 40 124 C 47 124 52 128 52 135 Z" fill={paint('sub-tower')} />
    <path className="mini-sub-plane" d="M60 140 C 66 134 70 132 74 132 C 71 137 69 142 68 146 Z" fill={paint('sub-tower')} />
    <circle className="mini-sub-porthole" cx="20" cy="150" r="4.6" fill={paint('sub-glass')} />
    <circle className="mini-sub-porthole" cx="38" cy="150" r="4.6" fill={paint('sub-glass')} />
    <circle className="mini-sub-porthole-rim" cx="20" cy="150" r="4.6" />
    <circle className="mini-sub-porthole-rim" cx="38" cy="150" r="4.6" />
    <path className="mini-sub-stripe" d="M6 158 C 20 163 48 163 62 155" />
    <circle className="station-bubble" cx="120" cy="26" r="3.2" />
    <circle className="station-bubble" cx="132" cy="14" r="2.2" />
    <circle className="station-bubble" cx="180" cy="60" r="2.6" />
    <path className="reef-weed" d="M188 164 C 194 152 186 142 192 132" />
    <circle className="barnacle" cx="182" cy="166" r="2.2" />
  </svg>;
}

export function Bell() {
  return <svg className="reef-art" viewBox="0 0 74 84" {...BASE}>
    {/* The rope it hung from, its shackle and the yoke across the top. */}
    <path className="bell-rope" d="M37 0 C 33 6 41 10 37 16" />
    <circle className="bell-shackle" cx="37" cy="19" r="5" fill="none" stroke={paint('metal')} strokeWidth="4" />
    <path className="bell-yoke" d="M22 27 Q 37 21 52 27" />
    <circle className="bell-bolt" cx="24" cy="27" r="2.2" fill={paint('metal-deep')} />
    <circle className="bell-bolt" cx="50" cy="27" r="2.2" fill={paint('metal-deep')} />
    {/* The bell itself: cast bands, a lip, and the clapper inside. */}
    <path className="bell-body" d="M37 26 C 47 26 52 34 53 46 L58 63 C 59 69 51 73 37 73 C 23 73 15 69 16 63 L21 46 C 22 34 27 26 37 26 Z" fill={paint('bell-brass')} />
    <path className="bell-shade" d="M37 26 C 27 26 22 34 21 46 L16 63 C 15 69 23 73 37 73 C 27 69 23 65 24 59 L29 44 C 30 34 33 28 37 26 Z" fill={paint('rock-dark')} opacity=".18" />
    <path className="bell-band" d="M22 44 Q 37 48 52 44" />
    <path className="bell-band" d="M18 58 Q 37 63 56 58" />
    <path className="bell-rim" d="M15 65 Q 37 73 59 65 Q 37 78 15 65 Z" fill={paint('bell-dark')} />
    <circle className="bell-stud" cx="31" cy="36" r="1.7" fill={paint('bell-dark')} />
    <circle className="bell-stud" cx="43" cy="36" r="1.7" fill={paint('bell-dark')} />
    <circle className="bell-stud" cx="37" cy="31" r="1.5" fill={paint('bell-dark')} />
    <path className="bell-highlight" d="M29 33 C 25 41 23 51 22 61" />
    <path className="bell-clapper-line" d="M37 66 L37 70" />
    <circle className="bell-clapper" cx="37" cy="72" r="4.6" fill={paint('bell-brass')} />
    <path className="reef-weed" d="M62 62 C 68 54 60 46 66 38" />
    <circle className="barnacle" cx="20" cy="58" r="2" />
    <path className="bell-sand" d="M6 76 Q 37 70 68 76 L68 84 L6 84 Z" fill={paint('sand')} opacity=".85" />
  </svg>;
}

// Eight spokes, evenly spaced, worked out once: a wheel is a wheel.
const WHEEL_SPOKES = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4 - Math.PI / 2;
  return {
    x2: 52 + Math.cos(angle) * 38,
    y2: 54 + Math.sin(angle) * 38,
    hx: 52 + Math.cos(angle) * 47,
    hy: 54 + Math.sin(angle) * 47,
  };
});

export function Wheel() {
  return <svg className="reef-art" viewBox="0 0 104 106" {...BASE}>
    <circle className="wheel-rim" cx="52" cy="54" r="42" fill="none" stroke={paint('wheel-wood')} strokeWidth="10" />
    <circle className="wheel-rim-inner" cx="52" cy="54" r="34" fill="none" stroke={paint('wheel-hub')} strokeWidth="3" />
    <circle className="wheel-rim-line" cx="52" cy="54" r="46" fill="none" stroke={paint('wood-deep')} strokeWidth="2" opacity=".7" />
    <circle className="wheel-rim-line" cx="52" cy="54" r="38" fill="none" stroke={paint('wood-deep')} strokeWidth="1.4" opacity=".5" />
    {WHEEL_SPOKES.map((spoke, index) => <g key={index}>
      <path className="wheel-spoke" d={`M52 54 L${spoke.x2} ${spoke.y2}`} />
      <circle className="wheel-handle" cx={spoke.hx} cy={spoke.hy} r="4.6" fill={paint('wheel-hub')} />
      <circle className="wheel-ferrule" cx={spoke.x2} cy={spoke.y2} r="2.6" fill={paint('brass')} />
    </g>)}
    <path className="wheel-grain" d="M22 32 C 34 30 44 34 50 42 M74 26 C 66 30 60 36 58 44" />
    <circle className="wheel-hub" cx="52" cy="54" r="12" fill={paint('wheel-wood')} />
    <circle className="wheel-cap" cx="52" cy="54" r="6.4" fill={paint('wheel-hub')} />
    <circle className="wheel-bolt" cx="52" cy="45" r="1.7" fill={paint('wood-deep')} />
    <circle className="wheel-bolt" cx="52" cy="63" r="1.7" fill={paint('wood-deep')} />
    <circle className="wheel-bolt" cx="43" cy="54" r="1.7" fill={paint('wood-deep')} />
    <circle className="wheel-bolt" cx="61" cy="54" r="1.7" fill={paint('wood-deep')} />
    <path className="wheel-sand" d="M10 96 Q 52 88 94 96 L94 106 L10 106 Z" fill={paint('sand')} opacity=".85" />
    <path className="reef-weed" d="M92 92 C 100 84 90 76 98 68" />
    <circle className="barnacle" cx="16" cy="92" r="2.2" />
  </svg>;
}

export function Amphora() {
  return <svg className="reef-art" viewBox="0 -16 76 112" {...BASE}>
    {/* The weed that grew out of the mouth comes first, behind the clay. */}
    <path className="reef-weed" d="M34 8 C 28 -2 38 -8 32 -16" />
    <path className="reef-weed" d="M42 8 C 48 0 40 -6 46 -14" />
    <path className="amphora-handle" d="M32 18 C 18 20 14 32 22 40 C 27 35 28 26 35 24 Z" fill={paint('amphora')} />
    <path className="amphora-handle" d="M44 18 C 58 20 62 32 54 40 C 49 35 48 26 41 24 Z" fill={paint('amphora')} />
    <path className="amphora-neck" d="M32 16 L44 16 L46 26 L30 26 Z" fill={paint('amphora')} />
    <path className="amphora-lip" d="M29 8 L47 8 L46 16 L30 16 Z" fill={paint('amphora-mouth')} />
    <ellipse className="amphora-opening" cx="38" cy="8" rx="8" ry="2.6" fill="#4a3016" />
    <path className="amphora-body" d="M38 26 C 58 30 66 44 66 58 C 66 74 54 86 38 86 C 22 86 10 74 10 58 C 10 44 18 30 38 26 Z" fill={paint('amphora')} />
    <path className="amphora-shade" d="M38 26 C 18 30 10 44 10 58 C 10 74 22 86 38 86 C 26 82 20 72 20 58 C 20 44 28 32 38 26 Z" fill={paint('rock-dark')} opacity=".16" />
    <path className="amphora-foot" d="M32 84 C 34 90 36 94 38 96 C 40 94 42 90 44 84 Z" fill={paint('amphora')} />
    <path className="amphora-band" d="M13 46 Q 38 42 63 46" />
    <path className="amphora-band amphora-band-faint" d="M16 66 Q 38 62 60 66" />
    <path className="amphora-crack" d="M26 34 L30 44 L24 52 L28 62" />
    <path className="amphora-crack" d="M50 40 L46 50 L52 58" />
    <ellipse className="amphora-gleam" cx="26" cy="44" rx="6" ry="10" transform="rotate(-18 26 44)" fill="#fffdf3" opacity=".22" />
    <path className="amphora-sand" d="M6 84 Q 38 76 70 84 L70 96 L6 96 Z" fill={paint('sand')} opacity=".85" />
    <circle className="barnacle" cx="58" cy="78" r="2.2" />
    <circle className="reef-bubble" cx="68" cy="20" r="2.4" />
  </svg>;
}

export function Bottle() {
  return <svg className="reef-art" viewBox="0 -8 80 100" {...BASE}>
    {/* The neck, its cork, and the message rolled up inside the glass. */}
    <path className="bottle-neck" d="M58 34 C 66 26 68 18 70 6 L78 8 C 76 20 72 30 64 40 Z" fill={paint('bottle-glass')} />
    <path className="bottle-cork" d="M68 0 L78 3 L76 12 L66 9 Z" fill={paint('cork')} />
    <path className="bottle-body" d="M10 52 C 10 38 24 30 40 30 C 58 30 70 38 70 52 C 70 66 58 76 40 76 C 24 76 10 66 10 52 Z" fill={paint('bottle-glass')} />
    <path className="message" d="M30 44 C 40 38 54 40 58 48 C 62 56 52 64 42 62 C 32 60 26 50 30 44 Z" fill={paint('message')} />
    <path className="message-line" d="M34 48 C 42 44 52 46 55 51" />
    <path className="message-line" d="M33 55 C 40 52 48 54 51 58" />
    <path className="bottle-gleam" d="M20 46 C 26 38 36 34 46 34 C 34 38 26 44 22 54 C 20 52 19 49 20 46 Z" fill="#ffffff" opacity=".5" />
    <path className="bottle-rim" d="M12 58 C 20 64 34 68 48 66" />
    <path className="bottle-line" d="M60 32 C 66 26 68 18 70 8" />
    <path className="bottle-sand" d="M2 72 Q 40 64 78 72 L78 92 L2 92 Z" fill={paint('sand')} opacity=".9" />
    <path className="chest-sparkle" d="M62 22 L63.6 25.4 L67 27 L63.6 28.6 L62 32 L60.4 28.6 L57 27 L60.4 25.4 Z" fill="#fff3b0" />
    <circle className="reef-bubble" cx="14" cy="24" r="2.4" />
    <circle className="reef-bubble" cx="20" cy="14" r="1.6" />
  </svg>;
}

// Every treasure a finished trip can unlock, by id (see REEF_REWARDS in trip.js).
const REWARD_ART = {
  starfish: Starfish,
  coral: Coral,
  shell: Shell,
  wreck: Wreck,
  seagrass: Seagrass,
  crab: Crab,
  octopus: Octopus,
  chest: Chest,
  submarine: Submarine,
  seahorse: Seahorse,
  jellyfish: Jellyfish,
  station: Station,
  bell: Bell,
  wheel: Wheel,
  amphora: Amphora,
  bottle: Bottle,
};

// Which treasures this version can draw. Exported so a test can prove that every
// reward the game hands out has a picture to paint.
export const REWARD_IDS = Object.keys(REWARD_ART);

// One decoration. An id this version does not draw is simply skipped.
export function ReefArt({ id }) {
  const Art = REWARD_ART[id];
  return Art ? <Art /> : null;
}
