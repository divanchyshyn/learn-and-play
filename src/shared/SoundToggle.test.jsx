import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react';
import { useState } from 'react';
import { SoundToggle } from './SoundToggle.jsx';
import { useSoundToggle } from './useSoundToggle.js';
import { createMuteStore, isMuted, setMuted } from './audio.js';

// The mute flag lives on the shared engine, so every test here starts from the
// same place: unmuted, with no saved value.
beforeEach(() => {
  window.localStorage.clear();
  setMuted(false);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  setMuted(false);
  vi.restoreAllMocks();
});

describe('shared sound toggle button', () => {
  it('says what pressing it will do, and reports its own pressed state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<SoundToggle soundOn onToggle={onToggle} />);

    const on = screen.getByRole('button', { name: 'Slå av lyd' });
    expect(on).toHaveAttribute('aria-pressed', 'false');
    expect(on.textContent).toContain('🔊');

    fireEvent.click(on);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Muted: the label now offers to switch sound on, and the speaker is struck.
    rerender(<SoundToggle soundOn={false} onToggle={onToggle} />);
    const off = screen.getByRole('button', { name: 'Slå på lyd' });
    expect(off).toHaveAttribute('aria-pressed', 'true');
    expect(off.textContent).toContain('🔇');
  });

  it('keeps the game\u2019s own skin on the button', () => {
    render(<SoundToggle soundOn onToggle={() => {}} className="chip toggle" />);
    expect(screen.getByRole('button', { name: 'Slå av lyd' }).className).toBe('chip toggle');
  });
});

// The hook is what the five games actually use, so the contract worth pinning is
// the one they depend on: it opens from the engine's saved state, writes the
// choice back through the game's own key-bound setter, and plays the game's
// confirmation sound only when sound comes back on.
describe('shared sound toggle state', () => {
  function Harness({ applyMuted, onEnable }) {
    const { soundOn, toggleSound } = useSoundToggle(applyMuted, onEnable);
    return <SoundToggle soundOn={soundOn} onToggle={toggleSound} />;
  }

  it('opens silent for a game that opens silent', () => {
    // What a silent game does at page load: its sounds.js binds the engine to
    // its key with `fallback: true` once, and the component then takes that
    // state rather than deciding it. Binding a second time would re-read the
    // empty store and reset the engine, so the test binds once, like the game.
    const store = createMuteStore({ storageKey: 'harness:muted', fallback: true });
    expect(isMuted()).toBe(true);
    render(<Harness applyMuted={store.setMuted} onEnable={() => {}} />);

    expect(screen.getByRole('button', { name: 'Slå på lyd' })).toBeInTheDocument();
  });

  it('opens with sound on for a game that opens with sound on', () => {
    const store = createMuteStore({ storageKey: 'harness:muted' });
    expect(isMuted()).toBe(false);
    render(<Harness applyMuted={store.setMuted} onEnable={() => {}} />);

    expect(screen.getByRole('button', { name: 'Slå av lyd' })).toBeInTheDocument();
  });

  it('saves the choice through the game\u2019s own key and blips only when sound returns', () => {
    const store = createMuteStore({ storageKey: 'harness-two:muted' });
    const onEnable = vi.fn();
    render(<Harness applyMuted={store.setMuted} onEnable={onEnable} />);

    // Switching sound off is silent and is written under the game's key.
    fireEvent.click(screen.getByRole('button', { name: 'Slå av lyd' }));
    expect(isMuted()).toBe(true);
    expect(window.localStorage.getItem('harness-two:muted')).toBe('1');
    expect(onEnable).not.toHaveBeenCalled();

    // Switching it back on plays the game's own sound once.
    fireEvent.click(screen.getByRole('button', { name: 'Slå på lyd' }));
    expect(isMuted()).toBe(false);
    expect(window.localStorage.getItem('harness-two:muted')).toBe('0');
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it('hands the setter the boolean it means, one value at a time', () => {
    // A game's setMuted is the engine's own, and the engine accepts any truthy
    // value - so a hook that passed the wrong shape would break persistence
    // without failing anywhere else.
    const seen = [];
    render(<Harness applyMuted={(value) => seen.push(value)} onEnable={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Slå av lyd' }));
    fireEvent.click(screen.getByRole('button', { name: 'Slå på lyd' }));

    expect(seen).toEqual([true, false]);
  });
});

// A guard on the hook's own re-render behaviour: the pressed state must follow
// the button, not the other way round, so an unrelated parent re-render cannot
// flip the label back.
describe('shared sound toggle stability', () => {
  function Parent({ store }) {
    const { soundOn, toggleSound } = useSoundToggle(store.setMuted, () => {});
    const [forced, force] = useState(0);
    return <>
      <SoundToggle soundOn={soundOn} onToggle={toggleSound} />
      <button type="button" onClick={() => act(() => force(forced + 1))}>re-render</button>
    </>;
  }

  it('keeps the pressed state across an unrelated re-render', () => {
    const store = createMuteStore({ storageKey: 'harness-three:muted' });
    render(<Parent store={store} />);

    fireEvent.click(screen.getByRole('button', { name: 'Slå av lyd' }));
    expect(screen.getByRole('button', { name: 'Slå på lyd' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 're-render' }));
    expect(screen.getByRole('button', { name: 'Slå på lyd' })).toHaveAttribute('aria-pressed', 'true');
  });
});
