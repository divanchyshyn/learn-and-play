import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { REEF_REWARDS } from './trip.js';
import { REWARD_IDS, ReefArt } from './ReefRewards.jsx';

// The treasures are the reward a child comes back for, so they are worth guarding:
// every decoration the reef hands out must have a drawing, and that drawing must
// be a small scene rather than a glyph.
describe('word-fishing treasure art', () => {
  it('draws every treasure the reef hands out', () => {
    for (const reward of REEF_REWARDS) {
      expect(REWARD_IDS, `${reward.id} has no art`).toContain(reward.id);
    }
  });

  it('keeps no drawing the game never hands out', () => {
    const handedOut = new Set(REEF_REWARDS.map((reward) => reward.id));
    for (const id of REWARD_IDS) {
      expect(handedOut.has(id), `${id} can never be unlocked`).toBe(true);
    }
  });

  it('paints a detailed sprite with shared paints for every treasure', () => {
    for (const id of REWARD_IDS) {
      const { container, unmount } = render(<ReefArt id={id} />);
      const svg = container.querySelector('svg.reef-art');
      expect(svg, `${id} is not drawn`).toBeTruthy();
      // A treasure is a scene: several shapes, and at least one of them painted
      // from the shared palette rather than from a flat colour.
      expect(svg.querySelectorAll('path, circle, ellipse, rect').length, `${id} is too simple`)
        .toBeGreaterThanOrEqual(8);
      expect(svg.querySelectorAll('[fill^="url(#"], [stroke^="url(#"]').length, `${id} uses no shared paint`)
        .toBeGreaterThan(0);
      unmount();
    }
  });

  it('skips an id this version does not draw', () => {
    const { container } = render(<ReefArt id="finnesikke" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
