import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { StartSync, SyncGate } from './SyncGate.jsx';
import { writeSignInHint } from './account.js';
import { writeStorage } from './persistence.js';
import { HYDRATION_TIMEOUT_MS, resetSync } from './sync.js';
import { albumCodec } from '../games/card-battle/album.js';

function json(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

const game = <p>Spillet</p>;

describe('the sync gate', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSync();
  });

  afterEach(() => {
    resetSync();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders the game straight away when nobody is signed in', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SyncGate>{game}</SyncGate>);

    expect(screen.getByText('Spillet')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders straight away from a warm cache', () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    writeStorage('cardBattle:album', albumCodec.serialize({ discovered: ['fox'] }));
    vi.stubGlobal('fetch', vi.fn(async () => json({ signedIn: true, username: 'Kid' })));

    render(<SyncGate>{game}</SyncGate>);

    expect(screen.getByText('Spillet')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders instantly when the tab goes away before the database answers', async () => {
    writeSignInHint('Kid');
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { unmount } = render(<SyncGate>{game}</SyncGate>);

    expect(screen.getByRole('status')).toBeInTheDocument();

    // Closing the page mid-wait must not leave a state update behind it.
    unmount();
  });

  it('the library page only warms the cache, and shows nothing of its own', async () => {
    writeSignInHint('Kid');
    const fetchMock = vi.fn(async (url) =>
      url === '/api/me' ? json({ signedIn: true, username: 'Kid' }) : json({ records: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<StartSync />);

    expect(container).toBeEmptyDOMElement();
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/me', expect.anything()),
    );
  });

  it('waits for the database on a device that has nothing, then renders', async () => {
    writeSignInHint('Kid');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url === '/api/me') return json({ signedIn: true, username: 'Kid' });
        return json({
          records: [
            { key: 'cardBattle:album', payload: albumCodec.serialize({ discovered: ['fox'] }), revision: 1 },
          ],
        });
      }),
    );

    render(<SyncGate>{game}</SyncGate>);

    expect(screen.getByRole('status')).toHaveTextContent('Henter framgangen din');
    expect(await screen.findByText('Spillet')).toBeInTheDocument();
    expect(screen.getByText('Spillet')).toBeInTheDocument();
  });

  it('gives up waiting at the ceiling and renders the game anyway', async () => {
    writeSignInHint('Kid');
    // A service that never answers: the child still gets to play.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    vi.useFakeTimers();
    render(<SyncGate>{game}</SyncGate>);

    expect(screen.getByRole('status')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HYDRATION_TIMEOUT_MS + 1);
    });

    expect(screen.getByText('Spillet')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
