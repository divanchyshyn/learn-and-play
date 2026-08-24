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
  },
});