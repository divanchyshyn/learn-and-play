import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { SlangenEnLadders } from './SlangenEnLadders.jsx';

beforeEach(() => {
  // 0.6 → dice roll = floor(0.6 * 6) + 1 = 4 every time, making games deterministic.
  vi.spyOn(Math, 'random').mockReturnValue(0.6);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function rollButton() {
  return screen.getByRole('button', { name: 'Kast terningen' });
}

describe('slangen-en-ladders game', () => {
  it('starts with both players on cell 1 and a fresh message', () => {
    render(<SlangenEnLadders />);
    expect(screen.getByText('Kast terningen for å starte spillet.')).toBeInTheDocument();
    expect(screen.getAllByText('Rute 1')).toHaveLength(2);
    expect(rollButton()).toBeEnabled();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Mål')).toBeInTheDocument();
  });

  it('rolls the dice and asks the player to read the word', () => {
    render(<SlangenEnLadders />);
    fireEvent.click(rollButton());

    // Roll is always 4, so Spiller 1 lands on cell 5.
    expect(screen.getByText(/landet på rute 5/)).toBeInTheDocument();
    expect(screen.getByText(/Les høyt/)).toBeInTheDocument();

    // The board cell exposes its word through the aria-label.
    const cell = screen.getByLabelText(/^Rute 5: .+/);
    expect(cell.getAttribute('aria-label')).toMatch(/^Rute 5: \S+$/);

    // The roll button locks while a word is pending.
    expect(rollButton()).toBeDisabled();
  });

  it('climbs the ladder at cell 5 after the word is read and passes the turn', () => {
    render(<SlangenEnLadders />);
    fireEvent.click(rollButton());
    fireEvent.click(screen.getByRole('button', { name: 'Riktig' }));

    expect(screen.getByText(/klatrer opp til rute 21/)).toBeInTheDocument();
    const rows = screen.getAllByText(/Rute (1|5|21)$/);
    expect(rows.some((row) => row.textContent === 'Rute 21')).toBe(true);
    expect(screen.queryByText(/Les høyt/)).not.toBeInTheDocument();
    expect(rollButton()).toBeEnabled();
  });

  it('lets the player practise the word again without moving', () => {
    render(<SlangenEnLadders />);
    fireEvent.click(rollButton());
    fireEvent.click(screen.getByRole('button', { name: 'Øv mer' }));

    expect(screen.getByText(/prøv ordet én gang til/)).toBeInTheDocument();
    expect(screen.getAllByText('Rute 5').length).toBeGreaterThan(0);
    expect(screen.queryByText(/klatrer opp/)).not.toBeInTheDocument();
  });

  it('plays a whole game through to the winner dialog', () => {
    render(<SlangenEnLadders />);

    for (let turn = 0; turn < 100; turn += 1) {
      if (screen.queryByText(/vant!/)) break;
      if (!rollButton().disabled) {
        fireEvent.click(rollButton());
      } else if (screen.queryByRole('button', { name: 'Riktig' })) {
        fireEvent.click(screen.getByRole('button', { name: 'Riktig' }));
      }
    }

    expect(screen.getByText(/vant!/)).toBeInTheDocument();
    expect(screen.getByText('Spillet er ferdig')).toBeInTheDocument();
    expect(rollButton()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Spill igjen' }));
    expect(screen.getByText('Kast terningen for å starte spillet.')).toBeInTheDocument();
    expect(screen.getAllByText('Rute 1')).toHaveLength(2);
  });
});
