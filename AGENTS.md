# Learn and Play Agent Guide

## Project goal

Build a small, friendly collection of browser games for children. Games should be easy to understand, work without accounts or a backend, and support learning through play. The current game uses Norwegian words, but future games may cover reading, counting, maths, or similar skills.

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
games/<game-slug>/index.html            Deployable entry point for one game
src/games/<game-slug>/main.jsx          React entry point for one game
src/games/<game-slug>/<Game>.jsx        Game component and game logic
src/games/<game-slug>/style.css         Game-specific styles
src/styles/base.css                     Shared reset and base styles
vite.config.js                          Multi-page build entry points
.github/workflows/deploy-pages.yml      GitHub Pages build and deployment
```

## Adding a game

For a new game with the slug `word-match`:

1. Create `games/word-match/index.html`. Copy the HTML entry point from the existing game and point its module script to `/src/games/word-match/main.jsx`.
2. Create `src/games/word-match/` with `main.jsx`, the main React component, and `style.css`.
3. Add `wordMatch: resolve(import.meta.dirname, 'games/word-match/index.html')` to `build.rollupOptions.input` in `vite.config.js`.
4. Add a game tile linking to `./games/word-match/` in `src/home/main.jsx`.
5. Update `README.md` with the new game link and short description.
6. Run `npm.cmd run build` on Windows. Confirm the build includes `dist/games/word-match/index.html`.

The trailing slash in a game URL is intentional: it lets GitHub Pages load that game's `index.html` directly.

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
- Build before handing off changes. For interactive changes, also verify the relevant game route locally.

## Useful commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

Use `npm.cmd` in PowerShell on this machine because its execution policy may block `npm.ps1`.
