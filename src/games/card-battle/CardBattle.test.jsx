import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CardBattle } from './CardBattle.jsx';
import { ALBUM_KEY } from './album.js';
import { CREATURES, attempt, equationText, spokenEquation } from './riddles.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
});

// The riddle is random (tier, numbers and hand), so every test reads whatever
// was actually rendered and derives the answer from it.
function readRiddle(view) {
  const card = view.container.querySelector('.riddle-card');
  return {
    operation: card.dataset.operation,
    rexValue: Number(card.dataset.rex),
    target: Number(card.dataset.target),
  };
}

function answerFor(riddle) {
  return riddle.operation === 'plus' ? riddle.target - riddle.rexValue : riddle.target + riddle.rexValue;
}

function handCards(view) {
  return [...view.container.querySelectorAll('.hand-card')];
}

function cardWithValue(view, value) {
  return handCards(view).find((card) => card.textContent.trim() === String(value));
}

function solve(view) {
  const riddle = readRiddle(view);
  fireEvent.click(cardWithValue(view, answerFor(riddle)));
  fireEvent.click(screen.getByRole('button', { name: 'Legg kortet!' }));
  return riddle;
}

function foundCardCount(view) {
  return view.container.querySelectorAll('.album-card.found').length;
}

function seedAlbum(discovered) {
  localStorage.setItem(ALBUM_KEY, JSON.stringify({ version: 1, album: { discovered } }));
}

function stubSpeech() {
  const speak = vi.fn();
  window.speechSynthesis = { cancel: vi.fn(), speak, getVoices: () => [] };
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  return speak;
}

describe('card-battle riddle flow', () => {
  it('deals a solvable riddle with four different hand cards', () => {
    const view = render(<CardBattle />);
    const riddle = readRiddle(view);
    const values = handCards(view).map((card) => Number(card.textContent));

    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(4);
    expect(values).toContain(answerFor(riddle));
    expect(attempt(riddle, answerFor(riddle)).correct).toBe(true);
    expect(screen.getByText('🃏 0 av 16 kort funnet')).toBeInTheDocument();
  });

  it('solving flips the next animal into the album and deals a fresh riddle', () => {
    const view = render(<CardBattle />);
    solve(view);

    expect(view.container.querySelector('.creature-name').textContent).toBe(CREATURES[0].name);
    expect(view.container.querySelector('.creature-fact').textContent).toBe(CREATURES[0].fact);
    expect(foundCardCount(view)).toBe(1);
    expect(screen.getByText('🃏 1 av 16 kort funnet')).toBeInTheDocument();
    expect(view.container.querySelector('.album-card[data-creature="fox"]')).toHaveClass('found');

    fireEvent.click(screen.getByRole('button', { name: 'Neste gåte' }));
    expect(view.container.querySelector('.reveal')).toBeNull();
    expect(handCards(view)).toHaveLength(4);
    expect(foundCardCount(view)).toBe(1);
  });

  it('a wrong card shows the real sum and can be tried again', () => {
    const view = render(<CardBattle />);
    const riddle = readRiddle(view);
    const answer = answerFor(riddle);
    const wrong = handCards(view).map((card) => Number(card.textContent)).find((value) => value !== answer);

    fireEvent.click(cardWithValue(view, wrong));
    fireEvent.click(screen.getByRole('button', { name: 'Legg kortet!' }));

    const outcome = attempt(riddle, wrong);
    const mistake = view.container.querySelector('.mistake').textContent;
    expect(mistake).toContain(equationText(riddle.operation, wrong, riddle.rexValue, outcome.result));
    expect(mistake).toMatch(/Prøv et annet kort/);
    expect(cardWithValue(view, wrong)).toBeDisabled();
    expect(foundCardCount(view)).toBe(0);
    expect(screen.getByText('🃏 0 av 16 kort funnet')).toBeInTheDocument();

    solve(view);
    expect(foundCardCount(view)).toBe(1);
    // The retry costs nothing but the extra try also earns no first-try star.
    expect(view.container.querySelector('.bonus')).toBeNull();
  });

  it('celebrates a solved riddle without a wrong try with a first-try star', () => {
    const view = render(<CardBattle />);
    solve(view);
    expect(screen.getByText(/Feilfritt/)).toBeInTheDocument();
  });
});

describe('card-battle album progress', () => {
  it('completes a page and throws confetti on its fourth animal', () => {
    seedAlbum(['fox', 'owl', 'squirrel']);
    const view = render(<CardBattle />);
    expect(foundCardCount(view)).toBe(3);

    solve(view);
    expect(view.container.querySelector('.creature-name').textContent).toBe('Rådyret');
    expect(view.container.querySelector('.page-medal[data-page="forest"]').textContent).toContain('Skogen er samlet!');
    expect(view.container.querySelector('.confetti-layer')).not.toBeNull();
    expect(foundCardCount(view)).toBe(4);
  });

  it('grows the maths with the album: page three deals minus riddles', () => {
    seedAlbum(CREATURES.slice(0, 8).map((entry) => entry.id));
    const view = render(<CardBattle />);
    expect(readRiddle(view).operation).toBe('minus');
  });

  it('completes the album with the last animal and offers an explicit restart', () => {
    seedAlbum(CREATURES.slice(0, CREATURES.length - 1).map((entry) => entry.id));
    const view = render(<CardBattle />);
    expect(foundCardCount(view)).toBe(CREATURES.length - 1);

    solve(view);
    const last = CREATURES[CREATURES.length - 1];
    expect(view.container.querySelector('.creature-name').textContent).toBe(last.name);
    expect(screen.getByText(/Alle 16 dyrekortene er samlet!/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start på nytt' }));
    expect(screen.getByText('🃏 0 av 16 kort funnet')).toBeInTheDocument();
    expect(foundCardCount(view)).toBe(0);
    expect(screen.queryByText(/Alle 16 dyrekortene er samlet!/)).toBeNull();
  });

  it('remembers found animals across a reload', () => {
    const view = render(<CardBattle />);
    solve(view);
    view.unmount();

    const again = render(<CardBattle />);
    expect(screen.getByText('🃏 1 av 16 kort funnet')).toBeInTheDocument();
    expect(foundCardCount(again)).toBe(1);
  });
});

describe('card-battle narration', () => {
  it('reads the solved equation aloud only when narration is switched on', () => {
    const speak = stubSpeech();
    const view = render(<CardBattle />);

    solve(view);
    expect(speak).not.toHaveBeenCalled(); // opt-in: silent by default

    fireEvent.click(screen.getByRole('button', { name: 'Neste gåte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Les regnestykket høyt' }));
    expect(screen.getByRole('button', { name: 'Slå av opplesning' })).toBeInTheDocument();

    const riddle = solve(view);
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0];
    expect(utterance.lang).toBe('nb-NO');
    expect(utterance.text).toBe(spokenEquation(riddle.operation, answerFor(riddle), riddle.rexValue));
  });

  it('survives a browser without speech support when narration is on', () => {
    const view = render(<CardBattle />);
    fireEvent.click(screen.getByRole('button', { name: 'Les regnestykket høyt' }));
    expect(() => solve(view)).not.toThrow();
    expect(view.container.querySelector('.reveal')).not.toBeNull();
  });
});
