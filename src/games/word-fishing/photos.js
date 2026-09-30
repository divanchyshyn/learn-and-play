// Every photograph the game ships, imported so the build fingerprints and copies
// them (see `photo-assets/` next to this file).
//
// The art is photographic now, but the drawing rules did not change with it:
//
//   * Fish are the six species a word can swim in (see FishArt.jsx). A species is
//     a real fish, cut out of its own picture, facing right - the sprite flips it
//     with `--dir`, exactly as the old drawings were flipped.
//   * Treasures are keyed by the reward id in trip.js, so an id without a picture
//     paints nothing at all (see ReefRewards.jsx).
//   * Plates are the scene's backdrops and strips. They are photographs too, so
//     they are pasted, never stretched: `cover` plus a position that keeps the part
//     that matters (the horizon on the waterline, the surface at the top).
//
// A missing file fails the build at the import below, so a game can never ship
// with a hole in it. A picture is never named after what it shows in Norwegian:
// filenames are English, like every other name in the codebase.

// Two of the fish pictures came off the internet and are committed here already
// cut out, so the licence travels with the picture:
//
//   * fish-crappie.webp  - a black crappie (Pomoxis nigromaculatus), photographed
//     for the UBC Library Digitization Centre's Flickr stream, on Wikimedia
//     Commons: public domain, no known copyright restrictions.
//   * fish-tropical.webp - a Spanish hogfish (Bodianus rufus, adult), photographed
//     for the Smithsonian Institution, on Wikimedia Commons: no known copyright
//     restrictions.
//
// Both were shot as a side view on a plain background, which is what makes a
// clean cut-out possible: the background is keyed away, the fish is mirrored so
// it faces right like every other sprite here, and the long side is 900 px.

// Four of the reef's treasures were replaced in a later pass, and their sources
// travel with them the same way:
//
//   * anchor.webp    - an ink engraving of an admiralty anchor from rawpixel's CC0
//     collection (published as "Anchor png sticker, vintage object"): public domain,
//     no author named. The paper it is drawn on is the light checkerboard a preview
//     bakes in, so the ink is everything dark; the anchor's own outline then encloses
//     its body, making it one solid shape, and the ink's own shading is kept as the
//     iron it is given. The long side is 900 px.
//   * bell.webp      - the ship's bell of the research vessel Roald Amundsen,
//     photographed by Mark Olich, on Wikimedia Commons: CC BY 4.0 - credited here
//     because the licence asks for it. Her brass is measured in the frame and her
//     profile drawn inside it, so no barge comes along with her.
//   * chest.webp     - the chest the game already had, filled: a barrel of coins
//     ("MONEY COINS GOLD SPECIE", rawpixel, CC0) is pasted into her open mouth and
//     warmed from silver to gold. Her own picture is untouched - same canvas, same
//     cut-out edge - so the child sees the chest they know, now full of treasure.
//   * submarine.webp - a yellow tourist submarine, photographed by Djay78 (German
//     Wikipedia) and released into the public domain, on Wikimedia Commons. Her
//     upper half is kept - tower, rails and the row of portholes - against a blue sky
//     that keys away cleanly, with her lowest rows faded into the sand, so she lies
//     on the seabed rather than being sliced off by the edge of a crop.
//
// The station and the bottle keep their old pictures for now: NOAA's Aquarius habitat
// (public domain) and a message-in-a-bottle photograph are the candidates, but neither
// separates from its own background cleanly enough to ship yet.
import fishBassPhoto from './photo-assets/fish-bass.webp';
import fishCrappiePhoto from './photo-assets/fish-crappie.webp';
import fishMackerelPhoto from './photo-assets/fish-mackerel.webp';
import fishPufferPhoto from './photo-assets/fish-puffer.webp';
import fishTropicalPhoto from './photo-assets/fish-tropical.webp';
import fishTroutPhoto from './photo-assets/fish-trout.webp';

import boatPhoto from './photo-assets/boat.webp';
import anglerPhoto from './photo-assets/angler.webp';
import floatPhoto from './photo-assets/float.webp';

import skyPhoto from './photo-assets/plate-sky.webp';
import waterPhoto from './photo-assets/plate-water.webp';
import seabedPhoto from './photo-assets/plate-seabed.webp';
import surfacePhoto from './photo-assets/plate-surface.webp';

import cloudAPhoto from './photo-assets/cloud-a.webp';
import cloudBPhoto from './photo-assets/cloud-b.webp';
import gullPhoto from './photo-assets/gull.webp';

import kelpAPhoto from './photo-assets/kelp-a.webp';
import kelpBPhoto from './photo-assets/kelp-b.webp';
import rockClusterPhoto from './photo-assets/rock-cluster.webp';
import anchorPhoto from './photo-assets/anchor.webp';
import driftwoodPhoto from './photo-assets/driftwood.webp';
import stonesPhoto from './photo-assets/stones.webp';

import wreckPhoto from './photo-assets/wreck.webp';
import chestPhoto from './photo-assets/chest.webp';
import submarinePhoto from './photo-assets/submarine.webp';
import seahorsePhoto from './photo-assets/seahorse.webp';
import jellyfishPhoto from './photo-assets/jellyfish.webp';
import stationPhoto from './photo-assets/station.webp';
import bellPhoto from './photo-assets/bell.webp';
import wheelPhoto from './photo-assets/wheel.webp';
import amphoraPhoto from './photo-assets/amphora.webp';
import bottlePhoto from './photo-assets/bottle.webp';

// The six species, keyed exactly like FISH_SPECIES in FishArt.jsx.
export const FISH_PHOTOS = {
  bass: fishBassPhoto,
  mackerel: fishMackerelPhoto,
  trout: fishTroutPhoto,
  crappie: fishCrappiePhoto,
  puffer: fishPufferPhoto,
  tropical: fishTropicalPhoto,
};

// Everything else, by the name the scene calls it. One flat table, so a module
// asks for `PHOTOS.wreck` and never has to know where the file lives.
export const PHOTOS = {
  boat: boatPhoto,
  angler: anglerPhoto,
  float: floatPhoto,

  sky: skyPhoto,
  water: waterPhoto,
  seabed: seabedPhoto,
  surface: surfacePhoto,

  cloudA: cloudAPhoto,
  cloudB: cloudBPhoto,
  gull: gullPhoto,

  kelpA: kelpAPhoto,
  kelpB: kelpBPhoto,
  rockCluster: rockClusterPhoto,
  anchor: anchorPhoto,
  driftwood: driftwoodPhoto,
  stones: stonesPhoto,

  wreck: wreckPhoto,
  chest: chestPhoto,
  submarine: submarinePhoto,
  seahorse: seahorsePhoto,
  jellyfish: jellyfishPhoto,
  station: stationPhoto,
  bell: bellPhoto,
  wheel: wheelPhoto,
  amphora: amphoraPhoto,
  bottle: bottlePhoto,
};
