import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Flat config for ESLint 9. Run with `npm.cmd run lint`.
export default [
  // Build output and dependencies are never linted.
  { ignores: ['dist/', 'node_modules/'] },

  // Core recommended rules for every JS file, including the Node-side configs.
  js.configs.recommended,

  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      // The automatic JSX runtime means components never import React.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Plain-JS project without PropTypes; props are documented inline.
      'react/prop-types': 'off',
      // Decorative anonymous components in collections (tile artwork,
      // sound packs) are intentional; display names add no value there.
      'react/display-name': 'off',
      // Battle-tested hook correctness rules. Deliberately NOT enabling
      // the compiler-grade extras shipped in react-hooks v7 (purity, refs,
      // set-state-in-render): this collection intentionally randomises at
      // mount time (confetti bursts, dealt word boards, picked mazes),
      // which those rules reject by design.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Tests may rely on Vitest's injected globals even though the convention
  // is explicit imports; allowing both keeps small test helpers friction-free.
  {
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
];
