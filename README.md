# Learn and play

A collection of small reading, counting, and maths games for children.

## Games

- [Snakes and ladders](./games/slangen-en-ladders/) - practise Norwegian words while playing snakes and ladders.
- Kortkrig (hidden) - a card battle against Rex the dinosaur: flip cards, compare numbers, and pick up addition and subtraction along the way. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/kortkrig/](./games/kortkrig/).
- [Sound labyrinth](./games/lyd-labyrint/) - explore a big maze, tap the animals to hear their words, and spell the words correctly to open the doors and find the way out. Every solved maze earns a puzzle piece: collect all four to assemble the picture and finish the game. Collected pieces, opened doors and the runner's exact position all survive a page reload, so a break never loses the way out. The board sizes itself to the screen, so the direction pad never covers the maze on tablets and desktop screens.
- [Butikken](./games/butikken/) - trade at the split counter: pick up to three goods, work out the total and type your answer, or buy a single item and subtract its price from your purse to see what is left. A wrong guess brings the policeman (who never spoils the answer), and three wrong tries send you back to the shop with the deal off.
- Ordfiske (hidden) - go fishing for words: tap a fish to bring it up from the pond, hear the word out loud if you like, and fill the bucket at your own pace. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/ordfiske/](./games/ordfiske/).
- Tierhopp (hidden) - help the frog hop along a 0–100 number line: look at the sum, point to where you think the answer lives, and land together. Addition and subtraction practice with no wrong answers, no timers, and no score. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/tierhopp/](./games/tierhopp/).

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

Tests live next to the code they cover (for example `src/games/lyd-labyrint/mazes.test.js`) and are not included in the production build.

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
- `/games/lyd-labyrint/` - Sound labyrinth
- `/games/slangen-en-ladders/` - Snakes and ladders
- `/games/kortkrig/` - Kortkrig (the card battle)
- `/games/butikken/` - Butikken (the shop)
- `/games/ordfiske/` - Ordfiske (the word-fishing pond)
- `/games/tierhopp/` - Tierhopp (the number-line jumper)

`.github/workflows/deploy-cloudflare.yml` runs lint, the whole test suite and the build on every push to `main`; the verified build is then handed to Cloudflare Workers static assets - but only after a human approves it. The deploy job sits behind the `cloudflare-production` environment's required reviewer, so you approve each production deploy in the workflow run. `wrangler.jsonc` holds the Worker configuration; the custom domain is attached once in the Cloudflare dashboard.

The library lives at <https://play2learn.divanchyshyn.com/>, and each game sits at `/games/<slug>/` - for example <https://play2learn.divanchyshyn.com/games/lyd-labyrint/>.

GitHub Pages keeps publishing the same build through `.github/workflows/deploy-pages.yml` automatically, with no approval step, so the old `https://<user>.github.io/learn-and-play/` URLs keep working. Retire that workflow in its own change once the new domain has been verified. Progress saved in `localStorage` belongs to the origin it was saved on, so the new domain starts with fresh saves.
