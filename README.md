# Learn and play

A collection of small reading, counting, and maths games for children.

## Games

- [Snakes and ladders](./games/slangen-en-ladders/) - practise Norwegian words while playing snakes and ladders.
- Butikken (hidden) - run a pretend shop: pick items, pay at the till and work out the change (addition and subtraction up to 100). Still in development, so it is not shown in the game library, but it is built and reachable at [/games/butikken/](./games/butikken/).

## Local development

```sh
npm install
npm run dev
```

Open the home page at the address displayed by Vite. Each game has its own HTML entry point and folder under `games/`, so a new game can be added as `games/a-new-game/index.html` and `src/games/a-new-game/`.

## GitHub Pages

```sh
npm run build
```

Publish the contents of `dist/`. This creates these static pages:

- `/` - game library
- `/games/slangen-en-ladders/` - Snakes and ladders
- `/games/butikken/` - Butikken (the shop)

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes the site automatically when you push to `main`. Select **GitHub Actions** as the Pages source in the repository's Settings > Pages once.
