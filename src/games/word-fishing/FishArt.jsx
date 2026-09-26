// The fish a word swims in as: six species, each with its own silhouette, fins,
// pattern and eye, painted from the colour the shoal gave it (`--f1`, `--f2`,
// `--f3` in style.css) so a new colour is still one CSS line.
//
// Which species a fish is comes from the word it carries (see speciesForWord):
// pure, deterministic and independent of the sea's own state, so a fish keeps its
// shape for its whole visible life and a test can pin it down. The shading is
// hand-drawn tones – a dark back, a pale belly, a rim light – rather than a
// gradient, because a gradient would have to be defined per fish instance and
// repeated ids would make two fish share one palette.
//
// A fish faces right in its own drawing and the sprite flips it with `--dir`.

export const FISH_SPECIES = ['bass', 'mackerel', 'trout', 'flounder', 'puffer', 'tropical'];

// Any word always gets the very same species, whatever else happens in the sea.
export function speciesForWord(word) {
  let hash = 7;
  for (let index = 0; index < word.length; index += 1) {
    hash = (hash * 31 + word.charCodeAt(index)) % 1000003;
  }
  return FISH_SPECIES[hash % FISH_SPECIES.length];
}

// ---- The species ----------------------------------------------------------
// Every species is a full drawing in its own box, facing right. The classes are
// painted in style.css from the fish's own colours, so a body, a fin, a stripe
// and an eye all read the same way in every species.

function Bass() {
  return <svg className="fish-drawing" viewBox="0 0 120 74" aria-hidden="true" focusable="false">
    <path className="fish-fin" d="M30 37 L4 12 L13 37 L4 62 Z" />
    <path className="fish-fin-ray" d="M28 31 L9 15 M27 37 L6 37 M28 43 L9 59" />
    <path className="fish-fin" d="M48 17 Q 62 -1 80 13 Q 64 13 52 24 Z" />
    <path className="fish-fin-ray" d="M55 19 L59 11 M63 16 L67 9 M71 16 L75 10" />
    <path className="fish-fin" d="M78 13 Q 90 11 97 20 Q 86 17 78 20 Z" />
    <path className="fish-body" d="M30 37 C 34 15 58 6 82 12 C 100 17 112 26 116 37 C 112 48 100 57 82 62 C 58 68 34 59 30 37 Z" />
    <path className="fish-back" d="M34 27 C 44 11 66 7 88 15 C 99 19 109 27 113 35 C 105 25 91 17 75 16 C 55 15 42 21 34 27 Z" />
    <path className="fish-belly" d="M34 43 C 44 59 66 65 88 59 C 98 56 106 50 111 43 C 106 53 94 61 78 63 C 56 66 40 56 34 43 Z" />
    <path className="fish-rim" d="M40 22 C 54 10 74 8 90 14" />
    <path className="fish-fin" d="M62 50 Q 74 68 92 55 Q 78 62 66 52 Z" />
    <path className="fish-fin-ray" d="M66 52 Q 74 60 86 56" />
    <path className="fish-fin" d="M52 56 Q 60 68 74 60 Q 62 60 54 58 Z" />
    <path className="fish-fin" d="M40 52 Q 44 62 56 58 Q 46 56 42 54 Z" />
    <path className="fish-gill" d="M54 17 Q 46 37 54 56" />
    <path className="fish-lateral" d="M60 34 Q 84 28 108 33" />
    <circle className="fish-pattern" cx="70" cy="26" r="3.4" />
    <circle className="fish-pattern" cx="80" cy="20" r="2.4" />
    <circle className="fish-pattern" cx="86" cy="32" r="3" />
    <circle className="fish-pattern" cx="72" cy="42" r="2.6" />
    <circle className="fish-eye" cx="95" cy="27" r="7.6" />
    <circle className="fish-iris" cx="95.6" cy="27" r="5.2" />
    <circle className="fish-pupil" cx="96.6" cy="27" r="2.6" />
    <circle className="fish-glint" cx="94" cy="24" r="1.6" />
    <path className="fish-mouth" d="M110 40 q 7 3 1 8" />
  </svg>;
}

function Mackerel() {
  return <svg className="fish-drawing" viewBox="0 0 132 64" aria-hidden="true" focusable="false">
    <path className="fish-fin" d="M26 32 C 15 24 9 8 3 4 C 10 18 12 26 12 32 C 12 38 10 46 3 60 C 9 56 15 40 26 32 Z" />
    <path className="fish-fin-ray" d="M20 25 L10 11 M19 32 L7 32 M20 39 L10 53" />
    <path className="fish-fin" d="M40 14 Q 56 0 78 12 Q 58 12 44 20 Z" />
    <path className="fish-fin" d="M84 10 L92 6 L96 16 Z" />
    <path className="fish-fin" d="M102 12 L110 9 L112 19 Z" />
    <path className="fish-body" d="M26 32 C 42 15 76 7 106 17 C 118 21 126 26 130 32 C 126 38 118 43 106 47 C 76 57 42 49 26 32 Z" />
    <path className="fish-back" d="M30 26 C 46 11 78 5 106 15 C 118 19 124 25 128 30 C 120 22 108 17 92 15 C 66 12 44 19 30 26 Z" />
    <path className="fish-belly" d="M30 38 C 44 52 78 58 106 48 C 116 44 122 39 127 34 C 122 42 112 48 98 51 C 68 57 44 50 30 38 Z" />
    <path className="fish-rim" d="M36 22 C 52 10 80 7 100 14" />
    <path className="fish-stripe" d="M46 18 Q 42 32 46 46" />
    <path className="fish-stripe" d="M58 14 Q 54 32 58 50" />
    <path className="fish-stripe" d="M70 12 Q 66 32 70 52" />
    <path className="fish-stripe" d="M82 12 Q 78 32 82 52" />
    <path className="fish-stripe" d="M94 15 Q 90 32 94 49" />
    <path className="fish-fin" d="M60 46 Q 70 60 88 50 Q 74 54 64 46 Z" />
    <path className="fish-fin" d="M52 50 Q 60 60 72 54 Q 62 53 54 51 Z" />
    <path className="fish-gill" d="M48 16 Q 42 32 48 48" />
    <path className="fish-lateral" d="M54 30 Q 84 22 122 31" />
    <circle className="fish-eye" cx="112" cy="26" r="6.4" />
    <circle className="fish-iris" cx="112.6" cy="26" r="4.4" />
    <circle className="fish-pupil" cx="113.4" cy="26" r="2.2" />
    <circle className="fish-glint" cx="111" cy="23.4" r="1.4" />
    <path className="fish-mouth" d="M126 34 q 5 3 0 7" />
  </svg>;
}

function Trout() {
  return <svg className="fish-drawing" viewBox="0 0 124 60" aria-hidden="true" focusable="false">
    <path className="fish-fin" d="M28 30 L4 10 L12 30 L4 52 Z" />
    <path className="fish-fin-ray" d="M26 25 L9 13 M25 30 L6 30 M26 35 L9 47" />
    <path className="fish-fin" d="M44 12 Q 58 -2 76 10 Q 58 10 46 18 Z" />
    <path className="fish-fin" d="M74 14 Q 80 10 84 16 Q 78 16 74 18 Z" />
    <path className="fish-body" d="M28 30 C 36 12 62 4 88 10 C 104 14 114 21 118 30 C 114 39 104 46 88 50 C 62 56 36 48 28 30 Z" />
    <path className="fish-back" d="M32 24 C 44 9 66 4 88 11 C 100 15 108 21 112 28 C 104 20 92 14 78 12 C 58 9 42 17 32 24 Z" />
    <path className="fish-belly" d="M32 36 C 42 50 66 54 88 48 C 98 45 106 40 112 34 C 106 43 96 50 82 52 C 58 55 42 46 32 36 Z" />
    <path className="fish-rim" d="M38 19 C 50 9 70 6 86 12" />
    <path className="fish-fin" d="M60 42 Q 70 56 86 46 Q 72 50 62 42 Z" />
    <path className="fish-fin" d="M50 46 Q 56 56 68 50 Q 58 49 52 47 Z" />
    <path className="fish-gill" d="M50 14 Q 44 30 50 46" />
    <path className="fish-lateral" d="M56 27 Q 84 20 112 28" />
    <circle className="fish-pattern" cx="64" cy="22" r="2.6" />
    <circle className="fish-pattern" cx="74" cy="18" r="2.2" />
    <circle className="fish-pattern" cx="80" cy="28" r="2.8" />
    <circle className="fish-pattern" cx="70" cy="34" r="2.4" />
    <circle className="fish-pattern" cx="92" cy="20" r="2" />
    <circle className="fish-pattern fish-pattern-warm" cx="86" cy="36" r="2.2" />
    <circle className="fish-pattern fish-pattern-warm" cx="62" cy="30" r="1.8" />
    <circle className="fish-eye" cx="100" cy="24" r="6.6" />
    <circle className="fish-iris" cx="100.6" cy="24" r="4.6" />
    <circle className="fish-pupil" cx="101.4" cy="24" r="2.3" />
    <circle className="fish-glint" cx="99" cy="21.4" r="1.4" />
    <path className="fish-mouth" d="M113 33 q 6 2 1 7" />
  </svg>;
}

// A flatfish: one flat body, a fringed edge, both eyes on the upper side.
function Flounder() {
  return <svg className="fish-drawing" viewBox="0 0 132 58" aria-hidden="true" focusable="false">
    <path className="fish-fin" d="M18 29 L2 17 Q 9 29 2 41 Z" />
    <path className="fish-fin-ray" d="M16 24 L6 19 M15 29 L3 29 M16 34 L6 39" />
    <path className="fish-fin fish-fringe" d="M14 29 C 16 12 38 3 66 3 C 96 3 120 12 128 29 C 120 46 96 55 66 55 C 38 55 16 46 14 29 Z" />
    <path className="fish-body" d="M16 29 C 20 14 40 6 66 6 C 94 6 118 14 126 29 C 118 44 94 52 66 52 C 40 52 20 44 16 29 Z" />
    <path className="fish-back" d="M20 24 C 28 12 46 6 68 6 C 94 6 114 13 124 26 C 114 16 94 11 68 11 C 46 11 28 17 20 24 Z" />
    <path className="fish-belly" d="M20 36 C 28 47 46 52 68 52 C 92 52 112 46 122 36 C 112 46 92 50 68 50 C 46 50 28 45 20 36 Z" />
    <path className="fish-fin" d="M40 50 Q 48 58 60 54 Q 48 53 43 48 Z" />
    <path className="fish-gill" d="M104 14 Q 96 29 101 45" />
    <path className="fish-lateral" d="M26 30 Q 60 22 112 30" />
    <circle className="fish-pattern" cx="40" cy="20" r="3" />
    <circle className="fish-pattern" cx="54" cy="15" r="2.4" />
    <circle className="fish-pattern" cx="62" cy="26" r="3.4" />
    <circle className="fish-pattern" cx="46" cy="34" r="2.6" />
    <circle className="fish-pattern" cx="72" cy="16" r="2" />
    <circle className="fish-pattern" cx="30" cy="28" r="2.2" />
    <circle className="fish-eye" cx="98" cy="18" r="5.8" />
    <circle className="fish-iris" cx="98.4" cy="18" r="4" />
    <circle className="fish-pupil" cx="99" cy="18" r="2" />
    <circle className="fish-glint" cx="96.6" cy="16" r="1.2" />
    <circle className="fish-eye" cx="109" cy="25" r="5.2" />
    <circle className="fish-iris" cx="109.4" cy="25" r="3.6" />
    <circle className="fish-pupil" cx="110" cy="25" r="1.8" />
    <circle className="fish-glint" cx="107.8" cy="23" r="1.1" />
    <path className="fish-mouth" d="M124 34 q -5 3 -9 1" />
  </svg>;
}

// A puffer: round as a ball, spiked, with a wide eye and a puckered mouth.
function Puffer() {
  return <svg className="fish-drawing" viewBox="0 0 102 90" aria-hidden="true" focusable="false">
    <path className="fish-fin" d="M22 45 L4 32 Q 11 45 4 58 Z" />
    <path className="fish-fin-ray" d="M20 40 L8 34 M19 45 L5 45 M20 50 L8 56" />
    <path className="fish-spines" d="M32 16 L28 5 L40 11 Z M48 10 L48 1 L56 9 Z M66 12 L74 3 L72 14 Z M84 22 L92 16 L88 28 Z M92 40 L102 40 L92 48 Z M86 60 L94 68 L82 68 Z M68 74 L72 84 L60 78 Z M48 80 L44 89 L38 79 Z M30 68 L20 76 L24 64 Z M20 50 L10 52 L20 42 Z" />
    <path className="fish-body" d="M22 45 C 22 22 40 10 58 10 C 82 10 96 25 96 45 C 96 66 82 81 58 81 C 40 81 22 68 22 45 Z" />
    <path className="fish-back" d="M28 34 C 34 18 46 12 60 12 C 80 12 92 22 94 38 C 88 24 76 17 60 17 C 44 17 33 25 28 34 Z" />
    <path className="fish-belly" d="M28 56 C 34 70 46 79 60 79 C 78 79 90 70 93 56 C 88 70 76 76 60 76 C 44 76 33 68 28 56 Z" />
    <path className="fish-fin" d="M48 66 Q 56 82 70 72 Q 58 72 52 68 Z" />
    <path className="fish-gill" d="M74 20 Q 66 45 72 72" />
    <circle className="fish-pattern" cx="42" cy="30" r="3" />
    <circle className="fish-pattern" cx="52" cy="22" r="2.2" />
    <circle className="fish-pattern" cx="40" cy="50" r="2.6" />
    <circle className="fish-pattern" cx="52" cy="62" r="2" />
    <circle className="fish-eye" cx="82" cy="34" r="9" />
    <circle className="fish-iris" cx="82.6" cy="34" r="6.4" />
    <circle className="fish-pupil" cx="83.6" cy="34" r="3.2" />
    <circle className="fish-glint" cx="80" cy="30" r="2" />
    <path className="fish-mouth" d="M94 50 q -6 4 -8 0" />
    <circle className="fish-cheek" cx="88" cy="44" r="3.4" />
  </svg>;
}

// A reef fish: a tall body, long fins with a streamer, and bold bands.
function Tropical() {
  return <svg className="fish-drawing" viewBox="0 0 106 94" aria-hidden="true" focusable="false">
    <path className="fish-fin" d="M24 47 L2 27 L10 47 L2 67 Z" />
    <path className="fish-fin-ray" d="M22 41 L8 30 M21 47 L5 47 M22 53 L8 64" />
    <path className="fish-fin" d="M34 32 C 40 10 54 0 70 2 C 60 10 50 18 46 32 Z" />
    <path className="fish-fin" d="M64 4 Q 80 -4 88 8 Q 76 4 70 12 Z" />
    <path className="fish-fin" d="M36 62 C 42 84 58 94 74 90 C 62 80 52 70 48 60 Z" />
    <path className="fish-body" d="M26 47 C 26 24 42 10 64 10 C 86 10 99 26 99 47 C 99 68 86 84 64 84 C 42 84 26 70 26 47 Z" />
    <path className="fish-back" d="M30 34 C 36 16 48 12 64 12 C 82 12 94 24 96 40 C 90 24 78 17 62 17 C 44 17 35 25 30 34 Z" />
    <path className="fish-belly" d="M30 60 C 36 76 48 82 64 82 C 82 82 94 72 96 56 C 92 72 80 78 64 78 C 46 78 35 70 30 60 Z" />
    <path className="fish-stripe" d="M44 16 Q 39 47 44 80" />
    <path className="fish-stripe" d="M58 11 Q 53 47 58 84" />
    <path className="fish-stripe" d="M72 12 Q 67 47 72 83" />
    <path className="fish-fin" d="M40 60 Q 50 74 64 66 Q 50 68 44 62 Z" />
    <path className="fish-gill" d="M82 16 Q 74 47 80 80" />
    <path className="fish-rim" d="M34 26 C 42 10 56 6 68 8" />
    <circle className="fish-eye" cx="86" cy="36" r="7.4" />
    <circle className="fish-iris" cx="86.6" cy="36" r="5.2" />
    <circle className="fish-pupil" cx="87.6" cy="36" r="2.6" />
    <circle className="fish-glint" cx="84" cy="33" r="1.6" />
    <path className="fish-mouth" d="M98 43 q 6 4 0 9" />
  </svg>;
}

// Which drawing belongs to which species. A species this version does not know
// falls back to the plain bass, so a fish can never end up without a shape.
const SPECIES_ART = {
  bass: Bass,
  mackerel: Mackerel,
  trout: Trout,
  flounder: Flounder,
  puffer: Puffer,
  tropical: Tropical,
};

export function FishArt({ species }) {
  const Art = SPECIES_ART[species] ?? Bass;
  return <Art />;
}
