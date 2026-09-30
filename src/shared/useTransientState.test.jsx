import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, act, cleanup } from '@testing-library/react';
import { useTransientState } from './useTransientState.js';

// A moment that clears itself: the whole point is the clock, so the tests drive
// fake timers and watch when the value goes.
function Harness({ ms }) {
  const [value, show, clear] = useTransientState(ms);
  return <>
    <span data-testid="value">{value === null ? 'nothing' : JSON.stringify(value)}</span>
    <button type="button" onClick={() => show({ text: 'hei', key: 1 })}>show</button>
    <button type="button" onClick={() => show({ text: 'hei igjen', key: 2 })}>show again</button>
    <button type="button" onClick={clear}>clear</button>
  </>;
}

const shown = () => screen.getByTestId('value').textContent;
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('shared transient state', () => {
  it('starts empty and clears itself once the moment is over', () => {
    render(<Harness ms={1200} />);
    expect(shown()).toBe('nothing');

    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    expect(shown()).toContain('hei');

    tick(1199);
    expect(shown()).toContain('hei');
    tick(1);
    expect(shown()).toBe('nothing');
  });

  it('restarts the clock when a new moment replaces the old one', () => {
    render(<Harness ms={1000} />);

    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    tick(900);
    // A second moment arrives nearly at the end of the first one's life: it gets
    // its own full time, rather than the 100 ms the first one had left.
    fireEvent.click(screen.getByRole('button', { name: 'show again' }));
    tick(900);
    expect(shown()).toContain('hei igjen');
    tick(100);
    expect(shown()).toBe('nothing');
  });

  it('can be taken away at once by the game', () => {
    render(<Harness ms={5000} />);

    fireEvent.click(screen.getByRole('button', { name: 'show' }));
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(shown()).toBe('nothing');

    // And the cleared moment's own timer is gone: nothing comes back later.
    tick(5000);
    expect(shown()).toBe('nothing');
  });

  it('leaves no timer running after the game is gone', () => {
    const view = render(<Harness ms={400} />);
    fireEvent.click(screen.getByRole('button', { name: 'show' }));

    view.unmount();
    // A late fire after unmount would be a React state update on a gone
    // component; clearing the timer on unmount is what prevents it.
    expect(() => tick(400)).not.toThrow();
  });
});
