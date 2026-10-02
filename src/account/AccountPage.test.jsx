import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountPage } from './AccountPage.jsx';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('the account page', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('signs a child in and says so', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: false }));
    render(<AccountPage />);

    await screen.findByRole('tab', { name: 'Logg inn' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ username: 'TestKid' }));
    fireEvent.change(screen.getByLabelText('Brukernavn'), { target: { value: 'TestKid' } });
    fireEvent.change(screen.getByLabelText('Passord'), { target: { value: 'et-langt-passord' } });
    fireEvent.click(screen.getByRole('button', { name: 'Logg inn' }));

    await screen.findByText('Du er logget inn som TestKid');
    expect(screen.getByText(/Framgangen din lagres/)).toBeInTheDocument();
  });

  it('tells a new account holder to write the password down', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ signedIn: false }));
    render(<AccountPage />);

    await screen.findByRole('tab', { name: 'Lag konto' });
    fireEvent.click(screen.getByRole('tab', { name: 'Lag konto' }));

    expect(
      screen.getByText(/Skriv ned passordet og ta godt vare på det/),
    ).toBeInTheDocument();
    expect(screen.getByText(/kan ikke gjenopprette/)).toBeInTheDocument();
  });

  it('shows a calm Norwegian message when the sign-in is refused', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: false }));
    render(<AccountPage />);

    await screen.findByRole('tab', { name: 'Logg inn' });

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_credentials' }, 401));
    fireEvent.change(screen.getByLabelText('Brukernavn'), { target: { value: 'TestKid' } });
    fireEvent.change(screen.getByLabelText('Passord'), { target: { value: 'galt-passord-her' } });
    fireEvent.click(screen.getByRole('button', { name: 'Logg inn' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Fant ingen konto med det brukernavnet og det passordet.');
  });

  it('keeps the page usable when the service cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<AccountPage />);

    // The check fails, so the page offers the forms rather than an error.
    expect(await screen.findByRole('tab', { name: 'Logg inn' })).toBeInTheDocument();
  });

  it('says what is stored and offers a way back to the games', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ signedIn: false }));
    render(<AccountPage />);

    await screen.findByRole('tab', { name: 'Logg inn' });

    expect(screen.getByText(/ingen e-post, ingen navn, ingen fødselsdato/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tilbake til spillene' })).toHaveAttribute('href', '../');
  });

  it('shows the delete form with a warning about what disappears', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: true, username: 'TestKid' }));
    render(<AccountPage />);

    await screen.findByText('Du er logget inn som TestKid');
    fireEvent.click(screen.getByRole('button', { name: 'Slett kontoen min' }));

    await waitFor(() =>
      expect(screen.getByText(/Dette kan ikke angres/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Slett kontoen' })).toBeInTheDocument();
  });
});
