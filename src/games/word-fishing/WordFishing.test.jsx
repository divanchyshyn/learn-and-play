import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react';
import { Ordfiske } from './Ordfiske.jsx';
import { BUCKET_GOAL, CATCH_TICKS, FISH_ON_SCREEN, RESUME_TICKS, TICK_MS } from './fish.js';

// Math.random is pinned so spawns are deterministic: every fish enters from
// the right edge at the slowest speed and takes the first free lane.
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  cleanup();
});

function ticks(count) {
  act(() => {
    vi.advanceTimersByTime(count * TICK_MS);
  });
}

// Fish whose centre is actually inside the visible pond (they start their
// lives just beyond the edge).
function visibleFish(view) {
  return [...view.container.querySelectorAll('.fish')]
    .filter((element) => !element.className.includes('caught'))
    .map((element) => ({ element, x: parseFloat(element.style.left) }))
    .filter((fish) => fish.x > 2 && fish.x < 98);
}

function surfaceVisibleFish(view) {
  for (let guard = 0; guard < 300 && visibleFish(view).length === 0; guard += 1) ticks(10);
  const target = visibleFish(view)[0];
  fireEvent.click(target.element.querySelector('.swimmer'));
  return target;
}

function catchOne(view) {
  surfaceVisibleFish(view);
  fireEvent.click(screen.getByRole('button', { name: 'Fanget!' }));
  ticks(CATCH_TICKS + 2); // let the flight to the bucket finish
}

function bucketCount() {
  return screen.getByText(new RegExp(`^\\d+ av ${BUCKET_GOAL}$`));
}

describe('ordfiske rendered game', () => {
  it('opens with a living pond: shoal, tags and an empty bucket', () => {
    const view = render(<Ordfiske />);

    expect(screen.getByRole('group', { name: /Fiskedammen/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Fisk som bærer ordet/ })).toHaveLength(FISH_ON_SCREEN);

    // Every swimming fish carries its own word on a visible tag.
    const tags = [...view.container.querySelectorAll('.fish-tag')].map((tag) => tag.textContent);
    expect(tags).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(tags).size).toBe(FISH_ON_SCREEN);

    expect(bucketCount()).toHaveTextContent(`0 av ${BUCKET_GOAL}`);
  });

  it('surfaces a tapped fish with its word and the two calm choices', () => {
    const view = render(<Ordfiske />);
    const target = visibleFishAfterEntry(view);

    fireEvent.click(target.element.querySelector('.swimmer'));

    const card = view.container.querySelector('.fish-card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.fish-word').textContent).toMatch(/🔊$/);
    expect(screen.getByRole('button', { name: 'Fanget!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En gang til' })).toBeInTheDocument();
    // The little tag steps aside while the big card shows the same word.
    expect(target.element.querySelector('.fish-tag')).toBeNull();

    ticks(1); // any tick keeps the card up while the countdown runs
    expect(view.container.querySelector('.fish-card')).toBeTruthy();
  });

  function visibleFishAfterEntry(view) {
    for (let guard = 0; guard < 300 && visibleFish(view).length === 0; guard += 1) ticks(10);
    return visibleFish(view)[0];
  }

  it('reads the word aloud when tapped, as optional support', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel() {},
      speak(utterance) { spoken.push(utterance.text); },
    });

    const view = render(<Ordfiske />);
    const target = visibleFishAfterEntry(view);
    fireEvent.click(target.element.querySelector('.swimmer'));
    fireEvent.click(view.container.querySelector('.fish-word'));

    expect(spoken).toEqual([view.container.querySelector('.fish-word').textContent.replace('🔊', '')]);
    vi.unstubAllGlobals();
  });

  it('sends the fish to the bucket on ✅ and greets a replacement', () => {
    const view = render(<Ordfiske />);
    surfaceVisibleFish(view);
    fireEvent.click(screen.getByRole('button', { name: 'Fanget!' }));

    expect(bucketCount()).toHaveTextContent(`1 av ${BUCKET_GOAL}`);
    // No choice buttons linger on a fish that is flying to the bucket.
    expect(screen.queryByRole('button', { name: 'En gang til' })).not.toBeInTheDocument();

    ticks(CATCH_TICKS + 2);
    expect(view.container.querySelectorAll('.fish.caught')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /Fisk som bærer ordet/ })).toHaveLength(FISH_ON_SCREEN);
    expect(bucketCount()).toHaveTextContent(`1 av ${BUCKET_GOAL}`);
  });

  it('treats 🔁 as an ordinary part of play – back to swimming, nothing tracked', () => {
    const view = render(<Ordfiske />);
    surfaceVisibleFish(view);
    fireEvent.click(screen.getByRole('button', { name: 'En gang til' }));

    expect(view.container.querySelector('.fish-card')).toBeNull();
    expect(view.container.querySelector('.fish-tag')).toBeTruthy();
    expect(bucketCount()).toHaveTextContent(`0 av ${BUCKET_GOAL}`);

    ticks(30);
    // Still no failure language anywhere on the page.
    expect(screen.queryByText(/feil|gal|i igjen/i)).not.toBeInTheDocument();
    expect(bucketCount()).toHaveTextContent(`0 av ${BUCKET_GOAL}`);
  });

  it('lets an ignored surfaced fish calmly swim on by itself', () => {
    const view = render(<Ordfiske />);
    surfaceVisibleFish(view);
    expect(view.container.querySelector('.fish-card')).toBeTruthy();

    ticks(RESUME_TICKS);

    expect(view.container.querySelector('.fish-card')).toBeNull();
    expect(view.container.querySelector('.fish-tag')).toBeTruthy();
    expect(bucketCount()).toHaveTextContent(`0 av ${BUCKET_GOAL}`);
  });

  it('celebrates a full bucket and refills it on demand', () => {
    const view = render(<Ordfiske />);
    for (let caught = 0; caught < BUCKET_GOAL; caught += 1) catchOne(view);

    expect(screen.getByText('Bøtta er full!')).toBeInTheDocument();
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    expect(bucketCount()).toHaveTextContent(`${BUCKET_GOAL} av ${BUCKET_GOAL}`);

    fireEvent.click(screen.getByRole('button', { name: /Fisk mer/ }));
    expect(screen.queryByText('Bøtta er full!')).not.toBeInTheDocument();
    expect(bucketCount()).toHaveTextContent(`0 av ${BUCKET_GOAL}`);
    // The pond never stopped living behind the celebration.
    expect(screen.getAllByRole('button', { name: /Fisk som bærer ordet/ }).length).toBeGreaterThan(0);
  });

  it('starts a completely fresh pond from the header', () => {
    const view = render(<Ordfiske />);
    surfaceVisibleFish(view);
    fireEvent.click(screen.getByRole('button', { name: 'Fanget!' }));
    expect(bucketCount()).toHaveTextContent(`1 av ${BUCKET_GOAL}`);

    fireEvent.click(screen.getByRole('button', { name: /Nytt fiske/ }));
    expect(bucketCount()).toHaveTextContent(`0 av ${BUCKET_GOAL}`);
    expect(screen.queryByRole('button', { name: 'Fanget!' })).not.toBeInTheDocument();
  });
});
