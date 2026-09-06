import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { usePersistentState } from './usePersistentState.js';

const KEY = 'harness:count';
const codec = {
  serialize: (value) => JSON.stringify({ version: 1, count: value }),
  parse: (raw) => {
    try {
      const data = JSON.parse(raw);
      return data && data.version === 1 && Number.isInteger(data.count) ? data.count : null;
    } catch {
      return null;
    }
  },
};

function CounterHarness() {
  const [count, setCount] = usePersistentState(KEY, () => 0, codec);
  return (
    <div>
      <output>count:{count}</output>
      <button type="button" onClick={() => setCount(count + 1)}>bump</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('shared usePersistentState', () => {
  it('starts from the initial value when nothing is stored', () => {
    render(<CounterHarness />);
    expect(screen.getByText(/count:0/)).toBeInTheDocument();
  });

  it('restores a stored value on mount', () => {
    localStorage.setItem(KEY, codec.serialize(7));
    render(<CounterHarness />);
    expect(screen.getByText(/count:7/)).toBeInTheDocument();
  });

  it('writes every change back to storage', () => {
    render(<CounterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'bump' }));
    expect(localStorage.getItem(KEY)).toBe(codec.serialize(1));
    fireEvent.click(screen.getByRole('button', { name: 'bump' }));
    expect(localStorage.getItem(KEY)).toBe(codec.serialize(2));
  });

  it('ignores junk storage, falls back to initial, and repairs the save', () => {
    localStorage.setItem(KEY, 'not a codec value at all');
    render(<CounterHarness />);
    expect(screen.getByText(/count:0/)).toBeInTheDocument();
    // The corrupt save is replaced by the fresh baseline.
    expect(localStorage.getItem(KEY)).toBe(codec.serialize(0));
  });

  it('keeps working when storage cannot be written', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    render(<CounterHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'bump' }));
    expect(screen.getByText(/count:1/)).toBeInTheDocument();
  });
});