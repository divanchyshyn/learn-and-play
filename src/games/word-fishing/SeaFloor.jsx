import { PHOTOS } from './photos.js';
import { PhotoSprite } from './PhotoSprite.jsx';

// The seabed that is always there, whoever is fishing: a photographed sandy floor
// with its own ripples and dapples, the grain and the light CSS tiles over it, and
// the scenery a child always finds down there – a rock cluster, the old anchor, a
// piece of driftwood and a scatter of stones. The weed that grows at the front of
// the stage is a layer of its own (see `ForegroundWeed` below).
//
// The picture is sand and nothing else: the aerial shot it came from also held a
// shoreline, a tidal channel and a pale strip down one edge, and all of that is
// cut away, because whatever a plate holds is what the floor will show. The sand
// is pasted with `cover` and anchored to its bottom edge, and its top edge is
// faded in by a mask (see style.css): the floor has no edge of its own in the
// water, so it must never end in a line. The sprites keep sea-box coordinates, so
// trip.js and the scene still agree on where a find lands.
//
// Every sprite here is decorative, never focusable and never read out.

export function SandFloor() {
  return <div className="sea-bed" aria-hidden="true" style={{ '--seabed-photo': `url(${PHOTOS.seabed})` }}>
    <span className="sand-grain" />
    <span className="sand-light" />
  </div>;
}

// Kelp grows from the sand: two photographs of real weed, chosen by variant so the
// blades at the two edges of the water are not the same plant.
export function Kelp({ variant = 'a' }) {
  return <PhotoSprite className="reef-art" photo={variant === 'b' ? PHOTOS.kelpB : PHOTOS.kelpA} />;
}

// The weed stands at the very front of the stage, so it is painted in its own layer
// over the sand - and over every find and prop the collection has put on the sand.
// Nothing is ever drawn on top of the plant: in the scene it is the nearest thing
// to the child's eye, and an item painted across a plant reads as a sticker
// floating in front of the weed, which is the one thing a real foreground never
// looks like. The clumps are planted where the collection is not (the layout guard
// in PhotoAssets.test.js keeps them there), so the layer never swallows a find
// either - and where a narrower sea pushes a clump against a prop, the plant wins,
// which is the right way round.
export function ForegroundWeed() {
  return <div className="sea-weed" aria-hidden="true">
    <span className="lake-kelp kelp-a"><Kelp variant="a" /></span>
    <span className="lake-kelp kelp-b"><Kelp variant="b" /></span>
    <span className="lake-kelp kelp-c"><Kelp variant="b" /></span>
  </div>;
}

export function RockCluster() {
  return <PhotoSprite className="reef-art" photo={PHOTOS.rockCluster} />;
}

export function Stones() {
  return <PhotoSprite className="reef-art" photo={PHOTOS.stones} />;
}

export function Driftwood() {
  return <PhotoSprite className="reef-art" photo={PHOTOS.driftwood} />;
}

export function Anchor() {
  return <PhotoSprite className="reef-art" photo={PHOTOS.anchor} />;
}
