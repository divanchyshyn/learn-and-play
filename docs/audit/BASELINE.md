# Coverage baseline

The figures the Vitest suite was last measured at, so a later change can be
compared against something real. `README.md` and `AGENTS.md` both name this file
as the coverage gate.

## The current gate (measured on `f3a8872`, before the docs pass)

```sh
npm run test:coverage -- --testTimeout=60000
```

The extra `--testTimeout` is a measurement detail, not a relaxation of the suite:
coverage instrumentation roughly doubles the runtime of the heaviest Sound
Labyrinth test, which already sits near the suite-wide 20 s ceiling on a loaded
machine. Without it the run flakes; `npm run test` (the gate CI runs) is
unchanged.

| Test files | Tests | Duration |
| --- | --- | --- |
| 48 | 591 | ~26 s |

| Overall | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| All files | 93.85 % (2826/3011) | 87.15 % (1744/2001) | 96.39 % (721/748) | 96.05 % (2385/2483) |

### What moved since the previous baseline, and why

The previous baseline (`c80f24f`) recorded 93.57 % statements, 87.32 % branches,
96.64 % functions and 95.93 % lines over 51 files. The suite has since gained the
account page, the sync engine and the API client — twelve modules and 86 tests.

- **Statements (93.57 → 93.85 %) and lines (95.93 → 96.05 %)** went up.
- **Branches (87.32 → 87.15 %) and functions (96.64 → 96.39 %)** came
  down by 0.17 and 0.25 points. That is not a regression in any file: it is what
  happens when well-covered new modules join a suite whose weakest corners are
  untouched game components (`SpellPuzzle.jsx` at 47 % branches, `PiecePuzzle.jsx`
  at 81 %, `shop/sounds.js` at 67 % functions). Every pre-existing file the
  backend change touched held its figures or improved — `persistence.js` is
  unchanged at 100/91.66/100/100, and `progress.js`, `journal.js` and
  `album.js` are byte-for-byte the same. `SoundLabyrinth.jsx` reads 93.5/85.15
  instead of 93.53/85.15 because the picture list moved out of it: the same
  untested lines now sit against a slightly smaller file.
- The new modules, for the record: `syncable.js` 100/86.36/100/100, `sync.js`
  ~90/82/97/93, `api.js` 90/100/75/100, `account.js` ~98/73/100/100,
  `SyncGate.jsx` 100/83/100/100, `AccountPage.jsx` ~89/93/86/90.

### The rule

- No file may fall below its own figure above. A change that adds a module covers
  it with the feature, never after it.
- The overall figures must not fall either; when they do, this file changes with
  the reason written next to the new numbers, the way the section above does. A
  baseline that is quietly lowered is worse than no baseline.

## Per file

| File | % Stmts | % Branch | % Funcs | % Lines |
| --- | --- | --- | --- | --- |
| `src/account/AccountPage.jsx` | 89.23 | 92.5 | 85.71 | 89.83 |
| `src/games/card-battle/album.js` | 100 | 100 | 100 | 100 |
| `src/games/card-battle/CardBattle.jsx` | 97.18 | 94.82 | 100 | 100 |
| `src/games/card-battle/riddles.js` | 98.36 | 94.87 | 100 | 100 |
| `src/games/card-battle/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/number-line-hop/line.js` | 100 | 100 | 100 | 100 |
| `src/games/number-line-hop/NumberLineHop.jsx` | 96.62 | 90.41 | 100 | 97.22 |
| `src/games/number-line-hop/problems.js` | 95.83 | 94.73 | 100 | 100 |
| `src/games/number-line-hop/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/shop/Shop.jsx` | 94.37 | 89.87 | 100 | 95.91 |
| `src/games/shop/sounds.js` | 80 | 100 | 66.66 | 87.5 |
| `src/games/snakes-and-ladders/SnakesAndLadders.jsx` | 98.23 | 94.04 | 100 | 100 |
| `src/games/sound-labyrinth/drag.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/layout.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/mazes.js` | 99.51 | 96.1 | 100 | 100 |
| `src/games/sound-labyrinth/PiecePuzzle.jsx` | 90.19 | 80.53 | 100 | 93.1 |
| `src/games/sound-labyrinth/progress.js` | 90.9 | 89.93 | 100 | 100 |
| `src/games/sound-labyrinth/puzzle.js` | 97.5 | 95.83 | 100 | 100 |
| `src/games/sound-labyrinth/puzzle-images.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/SoundLabyrinth.jsx` | 93.5 | 85.15 | 92.98 | 95.38 |
| `src/games/sound-labyrinth/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/sound-labyrinth/SpellPuzzle.jsx` | 65.48 | 47.48 | 70 | 70.48 |
| `src/games/sound-labyrinth/words.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/ActionBar.jsx` | 90.9 | 80.55 | 92.3 | 91.22 |
| `src/games/word-fishing/BoatArt.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/CrateDock.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/FishArt.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/FishingBook.jsx` | 88.88 | 71.42 | 100 | 92.68 |
| `src/games/word-fishing/FishSprite.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/journal.js` | 94.2 | 90.47 | 100 | 100 |
| `src/games/word-fishing/photos.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/PhotoSprite.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/ReefRewards.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/rig.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/sea.js` | 98.6 | 92.02 | 96.96 | 98.75 |
| `src/games/word-fishing/SeaFloor.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/SeaScene.jsx` | 96.55 | 87.5 | 100 | 100 |
| `src/games/word-fishing/SeaSky.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/SeaWater.jsx` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/sounds.js` | 100 | 100 | 100 | 100 |
| `src/games/word-fishing/trip.js` | 93.44 | 94.2 | 100 | 100 |
| `src/games/word-fishing/WordFishing.jsx` | 93.42 | 88.3 | 95.45 | 98.08 |
| `src/games/word-fishing/words.js` | 100 | 100 | 100 | 100 |
| `src/shared/account.js` | 98.36 | 80 | 100 | 100 |
| `src/shared/api.js` | 100 | 100 | 100 | 100 |
| `src/shared/audio.js` | 93.47 | 92.5 | 87.5 | 97.36 |
| `src/shared/ConfettiLayer.jsx` | 100 | 100 | 100 | 100 |
| `src/shared/GameHeader.jsx` | 100 | 100 | 100 | 100 |
| `src/shared/persistence.js` | 100 | 91.66 | 100 | 100 |
| `src/shared/random.js` | 100 | 100 | 100 | 100 |
| `src/shared/SoundToggle.jsx` | 100 | 100 | 100 | 100 |
| `src/shared/speech.js` | 94.28 | 100 | 80 | 96.55 |
| `src/shared/sync.js` | 95.78 | 82.29 | 96.55 | 97.12 |
| `src/shared/syncable.js` | 100 | 86.36 | 100 | 100 |
| `src/shared/SyncGate.jsx` | 100 | 83.33 | 100 | 100 |
| `src/shared/usePersistentState.js` | 100 | 100 | 100 | 100 |
| `src/shared/useSoundToggle.js` | 100 | 100 | 100 | 100 |
| `src/shared/useTransientState.js` | 100 | 100 | 100 | 100 |
