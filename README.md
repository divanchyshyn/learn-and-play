# Learn and play

A collection of small reading, counting, and maths games for children.

## Games

- [Sound labyrinth](./games/lyd-labyrint/) - explore a maze and choose doors labelled with Norwegian words to find the way out.
- [Snakes and ladders](./games/slangen-en-ladders/) - practise Norwegian words while playing snakes and ladders.
- Butikken (hidden) - run a pretend shop: pick items, pay at the till and work out the change (addition and subtraction up to 100). Still in development, so it is not shown in the game library, but it is built and reachable at [/games/butikken/](./games/butikken/).

## Local development

```sh
npm install
npm run dev
```

Open the home page at the address displayed by Vite. Each game has its own HTML entry point and folder under `games/`, so a new game can be added as `games/a-new-game/index.html` and `src/games/a-new-game/`.

## Tests

Every game is covered by Vitest tests (game logic plus rendered behaviour):

```sh
npm run test        # run all tests once
npm run test:watch  # watch mode while developing
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
- `/games/butikken/` - Butikken (the shop)

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes the site automatically when you push to `main`. Select **GitHub Actions** as the Pages source in the repository's Settings > Pages once.
