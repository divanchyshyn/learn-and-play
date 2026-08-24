import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ConfettiLayer } from './ConfettiLayer.jsx';

afterEach(cleanup);

describe('shared confetti layer', () => {
  it('renders the requested number of decorative pieces', () => {
    const view = render(<ConfettiLayer count={5} />);
    const layer = view.container.querySelector('.confetti-layer');
    expect(layer).toBeTruthy();
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(view.container.querySelectorAll('.confetti-piece')).toHaveLength(5);
  });

  it('defaults to a full celebration of 34 pieces', () => {
    const view = render(<ConfettiLayer />);
    expect(view.container.querySelectorAll('.confetti-piece')).toHaveLength(34);
  });

  it('mixes round and rectangular pieces in the collection colours', () => {
    const view = render(<ConfettiLayer count={10} />);
    const pieces = [...view.container.querySelectorAll('.confetti-piece')];
    expect(pieces.some((piece) => piece.className.includes(' round'))).toBe(true);
    expect(pieces.every((piece) => piece.style.backgroundColor !== '')).toBe(true);
  });
});
