import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        slangenEnLadders: resolve(import.meta.dirname, 'games/slangen-en-ladders/index.html'),
        kortkrig: resolve(import.meta.dirname, 'games/kortkrig/index.html'),
        butikken: resolve(import.meta.dirname, 'games/butikken/index.html'),
        lydLabyrint: resolve(import.meta.dirname, 'games/lyd-labyrint/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});