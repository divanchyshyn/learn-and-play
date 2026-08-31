import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GameHeader } from './GameHeader.jsx';

afterEach(cleanup);

describe('shared game header', () => {
  it('shows the back link with the game title as a compact pill next to it', () => {
    const view = render(<GameHeader title="Testspillet"><p>Intro</p></GameHeader>);
    const bar = view.container.querySelector('.header-bar');
    const link = view.container.querySelector('.back-link');
    const strip = view.container.querySelector('.title-strip h1');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('../../');
    expect(strip.textContent).toBe('Testspillet');
    // The title pill sits on the same compact line as the library link.
    expect(bar).toBeTruthy();
    expect(bar.contains(link)).toBe(true);
    expect(bar.contains(strip)).toBe(true);
    expect(view.container.querySelector('p').textContent).toBe('Intro');
  });
});
