import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

// The pill a child taps and the text only a screen reader reads were each copied
// into five (and four) game stylesheets, byte for byte. They now live in
// base.css, which every entry point imports before its own stylesheet. That
// ordering is what lets a game add to `.chip` - Word Fishing's flex row, the
// labyrinth's destructive reset tint - so it is worth pinning: a copy that
// creeps back into a game stylesheet would silently shadow the shared rule.
//
// Comments are stripped first, so a rule that is commented out can never
// satisfy an assertion. Tests run from the project root.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const BASE = stripComments(readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8'));

function declarationsOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return rule ? rule[1].replace(/\s+/g, ' ').trim() : null;
}

function gameStylesheets() {
  const gamesDir = resolve(process.cwd(), 'src/games');
  return readdirSync(gamesDir)
    .map((slug) => ({
      slug,
      css: stripComments(readFileSync(resolve(gamesDir, slug, 'style.css'), 'utf8')),
    }));
}

const SHARED_RULES = ['.chip', '.chip:hover', '.visually-hidden'];

describe('shared base styles', () => {
  it('owns the pill and the screen-reader-only text', () => {
    expect(declarationsOf(BASE, '.chip')).toContain('min-height: 40px');
    expect(declarationsOf(BASE, '.chip')).toContain('border-radius: 999px');
    expect(declarationsOf(BASE, '.chip:hover')).toContain('transform: translateY(-2px)');
    expect(declarationsOf(BASE, '.visually-hidden')).toContain('clip: rect(0 0 0 0)');
  });

  it('leaves no game stylesheet re-declaring them', () => {
    const copies = [];
    for (const { slug, css } of gameStylesheets()) {
      for (const selector of SHARED_RULES) {
        const declarations = declarationsOf(css, selector);
        if (declarations === null) continue;
        // Word Fishing extends `.chip` with its own flex row rather than
        // redefining it; that is allowed as long as it stays additive, which the
        // next test checks. Everything else here is a copy.
        if (slug === 'word-fishing' && selector === '.chip') continue;
        copies.push(`${slug}/${selector}`);
      }
    }
    expect(copies, 'these rules belong in src/styles/base.css').toEqual([]);
  });

  it('lets a game extend the pill without redefining it', () => {
    // The one game that adds to `.chip` instead of copying it. Its extra
    // declarations are additive, so the shared rule still does the styling.
    const fishing = gameStylesheets().find(({ slug }) => slug === 'word-fishing');
    const additions = declarationsOf(fishing.css, '.chip');
    expect(additions).toContain('display: inline-flex');
    expect(additions).not.toContain('border-radius');
    expect(additions).not.toContain('min-height');
  });
});
