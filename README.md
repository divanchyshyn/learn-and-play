# Learn and play

A collection of small reading, counting, and maths games for children.

## Games

- [Snakes and ladders](./games/slangen-en-ladders/) - practise Norwegian words while playing snakes and ladders.
- Kortkrig (hidden) - a card battle against Rex the dinosaur: flip cards, compare numbers, and pick up addition and subtraction along the way. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/kortkrig/](./games/kortkrig/).
- Sound labyrinth (hidden) - explore a maze and choose doors labelled with Norwegian words to find the way out. Still in development, so it is not shown in the game library, but it is built and reachable at [/games/lyd-labyrint/](./games/lyd-labyrint/).
- Butikken (hidden) - run a pretend shop: pick items, pay at the till and work out the change (addition and subtraction up to 100). Still in development, so it is not shown in the game library, but it is built and reachable at [/games/butikken/](./games/butikken/).
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

## GitHub Pages

```sh
npm run build
```

Publish the contents of `dist/`. This creates these static pages:

- `/` - game library
- `/games/lyd-labyrint/` - Sound labyrinth
- `/games/slangen-en-ladders/` - Snakes and ladders
- `/games/kortkrig/` - Kortkrig (the card battle)
- `/games/butikken/` - Butikken (the shop)
- `/games/ordfiske/` - Ordfiske (the word-fishing pond)
- `/games/tierhopp/` - Tierhopp (the number-line jumper)

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes the site automatically when you push to `main`. Select **GitHub Actions** as the Pages source in the repository's Settings > Pages once.
