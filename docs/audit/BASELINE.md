# Coverage baseline

The figures the Vitest suite was last measured at, so a later change can be
compared against something real. `README.md` and `AGENTS.md` both name this file
as the coverage gate; before this document existed it was referenced but absent
from the repository.

Measured on `c80f24f` (before any backend code existed) with:

```sh
npm run test:coverage
```

Vite's config scopes the report to `src/**/*.{js,jsx}` and excludes test files,
`src/test/**` and every page entry point (`src/**/main.jsx`, one `createRoot` call
each). A module nobody imports therefore appears at 0 % instead of being absent
from the report.

| Test files | Tests | Duration |
| --- | --- | --- |
| 41 | 505 | 17.5 s |

| Overall | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| All files | 93.57 % (2475/2645) | 87.32 % (1564/1791) | 96.64 % (633/655) | 95.93 % (2078/2166) |

## Per file

| File | % Stmts | % Branch | % Funcs | % Lines |
| --- | --- | --- | --- | --- |
| `src/games/card-battle/CardBattle.jsx` | 97.18 | 94.82 | 100 | 100 |
| `src/games/card-battle/album.js` | 100 | 100 | 100 | 100 |
| `src/games/card-battle/riddles.js` | 98.36 | 94.87 | 100 | 100 |
| `src/games/card-battle/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/number-line-hop/NumberLineHop.jsx` | 96.62 | 90.41 | 100 | 97.22 |
| `src/games/number-line-hop/line.js` | 100 | 100 | 100 | 100 |
| `src/games/number-line-hop/problems.js` | 95.83 | 94.73 | 100 | 100 |
| `src/games/number-line-hop/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/shop/Shop.jsx` | 94.37 | 89.87 | 100 | 95.91 |
| `src/games/shop/sounds.js` | 80 | 100 | 66.66 | 87.5 |
| `src/games/snakes-and-ladders/SnakesAndLadders.jsx` | 98.23 | 94.04 | 100 | 100 |
| `src/games/sound-labyrinth/PiecePuzzle.jsx` | 90.19 | 80.53 | 100 | 93.1 |
| `src/games/sound-labyrinth/SoundLabyrinth.jsx` | 93.53 | 85.15 | 92.98 | 95.4 |
| `src/games/sound-labyrinth/SpellPuzzle.jsx` | 65.48 | 47.48 | 70 | 70.48 |
| `src/games/sound-labyrinth/drag.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/layout.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/mazes.js` | 99.51 | 96.1 | 100 | 100 |
| `src/games/sound-labyrinth/progress.js` | 90.9 | 89.93 | 100 | 100 |
| `src/games/sound-labyrinth/puzzle.js` | 97.5 | 95.83 | 100 | 100 |
| `src/games/sound-labyrinth/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/words.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/ActionBar.jsx` | 90.9 | 80.55 | 92.3 | 91.22 |
| `src/games/word-fishing/BoatArt.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/CrateDock.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/FishArt.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/FishSprite.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/FishingBook.jsx` | 88.88 | 71.42 | 100 | 92.68 |
| `src/games/word-fishing/PhotoSprite.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/ReefRewards.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/SeaFloor.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/SeaScene.jsx` | 96.55 | 87.5 | 100 | 100 |
| `src/games/word-fishing/SeaSky.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/SeaWater.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/WordFishing.jsx` | 93.42 | 88.3 | 95.45 | 98.08 |
| `src/games/word-fishing/journal.js` | 94.2 | 90.47 | 100 | 100 |
| `src/games/word-fishing/photos.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/rig.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/sea.js` | 98.6 | 92.02 | 96.96 | 98.75 |
| `src/games/word-fishing/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/trip.js` | 93.44 | 94.2 | 100 | 100 |
| `src/games/word-fishing/words.js` | 100 | 100 | 100 | 100 |
| `src/shared/ConfettiLayer.jsx` | 100 | 100 | 100 | 100 |
| `src/shared/GameHeader.jsx` | 100 | 100 | 100 | 100 |
| `src/shared/SoundToggle.jsx` | 100 | 100 | 100 | 100 |
| `src/shared/audio.js` | 93.47 | 92.5 | 87.5 | 97.36 |
| `src/shared/persistence.js` | 100 | 91.66 | 100 | 100 |
| `src/shared/random.js` | 100 | 100 | 100 | 100 |
| `src/shared/speech.js` | 94.28 | 100 | 80 | 96.55 |
| `src/shared/usePersistentState.js` | 100 | 100 | 100 | 100 |
| `src/shared/useSoundToggle.js` | 100 | 100 | 100 | 100 |
| `src/shared/useTransientState.js` | 100 | 100 | 100 | 100 |

## The gate

- Overall figures must never fall below the **All files** row above.
- For any file a change touches, the per-file row above must not fall either.
- The two files furthest from complete are the honest ones to watch when their
  area changes: `src/games/sound-labyrinth/SpellPuzzle.jsx` (65 % statements,
  47 % branches) and `src/games/shop/sounds.js` (80 % statements, 67 %
  functions). Neither is a reason to lower the gate.
- New shared modules are inside the report the moment they exist
  (`src/shared/*` today; `src/account/*` once the account page lands), so they are
  covered with the feature, never after it.
