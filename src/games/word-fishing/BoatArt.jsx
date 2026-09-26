import { paint } from './SeaArtDefs.jsx';

// The boat, in the very same 220 x 190 box the rig is measured in (see RIG_DX and
// RIG_Y in rig.js): the deck line still runs from y 110 to y 122, the drawing's
// own waterline is still at 78% of its height, the angler still stands in the bow
// between x 26 and x 62 with the rod grip at the anchor the line layer starts
// from, and the mast still rises at x 150 with the trip number on its flag. Move
// any of those and the rod, the line, the float or the net would come loose from
// the boat.
//
// Everything else is new detail: lapstrake planks with seams and nail heads, a
// boot-top stripe, a bow post, a transom, a porthole, a life ring, a wheelhouse
// with framed glass, a lamp, an exhaust pipe, rigging and a furled sail, and the
// crew's gear on deck – a fish crate at the bow (where a hooked fish is landed),
// a net bag and a bucket by the counter, and a rope coil on the roof.
export function BoatArt({ tripNumber }) {
  return <svg className="boat-drawing" viewBox="0 0 220 190" aria-hidden="true" focusable="false">
    {/* Rigging first: everything else stands in front of it. */}
    <path className="boat-rigging" d="M150 16 L12 112" />
    <path className="boat-rigging" d="M150 20 L210 118" />

    {/* Mast, furled sail and the flag with today's trip number. */}
    <rect className="boat-mast" x="146" y="12" width="7" height="102" rx="3.4" fill={paint('wood-deep')} />
    <rect className="boat-sail" x="138" y="36" width="20" height="52" rx="10" fill={paint('hull-band')} />
    <path className="boat-sail-tie" d="M137 46 L159 46 M137 58 L159 58 M137 70 L159 70 M137 80 L159 80" />
    <path className="boat-flag" d="M152 14 Q 178 18 203 24 Q 189 32 203 42 Q 178 46 152 42 Z" fill={paint('flag')} />
    <path className="boat-flag-fold" d="M152 28 Q 178 32 203 34 L203 42 Q 178 46 152 42 Z" fill="#b8412a" opacity=".35" />
    <text className="boat-flag-number" x="176" y="34" textAnchor="middle">{tripNumber}</text>

    {/* The wheelhouse: roof with an overhang, framed glass, a lamp, a door. */}
    <path className="boat-cabin" d="M100 74 L188 74 L190 112 L98 112 Z" fill={paint('cabin')} />
    <path className="boat-cabin-shade" d="M100 98 L188 98 L190 112 L98 112 Z" fill={paint('rock-dark')} opacity=".14" />
    <path className="boat-cabin-roof" d="M92 64 L196 64 L196 76 L92 76 Z" fill={paint('cabin-roof')} />
    <path className="boat-cabin-lip" d="M92 74 L196 74 L196 79 L92 79 Z" fill={paint('wood-deep')} opacity=".55" />
    <rect className="boat-window" x="103" y="82" width="36" height="21" rx="3" fill={paint('glass')} />
    <rect className="boat-window-frame" x="102" y="81" width="38" height="23" rx="4" />
    <path className="boat-glass-gleam" d="M106 101 L118 83 L126 83 L113 101 Z" fill={paint('gleam')} opacity=".75" />
    <rect className="boat-window" x="147" y="84" width="22" height="18" rx="3" fill={paint('glass')} />
    <rect className="boat-window-frame" x="146" y="83" width="24" height="20" rx="4" />
    <path className="boat-glass-gleam" d="M150 100 L158 85 L163 85 L153 100 Z" fill={paint('gleam')} opacity=".6" />
    <path className="boat-door" d="M172 82 L185 82 L185 112 L172 112 Z" fill={paint('wood')} />
    <path className="boat-door-frame" d="M170 80 L187 80 L187 84 L170 84 Z" fill={paint('wood-deep')} />
    <circle className="boat-door-knob" cx="182" cy="98" r="1.9" fill={paint('brass')} />
    <rect className="boat-pipe" x="94" y="48" width="9" height="20" rx="3.5" fill={paint('steel')} />
    <path className="boat-pipe-cap" d="M90 46 L107 46 L107 51 L90 51 Z" fill={paint('metal-deep')} />
    <circle className="boat-smoke" cx="99" cy="38" r="7" fill={paint('smoke')} />
    <circle className="boat-smoke" cx="106" cy="27" r="9.5" fill={paint('smoke')} opacity=".6" />
    <circle className="boat-lamp-glow" cx="192" cy="70" r="13" fill={paint('lamp')} />
    <circle className="boat-lamp" cx="192" cy="70" r="3.6" fill={paint('lantern-glass')} />
    {/* The hull: a raised bow, a stern, planks, a boot-top stripe, a porthole. */}
    <path className="boat-hull" d="M6 112 L212 120 C 216 132 212 144 202 154 C 184 168 152 174 116 172 C 76 170 44 158 22 142 C 10 134 4 124 6 112 Z" fill={paint('hull')} />
    <path className="boat-hull-shade" d="M12 128 C 34 146 74 164 118 166 C 154 168 184 162 204 146 C 198 160 178 170 150 173 C 110 176 62 166 30 148 Q 16 140 12 128 Z" fill={paint('hull-band')} opacity=".18" />
    <path className="boat-boot-stripe" d="M8 138 C 30 152 62 164 116 166 C 150 167 178 161 199 147 L197 156 C 176 168 149 173 116 172 C 62 170 30 158 10 145 Z" fill={paint('hull-band')} />
    <path className="boat-strake" d="M12 126 C 34 140 68 152 116 154 C 148 155 176 149 198 135" />
    <path className="boat-strake" d="M16 120 C 38 132 70 142 116 144 C 148 145 178 139 202 126" />
    <circle className="boat-rivet" cx="34" cy="128" r="1.3" />
    <circle className="boat-rivet" cx="70" cy="140" r="1.3" />
    <circle className="boat-rivet" cx="104" cy="148" r="1.3" />
    <circle className="boat-rivet" cx="140" cy="149" r="1.3" />
    <circle className="boat-rivet" cx="176" cy="143" r="1.3" />
    <circle className="boat-porthole" cx="150" cy="132" r="6.5" fill={paint('glass')} />
    <circle className="boat-porthole-rim" cx="150" cy="132" r="6.5" />
    <circle className="boat-lifering" cx="180" cy="141" r="6.2" fill={paint('hull-band')} />
    <circle className="boat-lifering-hole" cx="180" cy="141" r="2.6" fill={paint('hull')} />
    <path className="boat-lifering-band" d="M180 135 L180 138 M180 144 L180 147 M174 141 L177 141 M183 141 L186 141" />
    <path className="boat-stem" d="M4 100 C 12 104 18 112 20 124 C 22 136 20 144 16 150 L4 142 C 8 128 6 112 4 100 Z" fill={paint('wood-deep')} />
    <path className="boat-transom" d="M200 118 L214 120 L216 140 C 216 150 211 155 205 157 L198 154 C 196 142 197 128 200 118 Z" fill={paint('wood-deep')} />
    <path className="boat-nameplate" d="M202 124 L213 126 L213 133 L202 132 Z" fill={paint('hull-band')} />

    {/* The deck: planked, with a bulwark rail and stanchions. */}
    <path className="boat-deck" d="M7 108 L212 116 L212 127 L9 120 Z" fill={paint('deck')} />
    <path className="boat-plank-seam" d="M30 110 L30 119" />
    <path className="boat-plank-seam" d="M58 111 L58 120" />
    <path className="boat-plank-seam" d="M86 113 L86 122" />
    <path className="boat-plank-seam" d="M114 114 L114 123" />
    <path className="boat-plank-seam" d="M142 115 L142 124" />
    <path className="boat-plank-seam" d="M170 116 L170 125" />
    <path className="boat-deck-grain" d="M14 112 L200 129" />
    <path className="boat-gunwale" d="M4 108 L213 116" />
    <path className="boat-gunwale-inner" d="M6 113 L212 121" />
    {/* The crew's gear: a fish crate at the bow, a net bag, a bucket, a rope coil. */}
    <path className="boat-fishbox" d="M6 122 L32 124 L31 138 L7 136 Z" fill={paint('wood')} />
    <path className="boat-fishbox-rim" d="M5 120 L33 123 L33 128 L5 125 Z" fill={paint('wood-deep')} />
    <path className="boat-fishbox-slats" d="M12 124 L12 137 M19 125 L19 137 M26 125 L26 137" />
    <path className="boat-catch-tail" d="M14 122 Q 12 112 20 114 Q 17 119 17 122 Z" fill={paint('metal')} />
    <path className="boat-catch-tail" d="M24 123 Q 24 115 30 117 Q 27 120 27 123 Z" fill={paint('metal')} opacity=".85" />
    <path className="boat-net" d="M64 112 C 63 128 85 130 88 112 Z" fill={paint('hull-band')} opacity=".5" />
    <path className="boat-net-line" d="M66 114 Q 75 126 86 114 M70 118 Q 75 130 80 118 M68 125 Q 75 132 82 124" />
    <circle className="boat-cork" cx="71" cy="128" r="2.4" fill={paint('flag')} />
    <circle className="boat-cork" cx="81" cy="130" r="2.2" fill={paint('flag')} />
    <path className="boat-bucket" d="M89 112 L101 113 L99 128 L91 127 Z" fill={paint('bucket')} />
    <path className="boat-bucket-rim" d="M88 111 L102 112 L102 115 L88 114 Z" fill={paint('metal-deep')} />
    <path className="boat-bucket-handle" d="M90 111 Q 95 104 100 112" />
    <path className="boat-catch-tail" d="M95 112 Q 93 104 99 105 Q 97 109 97 112 Z" fill={paint('metal')} opacity=".9" />
    <ellipse className="boat-rope" cx="112" cy="70" rx="10" ry="4.6" />
    <ellipse className="boat-rope" cx="112" cy="67" rx="8.4" ry="3.6" />
    <path className="boat-rope-tail" d="M120 72 Q 128 74 131 78" />

    {/* The angler: boots, rain jacket, the arm out to the rod grip (where
        RIG_DX.rodBase and RIG_Y.rodBase put the butt of the rod), a sou'wester. */}
    <path className="angler-boot" d="M32 112 L42 113 L42 124 Q 36 126 32 124 Z" />
    <path className="angler-boot" d="M44 113 L54 114 L54 125 Q 48 127 44 125 Z" />
    <path className="angler-body" d="M26 114 Q 23 88 36 79 L52 79 Q 63 88 62 114 Z" fill={paint('jacket')} />
    <path className="angler-jacket-fold" d="M34 84 Q 44 88 44 114 L36 114 Q 33 96 34 84 Z" fill="#1d4a68" opacity=".35" />
    <path className="angler-belt" d="M27 98 Q 44 94 61 98" />
    <path className="angler-hood" d="M33 80 Q 39 71 48 73 Q 55 75 56 82 Z" fill={paint('jacket')} />
    <circle className="angler-head" cx="45" cy="63" r="10" fill={paint('skin')} />
    <path className="angler-hat" d="M33 55 Q 45 38 57 55 Z" fill={paint('hat')} />
    <path className="angler-hat-brim" d="M28 54 Q 45 48 62 54 Q 45 60 28 54 Z" fill={paint('hat')} />
    <path className="angler-scarf" d="M35 73 Q 45 69 55 73 Q 45 77 35 73 Z" fill="#e26b44" />
    <path className="angler-arm" d="M54 92 Q 66 88 67 78" />
    <circle className="angler-hand" cx="68" cy="72" r="4.4" fill={paint('skin')} />
  </svg>;
}
