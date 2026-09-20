# Learn and Play Agent Guide

## Project goal

Build a small, friendly collection of browser games for children. Games should be easy to understand, work without accounts or a backend, and support learning through play. The current games practise Norwegian words, but future games may cover reading, counting, maths, or similar skills.

## Naming

- Every name in the codebase is English: game folders and URL slugs, component
  and file names, exported helpers, data keys (item ids, categories, themes,
  mode ids), CSS class names, storage keys, comments, test names, and docs.
- Only what a child sees or hears stays Norwegian: game titles, badges, intro
  and help text, button and aria labels, the Norwegian word and number banks,
  and each page's `<title>`. `speakNorwegian`, `pickNorwegianVoice` and
  `numberToNorwegian` are English identifiers for the *language* a game teaches,
  so they keep their names.
- The library title (what the child sees) and the code name (what the code uses)
  map onto each other as follows:

  | Code: folder, route, component | Library title |
  | --- | --- |
  | `shop`, `Shop` | Butikken |
  | `card-battle`, `CardBattle` | Kortkrig |
  | `sound-labyrinth`, `SoundLabyrinth` | Lyd-labyrinten |
  | `word-fishing`, `WordFishing` | Ordfiske |
  | `snakes-and-ladders`, `SnakesAndLadders` | Slanger og stiger |
  | `number-line-hop`, `NumberLineHop` | Tierhopp |

- Storage keys are English as well (`soundLabyrinth:game`, `cardBattle:tally`,
  …). If a key ever has to change again, move the saved value once with
  `migrateStorage` from `src/shared/persistence.js`, so no child loses progress.
- The Norwegian slugs that were published before this rule existed were renamed
  to the English ones above in one deliberate, human-approved change, and the
  old URLs were retired together with it. From now on, a published slug is never
  renamed without keeping the old URL working.

## Stack and deployment

- React with Vite, using JavaScript and CSS.
- This is a multi-page application, not a single-page router.
- Cloudflare Workers serves the generated `dist/` directory as static assets, deployed by `.github/workflows/deploy-cloudflare.yml` behind the `cloudflare-production` environment's required reviewers (Worker configuration in `wrangler.jsonc`).
- Keep the app fully static: no server-side rendering, no API dependencies, no runtime secrets. Adding an `/api/*` route, a datastore binding, or anything the browser needs at runtime is an amendment to this rule, agreed deliberately, never an implementation detail.
- Use relative asset paths or Vite imports so the site works at `https://play2learn.divanchyshyn.com/` and, while the GitHub Pages workflow remains, at `https://<user>.github.io/<repository>/`.

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
src/games/<game-slug>/puzzle-assets/    Committed game artwork imported by the component (Sound Labyrinth's puzzle pictures)
src/styles/base.css                     Shared reset and base styles
src/test/setup.js                       Vitest setup (jest-dom matchers)
vite.config.js                          Multi-page build entry points and test config
eslint.config.js                        ESLint flat config (core, react, react-hooks rules)
.github/workflows/ci.yml                Runs lint, tests and the build on pushes and pull requests
.github/workflows/deploy-cloudflare.yml Cloudflare Workers deploy: verify, then a deploy job behind the cloudflare-production environment's required reviewers
.github/workflows/deploy-pages.yml      GitHub Pages build and deployment, kept until the custom domain is verified
wrangler.jsonc                          Cloudflare Workers config: serves dist/ as static assets
.github/workflows/codeql.yml            CodeQL security analysis on pull requests and weekly
.github/workflows/opencode.yml          Runs the coding agent when an issue is labelled ai-ready
.github/workflows/opencode-review.yml   Reviews pull requests and posts findings as a comment
.github/dependabot.yml                  Weekly dependency and GitHub Actions updates
.github/ISSUE_TEMPLATE/                 Issue forms that double as the coding agent's brief
opencode.json                           Coding agent config: model, permissions, provider
.opencode/agents/review.md              Read-only reviewer agent used by the review workflow
docs/agent-pipeline.md                  How the agent pipeline is wired up and how to run it
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

The trailing slash in a game URL is intentional: it lets the static host load that game's `index.html` directly (Cloudflare Workers redirects `/games/<slug>` to `/games/<slug>/` and serves `index.html` there, exactly as GitHub Pages does).

Reuse `src/shared/` instead of copying utilities into a game folder: `shuffle`/`pickOne`, the audio engine (`tone`, mute state), `speakNorwegian`, `ConfettiLayer`, and `GameHeader`. Sound *definitions* stay per game in its local `sounds.js`, built on the shared engine.

## Game artwork

- Artwork that a game ships is committed inside that game's own folder, next to
  the code that imports it: `src/games/<game-slug>/puzzle-assets/*.webp` holds
  Sound Labyrinth's puzzle pictures. A Vite import such as
  `import picture from './puzzle-assets/chipmunk.webp'` fails the build when the
  file is missing, so a missing picture can never ship - when a game route
  suddenly stops building, check `git status` for deleted asset files first.
- Asset filenames are English kebab-case and describe the subject
  (`submarine-yard.webp`, `red-squirrel.webp`), even inside a Norwegian game: the
  Naming rules cover filenames too. Unlike game slugs, asset filenames are not
  routes, so they may be renamed, replaced or added freely as long as every
  import and test moves with them.
- Every picture belonging to the same feature keeps the same shipped contract, so
  the pictures stay interchangeable. Sound Labyrinth's puzzle pictures are
  **1024 x 1024 px, WebP lossy VP8 (the `VP8 ` chunk, not `VP8L`/`VP8X`), RGB with
  no alpha, 45-205 KB each**. Keep a new picture inside that range; the busier the
  photo, the lower the quality it needs (the battleship wanted q74 where the
  others were happy at q82).
- A picture is sliced into its four quadrants in CSS (`--puzzle-image`,
  `background-size: 200% 200%`), so the source must be square and the subject must
  not fall across the middle lines. Always convert a square crop of the original,
  never a stretched one, and check the framing on a small preview before
  installing it.
- Convert and check artwork outside the repository. Pillow is *not* a project
  dependency and must not be added to `package.json`; install it in a throwaway
  environment in a temp folder outside the repo, and copy only the finished
  `.webp` files in. This is the recipe the current pictures were made with:

  ```python
  side = min(image.size)                    # centre square crop, never a stretch
  left, top = (image.width - side) // 2, (image.height - side) // 2
  square = image.convert("RGBA").crop((left, top, left + side, top + side))
  flat = Image.new("RGB", square.size, (255, 255, 255))  # flatten alpha on white
  flat.paste(square, mask=square.getchannel("A"))
  flat.resize((1024, 1024), Image.LANCZOS).save(
      target, "WEBP", quality=82, method=6, lossless=False)
  ```

  Then re-open the result and print `size`, `format`, `mode` and the four bytes
  after `RIFF....WEBP` (the expected chunk is `VP8 `). A file that comes back as
  `VP8X` or `RGBA` is off contract, and one above ~205 KB is worth saving again at
  a lower quality.
- Adding, replacing or removing a picture is a four-step change:
  1. copy the converted `.webp` into the game's asset folder with `Copy-Item` (or
     `cmd /c copy`). Never move binary files through PowerShell redirection
     (`>`, `|`): it re-encodes the bytes and corrupts the image;
  2. import it in the game component and add it to the picture rotation
     (`PUZZLE_IMAGES` in `SoundLabyrinth.jsx` - one picture per full run, in a
     mixed order so consecutive runs look different);
  3. extend the rotation assertion in the game's test (`SoundLabyrinth.test.jsx`
     checks the rotation is complete and repeat-free);
  4. run `npm.cmd run lint`, `npm.cmd run test` and `npm.cmd run build`, then
     confirm every picture is emitted to `dist/assets/*.webp`.
- Pictures are not stored in saved progress: a piece session keeps only
  `imageIndex`, and the codec accepts any index `>= 0`. A bigger rotation therefore
  keeps every saved game working with no `migrateStorage` step (a smaller one would
  quietly show the first picture for the highest stored indices).
- Pick subjects a child recognises and keep new artwork in that friendly, everyday
  spirit; see Design direction before adding anything that leans on the former
  military theme.

## Testing

- Vitest with jsdom and React Testing Library. Configuration lives in the `test` block of `vite.config.js`; shared matchers are loaded by `src/test/setup.js`.
- Test files sit next to the code they cover as `*.test.js` / `*.test.jsx`. They are never imported by an entry point, so they stay out of the production build in `dist/`.
- Cover each game's rules as pure-logic tests (board or maze integrity, word banks, option generators, dice and turn flow) plus at least one rendered happy path through the UI.
- Export existing pure helpers from game components instead of duplicating their logic in tests (see the Shop's `expectedAnswer` or Snakes and ladders' `makeWords`).
- Keep tests deterministic: pin `Math.random` with `vi.spyOn`, use fake timers for movement/animation locks, and derive expectations from whatever random content a component actually rendered instead of assuming specific items or words.
- Respect each game's design constraints inside its tests – for example, Sound Labyrinth keeps no failure states: letters stay freely placeable and reorderable, and a wrong spelling may only shake red and be read back, never punished.

## CI

`.github/workflows/ci.yml` runs lint and the whole test suite on every push and pull request. `.github/workflows/deploy-cloudflare.yml` runs the same checks on `main` and then waits, behind the `cloudflare-production` environment's required reviewers, for a human to approve the deploy. `.github/workflows/deploy-pages.yml` publishes the same build automatically. Failing checks can therefore never reach either host, and nothing reaches the live site without approval. Keep all three green before handing off changes.

## Linting

- `npm.cmd run lint` runs ESLint (flat config in `eslint.config.js`): core recommended rules, React rules, and the classic React Hooks rules (`rules-of-hooks`, `exhaustive-deps`).
- The compiler-grade extras from react-hooks v7 (`purity`, `refs`, `set-state-in-render`, …) are intentionally not enabled: games randomise at mount time on purpose (confetti bursts, dealt word boards, picked mazes). Revisit only if a game's design moves that logic into effects or event handlers.
- Fix findings at the source instead of adding suppressions. If a suppression is truly warranted, scope it to the line with a comment explaining why.
- Browser globals are enabled for `src/`; Node globals for `vite.config.js` and `eslint.config.js`. Tests may use Vitest's injected globals, though explicit imports remain the convention.

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
- Hide an unfinished game by commenting out its tile in `src/home/main.jsx` and marking it "(hidden)" in `README.md`. Keep its entry point in the build so the direct URL keeps working (see Card battle, Word fishing and Number-line hop).
- Build (`npm.cmd run build`), lint (`npm.cmd run lint`), and test (`npm.cmd run test`) before handing off changes. For interactive changes, also verify the relevant game route locally.

## Definition of done

A change, whether written by a person or by the coding agent, is finished only when:

- `npm run lint`, `npm run test` and `npm run build` all pass (use `npm.cmd` in PowerShell on this machine).
- New pure logic is exported from the component or module and covered by a unit test; new UI has at least one rendered happy path.
- New or replaced artwork follows the contract under Game artwork (same dimensions, format, colour mode and rough byte size as the pictures it joins), is imported by the component, is covered by the rotation test, and is present in `dist/assets/`.
- `README.md` is updated when user-visible behaviour, the game list, or a published route changes.
- A new game also gets its `games/<slug>/index.html`, its `src/games/<slug>/` folder, a tile in `src/home/main.jsx`, and a README entry.
- The production build still contains every published route (`dist/games/<slug>/index.html`).
- No published game slug is renamed or removed (the one-off English rename recorded under Naming is the deliberate exception).
- New code follows the Naming rules: English identifiers everywhere, Norwegian only in what the child sees or hears.
- No new runtime dependency is added without a human decision.

## Agent pipeline

- The coding agent runs headless in GitHub Actions. It reads this file as its instructions and `opencode.json` for its model and permissions.
- Label an issue `ai-ready`, or comment `/oc` on it, to start the agent. It works on a branch and opens a pull request. It never pushes to `main` and never merges.
- A second, read-only agent named `review` comments on pull requests with QA and security findings. It cannot edit files.
- The `build` agent's shell access is deliberately narrow: `npm ci`, `npm run lint`, `npm run test*`, `npm run build` and read-only git. `npm install <pkg>`, network tools (`curl`, `wget`), `webfetch` and paths outside the repository are denied. If a task needs one of these, stop and explain instead of working around it.
- Keep every pull request scoped to a single issue. Branch protection on `main` requires the CI checks and a human review before anything merges.

## Useful commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
npm.cmd run lint
npm.cmd run test
npm.cmd run test:watch
```

Use `npm.cmd` in PowerShell on this machine because its execution policy may block `npm.ps1`.
