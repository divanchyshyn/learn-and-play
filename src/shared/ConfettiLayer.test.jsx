import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ConfettiLayer } from './ConfettiLayer.jsx';

afterEach(cleanup);
afterEach(() => vi.restoreAllMocks());

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
    // Pin randomness: rendering calls Math.random 6 times per piece, with the
    // last call deciding round vs rectangular. Alternating the source value
    // makes the even pieces round and the odd ones rectangular, so the mix is
    // guaranteed instead of whatever 10 coin-flips happen to land on.
    let call = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const isRoundPiece = Math.floor(call / 6) % 2 === 0;
      call += 1;
      return isRoundPiece ? 0.9 : 0.1; // > 0.5 = round, <= 0.5 = rectangular
    });
    const view = render(<ConfettiLayer count={10} />);
    const pieces = [...view.container.querySelectorAll('.confetti-piece')];
    expect(pieces.some((piece) => piece.className.includes(' round'))).toBe(true);
    expect(pieces.some((piece) => !piece.className.includes(' round'))).toBe(true);
    expect(pieces.every((piece) => piece.style.backgroundColor !== '')).toBe(true);
  });
});
