# Learn and play

A collection of small reading, counting, and maths games for children.

## Games

- [Snakes and ladders](./games/snakes-and-ladders/) - practise Norwegian words while playing snakes and ladders.
- [Card battle](./games/card-battle/) (library title "Kortkrig", hidden) - a card battle against Rex the dinosaur: flip cards, compare numbers, and pick up addition and subtraction along the way. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/card-battle/](./games/card-battle/).
- [Sound labyrinth](./games/sound-labyrinth/) (library title "Lyd-labyrinten") - explore a big maze, tap the animals to hear their words, and spell the words correctly to open the doors and find the way out. Every solved maze earns a puzzle piece: collect all four to assemble the picture and finish the game. Assembled pictures are remembered, so the next run collects a picture the child has not seen until every picture has had its turn - and "Start på nytt" keeps that record, so a reset never brings back a picture that is already done. Collected pieces, opened doors and the runner's exact position all survive a page reload, so a break never loses the way out. The board sizes itself to the screen, so the direction pad never covers the maze on tablets and desktop screens.
- [Shop](./games/shop/) (library title "Butikken") - trade at the split counter: pick up to three goods, work out the total and type your answer, or buy a single item and subtract its price from your purse to see what is left. A wrong guess brings the policeman (who never spoils the answer), and three wrong tries send you back to the shop with the deal off.
- [Word fishing](./games/word-fishing/) (library title "Ordfiske") - a whole fishing trip on the water: hook a fish and keep reeling - it fights, the line slips fast when you stop, and it can wriggle free, which only means it swims on and can be hooked again. Read the word it carries and put it in the crate its meaning belongs to - animals, food, nature or home. Reading is the whole task: every word is five letters at most, and nothing in the game is ever read aloud - the caught word is plain text, not a button. Every word caught is written into the fishing book and never swims again, and a fresh fish slips into the water the moment a catch lands, so the sea is never empty. Every trip carries all four crates and ends after four sorted catches, decorating a bigger, livelier seabed a little more. Catching ten words in each crate - every crate draws from a bigger pool of twenty, so a new run meets other words - fills the book and finishes the game with confetti, a congratulations screen and a "Start på nytt" button. A fish that belongs in another crate simply swims on, no card interrupts the fishing, and no progress is lost - the book, the trip, the stamps and the reef all survive a page reload.
- [Number-line hop](./games/number-line-hop/) (library title "Tierhopp", hidden) - help the frog hop along a 0–100 number line: look at the sum, point to where you think the answer lives, and land together. Addition and subtraction practice with no wrong answers, no timers, and no score. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/number-line-hop/](./games/number-line-hop/).

Everything in the codebase is named in English, while every word a child reads
or hears stays Norwegian. The naming rules and the code-name-to-library-title
mapping live in [`AGENTS.md`](./AGENTS.md#naming).

## Local development

```sh
npm install
npm run dev
```

Open the home page at the address displayed by Vite. Each game has its own HTML entry point and folder under `games/`, so a new game can be added as `games/a-new-game/index.html` and `src/games/a-new-game/` – the build picks it up automatically.

Shared helpers live in `src/shared/` (audio engine, random helpers, speech, confetti, game header) and are reused by all games – prefer them over copying utilities into a game folder.

## Tests

Every game is covered by Vitest tests (game logic plus rendered behaviour):

```sh
npm run test        # run all tests once
npm run test:watch  # watch mode while developing
npm run lint        # eslint over the whole project
```

Tests live next to the code they cover (for example `src/games/sound-labyrinth/mazes.test.js`) and are not included in the production build.

## Coding agent pipeline

Issues labelled `ai-ready` — or any issue comment starting with `/oc` — start a
coding agent that implements the change on a branch and opens a pull request. A
second, read-only agent reviews every pull request and posts QA and security
findings as a comment. Nothing merges without passing CI and a human review, and
merging `main` deploys the site exactly as before.

The agent runs on DeepSeek V4.1 Flash (`deepseek/deepseek-flash`) through
DeepSeek's own API at maximum reasoning effort. Its configuration lives in
`opencode.json` and `.opencode/agents/`. The wiring, the one-time repository
setup, and the guardrails are described in
[`docs/agent-pipeline.md`](./docs/agent-pipeline.md).

## Hosting

```sh
npm run build
```

The build writes every published page into `dist/`:

- `/` - game library
- `/games/sound-labyrinth/` - Sound labyrinth ("Lyd-labyrinten")
- `/games/snakes-and-ladders/` - Snakes and ladders ("Slanger og stiger")
- `/games/card-battle/` - Card battle ("Kortkrig")
- `/games/shop/` - Shop ("Butikken")
- `/games/word-fishing/` - Word fishing ("Ordfiske")
- `/games/number-line-hop/` - Number-line hop ("Tierhopp")

`.github/workflows/deploy-cloudflare.yml` runs lint, the whole test suite and the build on every push to `main`; the verified build is then handed to Cloudflare Workers static assets - but only after a human approves it. The deploy job sits behind the `cloudflare-production` environment's required reviewer, so you approve each production deploy in the workflow run. `wrangler.jsonc` holds the Worker configuration; the custom domain is attached once in the Cloudflare dashboard.

The library lives at <https://play2learn.divanchyshyn.com/>, and each game sits at `/games/<slug>/` - for example <https://play2learn.divanchyshyn.com/games/sound-labyrinth/>.

GitHub Pages keeps publishing the same build through `.github/workflows/deploy-pages.yml` automatically, with no approval step, so the old `https://<user>.github.io/learn-and-play/` URLs keep working. Retire that workflow in its own change once the new domain has been verified. Progress saved in `localStorage` belongs to the origin it was saved on, so the new domain starts with fresh saves.
