import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { REEF_REWARDS } from './trip.js';
import { REWARD_IDS, ReefArt } from './ReefRewards.jsx';

// The treasures are the reward a child comes back for, so they are worth guarding:
// every decoration the reef hands out must have a picture, that picture must be one
// of the game's own photographs, and no two finds may be the same picture.
describe('word-fishing treasure art', () => {
  it('paints every treasure the reef hands out', () => {
    for (const reward of REEF_REWARDS) {
      expect(REWARD_IDS, `${reward.id} has no art`).toContain(reward.id);
    }
  });

  it('keeps no picture the game never hands out', () => {
    const handedOut = new Set(REEF_REWARDS.map((reward) => reward.id));
    for (const id of REWARD_IDS) {
      expect(handedOut.has(id), `${id} can never be unlocked`).toBe(true);
    }
  });

  it('gives every treasure its own photograph, silent and never stretched', () => {
    const sources = new Set();
    for (const id of REWARD_IDS) {
      const { container, unmount } = render(<ReefArt id={id} />);
      const photo = container.querySelector('img.reef-art');
      expect(photo, `${id} has no picture`).toBeTruthy();
      expect(photo.getAttribute('src'), `${id} has no source`).toMatch(new RegExp(`photo-assets/${id}\\.webp$`));
      expect(photo.getAttribute('alt'), `${id} must stay silent`).toBe('');
      // Ten finds, ten different photographs: no treasure is another one twice.
      sources.add(photo.getAttribute('src'));
      unmount();
    }
    expect(sources.size).toBe(REWARD_IDS.length);
  });

  it('skips an id this version does not paint', () => {
    const { container } = render(<ReefArt id="finnesikke" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
