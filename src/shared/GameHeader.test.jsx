import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GameHeader } from './GameHeader.jsx';

afterEach(cleanup);

describe('shared game header', () => {
  it('links back to the library and shows the game title', () => {
    const view = render(<GameHeader title="Testspillet"><p>Intro</p></GameHeader>);
    const link = view.container.querySelector('.back-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('../../');
    expect(view.container.querySelector('.title-strip h1').textContent).toBe('Testspillet');
    expect(view.container.querySelector('p').textContent).toBe('Intro');
  });
});
