// The sea's palette: every gradient the scene paints with, defined exactly once
// and referenced by id from all the artwork through `paint('hull')`.
//
// One shared block, on purpose: a paint reference (`url(#id)`) is resolved
// against the whole document, so a single definition serves the boat, the fish,
// the seabed, the treasures and even the fishing book's own little previews
// without an id ever being repeated. A repeated id would silently make one
// sprite paint itself with another sprite's colours, and two sprites define the
// same gradient whenever a fish species or a treasure shows up twice on screen –
// which is exactly why the artwork never defines its own gradients.
//
// Deliberately no SVG filters and no animated gradients: every gradient here is
// painted once and never changes, and all motion in the scene is CSS transform
// and opacity. That is what keeps a tablet's frame rate calm, and it keeps the
// paint layer of a page that can hold sixteen treasures cheap.
//
// Textures (sand grain, pebbles, caustic light on the floor) are CSS backgrounds
// instead, because a CSS `radial-gradient` tile keeps its round shape while the
// stretched sand band would squash a pattern. Rope, net and planking are drawn
// as paths, where a few strokes read better than any repeating tile.
const PREFIX = 'wf';

// The paint of one shared definition, ready to drop into `fill` or `stroke`.
export function paint(name) {
  return `url(#${PREFIX}-${name})`;
}

function def(name) {
  return `${PREFIX}-${name}`;
}

export function SeaArtDefs() {
  return <svg className="sea-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      {/* ---- Sky and air -------------------------------------------------- */}
      <linearGradient id={def('sky')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7cc4e6" />
        <stop offset=".45" stopColor="#a9dcf1" />
        <stop offset=".8" stopColor="#d7eef8" />
        <stop offset="1" stopColor="#eef9fc" />
      </linearGradient>
      <radialGradient id={def('sun')} cx=".5" cy=".5" r=".5" fx=".38" fy=".34">
        <stop offset="0" stopColor="#fffdf0" />
        <stop offset=".5" stopColor="#ffe79b" />
        <stop offset=".85" stopColor="#f6bd46" />
        <stop offset="1" stopColor="#e8a52e" />
      </radialGradient>
      <radialGradient id={def('sun-glow')} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#ffecb4" stopOpacity=".8" />
        <stop offset=".45" stopColor="#ffe18c" stopOpacity=".32" />
        <stop offset="1" stopColor="#ffe18c" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={def('cloud')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffef9" />
        <stop offset=".62" stopColor="#f2f8fb" />
        <stop offset="1" stopColor="#d9e9f1" />
      </linearGradient>
      <linearGradient id={def('cloud-shade')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c8dfea" />
        <stop offset="1" stopColor="#a6c8d9" />
      </linearGradient>
      <linearGradient id={def('island')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8db8b1" />
        <stop offset="1" stopColor="#5c8b85" />
      </linearGradient>
      <linearGradient id={def('island-far')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#aecfca" />
        <stop offset="1" stopColor="#8fb4b4" />
      </linearGradient>
      <linearGradient id={def('lighthouse')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf3" />
        <stop offset="1" stopColor="#dcc9a6" />
      </linearGradient>

      {/* ---- The water ---------------------------------------------------- */}
      <linearGradient id={def('water')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#83cee2" />
        <stop offset=".35" stopColor="#4aa9c7" />
        <stop offset=".72" stopColor="#22708f" />
        <stop offset="1" stopColor="#17506c" />
      </linearGradient>
      <linearGradient id={def('water-sheen')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".42" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={def('wave-crest')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf3" />
        <stop offset=".5" stopColor="#fffdf3" stopOpacity=".72" />
        <stop offset="1" stopColor="#fffdf3" stopOpacity=".08" />
      </linearGradient>
      <linearGradient id={def('foam')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf3" stopOpacity=".95" />
        <stop offset="1" stopColor="#fffdf3" stopOpacity=".12" />
      </linearGradient>
      <linearGradient id={def('ray')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf3" stopOpacity=".55" />
        <stop offset="1" stopColor="#fffdf3" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={def('depth-haze')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7cbed7" stopOpacity="0" />
        <stop offset="1" stopColor="#4a96b4" stopOpacity=".55" />
      </linearGradient>
      <radialGradient id={def('bubble')} cx=".35" cy=".3" r=".7">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
        <stop offset=".55" stopColor="#ffffff" stopOpacity=".35" />
        <stop offset="1" stopColor="#ffffff" stopOpacity=".05" />
      </radialGradient>
      <linearGradient id={def('caustic')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".5" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      {/* ---- The boat ----------------------------------------------------- */}
      <linearGradient id={def('hull')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0936f" />
        <stop offset=".42" stopColor="#d06444" />
        <stop offset="1" stopColor="#984025" />
      </linearGradient>
      <linearGradient id={def('hull-band')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf3" />
        <stop offset="1" stopColor="#ded0ad" />
      </linearGradient>
      <linearGradient id={def('deck')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f9ebc9" />
        <stop offset="1" stopColor="#d9bd8d" />
      </linearGradient>
      <linearGradient id={def('cabin')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fdf2d3" />
        <stop offset="1" stopColor="#e3c88c" />
      </linearGradient>
      <linearGradient id={def('cabin-roof')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dcb87e" />
        <stop offset="1" stopColor="#ae8449" />
      </linearGradient>
      <linearGradient id={def('glass')} x1="0" y1="0" x2=".4" y2="1">
        <stop offset="0" stopColor="#dbf0f9" />
        <stop offset=".55" stopColor="#9fd0e6" />
        <stop offset="1" stopColor="#6399b6" />
      </linearGradient>
      <linearGradient id={def('gleam')} x1="0" y1="0" x2=".7" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".85" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={def('brass')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f8dfa1" />
        <stop offset=".5" stopColor="#d5a648" />
        <stop offset="1" stopColor="#986e1f" />
      </linearGradient>
      <linearGradient id={def('steel')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e8f0f4" />
        <stop offset=".5" stopColor="#a3b6c1" />
        <stop offset="1" stopColor="#6b8090" />
      </linearGradient>
      <linearGradient id={def('rope')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0dca8" />
        <stop offset="1" stopColor="#b9985e" />
      </linearGradient>
      <linearGradient id={def('wood')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d29e62" />
        <stop offset="1" stopColor="#96662f" />
      </linearGradient>
      <linearGradient id={def('wood-deep')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a87c46" />
        <stop offset="1" stopColor="#6f4b22" />
      </linearGradient>
      <linearGradient id={def('flag')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f78d6f" />
        <stop offset="1" stopColor="#d24d31" />
      </linearGradient>
      <radialGradient id={def('wake')} cx=".5" cy=".55" r=".5">
        <stop offset="0" stopColor="#fffdf3" stopOpacity=".95" />
        <stop offset=".55" stopColor="#fffdf3" stopOpacity=".35" />
        <stop offset="1" stopColor="#fffdf3" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={def('smoke')} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".8" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={def('jacket')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5191b0" />
        <stop offset="1" stopColor="#255577" />
      </linearGradient>
      <radialGradient id={def('skin')} cx=".36" cy=".3" r=".75">
        <stop offset="0" stopColor="#fbe0ba" />
        <stop offset="1" stopColor="#e0aa7b" />
      </radialGradient>
      <linearGradient id={def('hat')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4c466" />
        <stop offset="1" stopColor="#c68c22" />
      </linearGradient>
      <linearGradient id={def('bucket')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d3dfe4" />
        <stop offset="1" stopColor="#7e96a2" />
      </linearGradient>
      <radialGradient id={def('lamp')} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff2bd" stopOpacity=".95" />
        <stop offset=".45" stopColor="#ffe08a" stopOpacity=".45" />
        <stop offset="1" stopColor="#ffe08a" stopOpacity="0" />
      </radialGradient>
      {/* ---- The seabed --------------------------------------------------- */}
      <linearGradient id={def('sand')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f9eec6" />
        <stop offset=".5" stopColor="#e8d5a0" />
        <stop offset="1" stopColor="#cdb476" />
      </linearGradient>
      <linearGradient id={def('sand-ridge')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fdf6d9" />
        <stop offset="1" stopColor="#eedda6" />
      </linearGradient>
      <linearGradient id={def('sand-deep')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d9c389" />
        <stop offset="1" stopColor="#ab9059" />
      </linearGradient>
      <radialGradient id={def('pebble')} cx=".36" cy=".3" r=".75">
        <stop offset="0" stopColor="#c9b892" />
        <stop offset="1" stopColor="#8d805e" />
      </radialGradient>
      <linearGradient id={def('rock')} x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stopColor="#c9d5da" />
        <stop offset=".55" stopColor="#95a6af" />
        <stop offset="1" stopColor="#687b85" />
      </linearGradient>
      <linearGradient id={def('rock-light')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eaf1f3" />
        <stop offset="1" stopColor="#bccad0" />
      </linearGradient>
      <linearGradient id={def('rock-dark')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8a9aa3" />
        <stop offset="1" stopColor="#566973" />
      </linearGradient>
      <linearGradient id={def('moss')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#95d6a7" />
        <stop offset="1" stopColor="#47865c" />
      </linearGradient>
      <linearGradient id={def('weed')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9adcac" />
        <stop offset="1" stopColor="#39734f" />
      </linearGradient>
      <linearGradient id={def('weed-dark')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#63ad7c" />
        <stop offset="1" stopColor="#2b5b3d" />
      </linearGradient>
      <linearGradient id={def('driftwood')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#cfb287" />
        <stop offset="1" stopColor="#876c4c" />
      </linearGradient>
      <linearGradient id={def('rust')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bb7a4d" />
        <stop offset="1" stopColor="#784222" />
      </linearGradient>
      <linearGradient id={def('metal')} x1="0" y1="0" x2=".4" y2="1">
        <stop offset="0" stopColor="#e3ebee" />
        <stop offset=".5" stopColor="#9dafb8" />
        <stop offset="1" stopColor="#63747c" />
      </linearGradient>
      <linearGradient id={def('metal-deep')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8b9ca4" />
        <stop offset="1" stopColor="#4c5e67" />
      </linearGradient>
      <linearGradient id={def('haze')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8fc8dd" stopOpacity=".8" />
        <stop offset="1" stopColor="#8fc8dd" stopOpacity="0" />
      </linearGradient>
      {/* ---- The treasures the seabed grows -------------------------------- */}
      {/* A starfish: warm coral with a paler, softer belly. */}
      <radialGradient id={def('star-body')} cx=".5" cy=".5" r=".62" fx=".36" fy=".3">
        <stop offset="0" stopColor="#ffc9a8" />
        <stop offset=".55" stopColor="#f08a63" />
        <stop offset="1" stopColor="#ce5033" />
      </radialGradient>
      <radialGradient id={def('star-belly')} cx=".5" cy=".45" r=".6">
        <stop offset="0" stopColor="#ffe2ce" />
        <stop offset="1" stopColor="#f4a184" />
      </radialGradient>
      {/* Coral: branching arms that lighten towards the polyps. */}
      <linearGradient id={def('coral-body')} x1="0" y1="1" x2=".3" y2="0">
        <stop offset="0" stopColor="#b94e6b" />
        <stop offset=".5" stopColor="#e2718f" />
        <stop offset="1" stopColor="#f7a0b6" />
      </linearGradient>
      <radialGradient id={def('coral-bud')} cx=".38" cy=".32" r=".7">
        <stop offset="0" stopColor="#ffe3ec" />
        <stop offset="1" stopColor="#e8849f" />
      </radialGradient>
      <radialGradient id={def('shell-body')} cx=".42" cy=".28" r=".75">
        <stop offset="0" stopColor="#fdeed3" />
        <stop offset=".6" stopColor="#f0c894" />
        <stop offset="1" stopColor="#d09a5e" />
      </radialGradient>
      <radialGradient id={def('shell-inner')} cx=".45" cy=".4" r=".7">
        <stop offset="0" stopColor="#fff7ec" />
        <stop offset="1" stopColor="#f1cda4" />
      </radialGradient>
      {/* The wreck: bleached planking over dark tar, ribs gone pale, glass gone green. */}
      <linearGradient id={def('wreck-hull')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a89273" />
        <stop offset=".5" stopColor="#836f58" />
        <stop offset="1" stopColor="#574838" />
      </linearGradient>
      <linearGradient id={def('wreck-rib')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b09a7c" />
        <stop offset="1" stopColor="#75624c" />
      </linearGradient>
      <radialGradient id={def('wreck-glass')} cx=".38" cy=".3" r=".7">
        <stop offset="0" stopColor="#dcecf2" />
        <stop offset="1" stopColor="#7ba3b5" />
      </radialGradient>
      <linearGradient id={def('grass-body')} x1="0" y1="1" x2=".2" y2="0">
        <stop offset="0" stopColor="#39734f" />
        <stop offset=".55" stopColor="#5da876" />
        <stop offset="1" stopColor="#a6e2b4" />
      </linearGradient>
      <radialGradient id={def('crab-shell')} cx=".45" cy=".32" r=".72">
        <stop offset="0" stopColor="#f9a37c" />
        <stop offset=".55" stopColor="#e2714f" />
        <stop offset="1" stopColor="#b84026" />
      </radialGradient>
      <linearGradient id={def('crab-under')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0c4a8" />
        <stop offset="1" stopColor="#cf8b6a" />
      </linearGradient>
      <linearGradient id={def('crab-claw')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f5956d" />
        <stop offset="1" stopColor="#a93c26" />
      </linearGradient>
      <radialGradient id={def('octo-body')} cx=".4" cy=".28" r=".78">
        <stop offset="0" stopColor="#e3a3ba" />
        <stop offset=".55" stopColor="#c2708f" />
        <stop offset="1" stopColor="#8b4162" />
      </radialGradient>
      <radialGradient id={def('octo-spot')} cx=".4" cy=".35" r=".7">
        <stop offset="0" stopColor="#f8d2de" />
        <stop offset="1" stopColor="#d38fa8" />
      </radialGradient>
      <linearGradient id={def('chest-wood')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#cf9a4e" />
        <stop offset="1" stopColor="#91612a" />
      </linearGradient>
      <linearGradient id={def('chest-lid')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e2ba72" />
        <stop offset="1" stopColor="#ab7531" />
      </linearGradient>
      <radialGradient id={def('gold')} cx=".38" cy=".3" r=".72">
        <stop offset="0" stopColor="#fff5c2" />
        <stop offset=".6" stopColor="#f3c95a" />
        <stop offset="1" stopColor="#cd971c" />
      </radialGradient>
      <linearGradient id={def('coin')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffedae" />
        <stop offset="1" stopColor="#d99f1d" />
      </linearGradient>
      {/* The submarine: ochre plates, a lit glass ring, a searchlight. */}
      <linearGradient id={def('sub-hull')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbdb8c" />
        <stop offset=".42" stopColor="#e0ac42" />
        <stop offset=".8" stopColor="#c08c28" />
        <stop offset="1" stopColor="#97681a" />
      </linearGradient>
      <linearGradient id={def('sub-tower')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f9d888" />
        <stop offset="1" stopColor="#b3811f" />
      </linearGradient>
      <radialGradient id={def('sub-glass')} cx=".36" cy=".3" r=".72">
        <stop offset="0" stopColor="#dcf2ff" />
        <stop offset=".6" stopColor="#8dc0da" />
        <stop offset="1" stopColor="#578ba6" />
      </radialGradient>
      <radialGradient id={def('sub-light')} cx="1" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff6cc" stopOpacity=".85" />
        <stop offset=".45" stopColor="#ffe9a6" stopOpacity=".38" />
        <stop offset="1" stopColor="#ffe9a6" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={def('seahorse-body')} x1="0" y1="0" x2=".4" y2="1">
        <stop offset="0" stopColor="#f6d391" />
        <stop offset="1" stopColor="#b8862f" />
      </linearGradient>
      <linearGradient id={def('seahorse-belly')} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff1cf" />
        <stop offset="1" stopColor="#e7c184" />
      </linearGradient>
      <radialGradient id={def('jelly-dome')} cx=".5" cy=".5" r=".65" fx=".36" fy=".26">
        <stop offset="0" stopColor="#eeddff" stopOpacity=".95" />
        <stop offset=".6" stopColor="#c3a6ec" stopOpacity=".75" />
        <stop offset="1" stopColor="#8f6ac6" stopOpacity=".5" />
      </radialGradient>
      <radialGradient id={def('jelly-glow')} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#e6d6ff" stopOpacity=".6" />
        <stop offset="1" stopColor="#e6d6ff" stopOpacity="0" />
      </radialGradient>
      {/* The station: a glass dome on a steel ring, lamps still burning. */}
      <radialGradient id={def('dome-glass')} cx=".38" cy=".22" r=".82">
        <stop offset="0" stopColor="#e6f7fc" stopOpacity=".82" />
        <stop offset=".55" stopColor="#a2d7eb" stopOpacity=".52" />
        <stop offset="1" stopColor="#6aaecb" stopOpacity=".42" />
      </radialGradient>
      <linearGradient id={def('station-body')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0f6f8" />
        <stop offset=".5" stopColor="#b6c7cf" />
        <stop offset="1" stopColor="#778b95" />
      </linearGradient>
      <linearGradient id={def('station-trim')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f5da95" />
        <stop offset="1" stopColor="#bd8f2c" />
      </linearGradient>
      <radialGradient id={def('station-light')} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#fff3c4" stopOpacity=".9" />
        <stop offset=".45" stopColor="#ffe9a8" stopOpacity=".4" />
        <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={def('bell-brass')} cx=".42" cy=".24" r=".8">
        <stop offset="0" stopColor="#fdedbd" />
        <stop offset=".5" stopColor="#d5a648" />
        <stop offset="1" stopColor="#8b681b" />
      </radialGradient>
      <linearGradient id={def('bell-dark')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a98b3c" />
        <stop offset="1" stopColor="#6b5013" />
      </linearGradient>
      <radialGradient id={def('wheel-wood')} cx=".45" cy=".35" r=".7">
        <stop offset="0" stopColor="#dcb075" />
        <stop offset="1" stopColor="#8b5e33" />
      </radialGradient>
      <radialGradient id={def('wheel-hub')} cx=".38" cy=".3" r=".7">
        <stop offset="0" stopColor="#f7de9d" />
        <stop offset="1" stopColor="#a2782a" />
      </radialGradient>
      <linearGradient id={def('amphora')} x1="0" y1="0" x2=".15" y2="1">
        <stop offset="0" stopColor="#f0be84" />
        <stop offset=".5" stopColor="#d2924f" />
        <stop offset="1" stopColor="#99622c" />
      </linearGradient>
      <linearGradient id={def('amphora-mouth')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6d4520" />
        <stop offset="1" stopColor="#a1703a" />
      </linearGradient>
      <radialGradient id={def('bottle-glass')} cx=".35" cy=".28" r=".78">
        <stop offset="0" stopColor="#dcf7f3" stopOpacity=".8" />
        <stop offset=".6" stopColor="#8ecfc8" stopOpacity=".5" />
        <stop offset="1" stopColor="#54968f" stopOpacity=".4" />
      </radialGradient>
      <linearGradient id={def('message')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fffcef" />
        <stop offset="1" stopColor="#e0cda0" />
      </linearGradient>
      <linearGradient id={def('cork')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e0bf85" />
        <stop offset="1" stopColor="#a1733a" />
      </linearGradient>
      <radialGradient id={def('lantern-glass')} cx=".5" cy=".5" r=".55">
        <stop offset="0" stopColor="#fffbe0" stopOpacity=".98" />
        <stop offset=".6" stopColor="#ffdd93" stopOpacity=".7" />
        <stop offset="1" stopColor="#ffc85c" stopOpacity=".35" />
      </radialGradient>
    </defs>
  </svg>;
}
