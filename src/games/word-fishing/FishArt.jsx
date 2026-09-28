import { FISH_PHOTOS } from './photos.js';
// The fish a word swims in as: six species, each one a real fish photographed and
// cut out of its own picture (see photos.js and `photo-assets/`), so a bass is a
// bass and a mackerel's stripes are its own.
//
// Which species a fish is still comes from the word it carries (see
// speciesForWord): pure, deterministic and independent of the sea's own state, so
// a fish keeps its shape for its whole visible life and a test can pin it down.
//
// A fish faces right in its photograph and the sprite flips it with `--dir`. Each
// species also carries its own size correction (`.species-…` in style.css): a tall
// reef fish must not tower over a slim mackerel just because its picture is taller.

export const FISH_SPECIES = ['bass', 'mackerel', 'trout', 'crappie', 'puffer', 'tropical'];

// Any word always gets the very same species, whatever else happens in the sea.
export function speciesForWord(word) {
  let hash = 7;
  for (let index = 0; index < word.length; index += 1) {
    hash = (hash * 31 + word.charCodeAt(index)) % 1000003;
  }
  return FISH_SPECIES[hash % FISH_SPECIES.length];
}

// Which picture belongs to which species. A species this version does not know
// falls back to the bass, so a fish can never end up without a shape.
export function fishPhoto(species) {
  return FISH_PHOTOS[species] ?? FISH_PHOTOS.bass;
}

export function FishArt({ species }) {
  return <img
    className="fish-drawing"
    src={fishPhoto(species)}
    alt=""
    aria-hidden="true"
    draggable="false"
    decoding="async"
  />;
}
