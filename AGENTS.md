# Learn and Play Agent Guide

## Project goal

Build a small, friendly collection of browser games for children. Games should be easy to understand, work without accounts or a backend, and support learning through play. The current games practise Norwegian words, but future games may cover reading, counting, maths, or similar skills.

## Stack and deployment

- React with Vite, using JavaScript and CSS.
- This is a multi-page application, not a single-page router.
- GitHub Pages deploys the generated `dist/` directory through `.github/workflows/deploy-pages.yml`.
- Keep the app fully static: do not add server-side rendering, API dependencies, or runtime secrets.
- Use relative asset paths or Vite imports so the site works at `https://<user>.github.io/<repository>/`.

## Structure

```text
index.html                              Game library entry point
src/home/                               Library React view and styles
src/shared/                             Shared helpers used by several games (audio engine, random helpers, speech, ConfettiLayer, GameHeader) with their own tests
games/<game-slug>/index.html            Deployable entry point for one game
src/games/<game-slug>/main.jsx          React entry point for one game
src/games/<game-slug>/<Game>.jsx        Game component and game logic
src/games/<game-slug>/*.test.js(x)      Tests for one game (logic + rendered behaviour)
src/games/<game-slug>/style.css         Game-specific styles
src/styles/base.css                     Shared reset and base styles
src/test/setup.js                       Vitest setup (jest-dom matchers)
vite.config.js                          Multi-page build entry points and test config
.github/workflows/ci.yml                Runs the test suite on pushes and pull requests
.github/workflows/deploy-pages.yml      GitHub Pages build and deployment (tests gate the deploy)
```

## Adding a game

For a new game with the slug `word-match`:

1. Create `games/word-match/index.html`. Copy the HTML entry point from an existing game and point its module script to `/src/games/word-match/main.jsx`.
2. Create `src/games/word-match/` with `main.jsx`, the main React component, and `style.css`.
3. Nothing to register: the build discovers every `games/<slug>/index.html` automatically (see `discoverGameEntries` in `vite.config.js`).
4. Add tests in `src/games/word-match/*.test.js(x)` (see Testing below).
5. Add a game tile linking to `./games/word-match/` in `src/home/main.jsx`.
6. Update `README.md` with the new game link and short description.
7. Run `npm.cmd run build` and `npm.cmd run test` on Windows. Confirm the build includes `dist/games/word-match/index.html` and all tests pass.

The trailing slash in a game URL is intentional: it lets GitHub Pages load that game's `index.html` directly.

Reuse `src/shared/` instead of copying utilities into a game folder: `shuffle`/`pickOne`, the audio engine (`tone`, mute state), `speakNorwegian`, `ConfettiLayer`, and `GameHeader`. Sound *definitions* stay per game in its local `sounds.js`, built on the shared engine.

## Testing

- Vitest with jsdom and React Testing Library. Configuration lives in the `test` block of `vite.config.js`; shared matchers are loaded by `src/test/setup.js`.
- Test files sit next to the code they cover as `*.test.js` / `*.test.jsx`. They are never imported by an entry point, so they stay out of the production build in `dist/`.
- Cover each game's rules as pure-logic tests (board or maze integrity, word banks, option generators, dice and turn flow) plus at least one rendered happy path through the UI.
- Export existing pure helpers from game components instead of duplicating their logic in tests (see Butikken's `makeOptions` or Slangen og stigers `makeWords`).
- Keep tests deterministic: pin `Math.random` with `vi.spyOn`, use fake timers for movement/animation locks, and derive expectations from whatever random content a component actually rendered instead of assuming specific items or words.
- Respect each game's design constraints inside its tests – for example, Lyd-labyrinten must have no failure states and a wrong door may only ever cost one bounce-back.

## CI

`.github/workflows/ci.yml` runs the whole test suite on every push and pull request. `.github/workflows/deploy-pages.yml` runs the same suite before building, so failing tests can never reach GitHub Pages. Keep both green before handing off changes.

## Design direction

- Keep the game library clear and simple. It should help a child or adult choose a game quickly.
- Make each game feel like a real play surface, not a marketing page.
- Prefer warm, playful colours with good contrast. The existing blue, ochre, coral, and off-white palette is the reference direction.
- Use responsive layouts and test narrow screens. Text must remain readable and controls must remain easy to tap.
- Avoid returning to the former military theme unless a future game explicitly calls for it.

## Implementation expectations

- Keep a game's state and logic inside its own `src/games/<game-slug>/` folder.
- Reuse `src/styles/base.css` only for genuinely shared browser-wide styles; do not put game-specific styling there.
- Prefer simple React state and small components over adding a state-management library.
- Preserve existing games while adding new ones. Do not rename a game slug without also preserving or intentionally redirecting its published URL.
- Hide an unfinished game by commenting out its tile in `src/home/main.jsx` and marking it "(hidden)" in `README.md`. Keep its entry point in the build so the direct URL keeps working (see Butikken and Lyd-labyrinten).
- Build (`npm.cmd run build`) and test (`npm.cmd run test`) before handing off changes. For interactive changes, also verify the relevant game route locally.

## Useful commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
npm.cmd run test
npm.cmd run test:watch
```

Use `npm.cmd` in PowerShell on this machine because its execution policy may block `npm.ps1`.
