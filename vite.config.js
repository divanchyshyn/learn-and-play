import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Every folder under games/ that contains an index.html becomes a build
// entry automatically. Adding a game means creating its folder – this file
// never needs to change.
function discoverGameEntries() {
  const gamesDir = resolve(root, 'games');
  if (!existsSync(gamesDir)) return [];
  return readdirSync(gamesDir)
    .filter((name) => statSync(resolve(gamesDir, name)).isDirectory())
    .filter((slug) => existsSync(resolve(gamesDir, slug, 'index.html')))
    .map((slug) => [slug, resolve(gamesDir, slug, 'index.html')]);
}

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        ...Object.fromEntries(discoverGameEntries()),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // A rendered game test walks a whole maze or fishes a whole trip, which is
    // slow by design: one test drives hundreds of ticks through the real
    // component. The default 5 s ceiling made that look like a hang, and the one
    // test that ever flaked (commit 378fbd6) was given its own 20 s ceiling while
    // its equally expensive neighbours were left on the default. One ceiling for
    // the whole suite is honest and keeps the flake from moving house.
    testTimeout: 20000,
    coverage: {
      // Cover the source tree, not just the files a test happened to import.
      // Without this, a module nobody imports is simply absent from the report
      // - which is how the pure puzzle rules in puzzle.js went unnoticed when
      // they were still buried inside a component module.
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/test/**',
        // Every page's entry point: a file whose whole body is one createRoot
        // call at module scope. There is no component to render and nothing to
        // assert, and the build proves each one is wired up.
        'src/**/main.jsx',
      ],
    },
  },
});