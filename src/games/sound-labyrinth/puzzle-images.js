import puzzleSubmarine from './puzzle-assets/submarine-yard.webp';
import puzzleChipmunk from './puzzle-assets/chipmunk.webp';
import puzzleRedSquirrel from './puzzle-assets/red-squirrel.webp';
import puzzleCherryShrimp from './puzzle-assets/cherry-shrimp.webp';
import puzzleBettaFish from './puzzle-assets/betta-fish.webp';
import puzzleCrab from './puzzle-assets/crab.webp';
import puzzleB2Spirit from './puzzle-assets/b-2-spirit.webp';
import puzzleBattleship from './puzzle-assets/battleship.webp';

// The picture rotates between the eight prepared puzzle pictures (one per full
// run): the submarine yard plus a chipmunk, a red squirrel, a cherry shrimp, a
// betta fish, a crab, a B-2 Spirit and a battleship. Every picture is a square
// 1024 x 1024 crop of its original, so the four pieces are simply its four
// quadrants, sliced in CSS at render time.
//
// This list lives in a module of its own - no React, no game state - because the
// gallery merge needs its length: how many pictures a round holds is part of the
// game's rules, and the sync registry must not import a component to learn it.
export const PUZZLE_IMAGES = [
  puzzleSubmarine,
  puzzleChipmunk,
  puzzleCherryShrimp,
  puzzleBattleship,
  puzzleRedSquirrel,
  puzzleBettaFish,
  puzzleB2Spirit,
  puzzleCrab,
];
