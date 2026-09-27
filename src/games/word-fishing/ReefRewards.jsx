import { PHOTOS } from './photos.js';
import { PhotoSprite } from './PhotoSprite.jsx';

// The treasures the seabed grows: one finished trip, one discovery. Ten of them,
// from the wreck a child meets first to the message in a bottle that ends the
// collection. Each one is a photograph of the real thing – a broken wreck lying on
// its side, a submarine with a glass dome, a seahorse with its tail curled – cut
// out of its own picture, because this is the reward a child keeps coming back for.
//
// A photograph cannot be recoloured or repainted from a palette the way a drawing
// could, so the shared look comes from the one grade the whole scene gets (see the
// depth, grain and vignette layers in SeaScene.jsx) and from the per-find life
// each treasure keeps in style.css: the jellyfish drifts, the seahorse bobs, the
// station breathes, and every sprite is decorative – it never catches a pointer
// and never reaches assistive tech.

// Which photograph belongs to which treasure, keyed exactly like the reward ids
// the reef hands out (see REEF_REWARDS in trip.js). The keys are the file names,
// so a new find is one import in photos.js and one line here.
const REWARD_ART = {
  wreck: PHOTOS.wreck,
  chest: PHOTOS.chest,
  submarine: PHOTOS.submarine,
  seahorse: PHOTOS.seahorse,
  jellyfish: PHOTOS.jellyfish,
  station: PHOTOS.station,
  bell: PHOTOS.bell,
  wheel: PHOTOS.wheel,
  amphora: PHOTOS.amphora,
  bottle: PHOTOS.bottle,
};

// Which treasures this version can paint. Exported so a test can prove that every
// decoration the reef hands out has a picture, and that none is left over.
export const REWARD_IDS = Object.keys(REWARD_ART);

// An id this version does not know paints nothing at all, so a decoration index
// from a newer save can never leave a hole or a broken image in the collection.
export function ReefArt({ id }) {
  const photo = REWARD_ART[id];
  return photo ? <PhotoSprite className="reef-art" photo={photo} /> : null;
}
