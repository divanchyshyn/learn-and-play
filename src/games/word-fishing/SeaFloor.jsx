import { PHOTOS } from './photos.js';
import { PhotoSprite } from './PhotoSprite.jsx';

// The seabed that is always there, whoever is fishing: a photographed sandy floor
// with its own ripples and dapples, the grain and the light CSS tiles over it, and
// the scenery a child always finds down there – kelp at the edges, a rock cluster,
// the old anchor, a piece of driftwood and a scatter of stones.
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
