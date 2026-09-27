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

import fishBassPhoto from './photo-assets/fish-bass.webp';
import fishFlounderPhoto from './photo-assets/fish-flounder.webp';
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
  flounder: fishFlounderPhoto,
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
