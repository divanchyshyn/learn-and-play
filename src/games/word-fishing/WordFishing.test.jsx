import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, cleanup, within } from '@testing-library/react';
import { TIMING, WordFishing } from './WordFishing.jsx';
import { DELIVER_TICKS, FISH_ON_SCREEN, REEL_STEPS, TICK_MS, createSea, fishWord } from './sea.js';
import { JOURNAL_KEY, TRIP_KEY, createJournal, journalCodec, tripCodec } from './journal.js';
import { createTripPlan, crateForWord, tripRequest } from './trip.js';
import { CATEGORY_CRATE_IDS, WORD_BANK, WORD_COUNT, crateById, crateWordCount } from './words.js';

// Math.random is pinned so the shoal is deterministic: every fish enters from
// the right edge at the calmest speed and takes the first free lane.
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.useFakeTimers();
  window.localStorage.clear();
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

function fishElements(view) {
  return [...view.container.querySelectorAll('.fish')];
}

function visibleFish(view) {
  return fishElements(view).filter((element) => {
    const x = parseFloat(element.style.left);
    return x > 6 && x < 94 && !element.className.includes('delivered');
  });
}

// Wait for the shoal to drift properly into the water, then take the first fish
// that is fully inside the frame.
function firstVisibleFish(view) {
  for (let guard = 0; guard < 400; guard += 1) {
    const visible = visibleFish(view);
    if (visible.length > 0) return visible[0];
    ticks(5);
  }
  throw new Error('no fish drifted into view');
}

function tagWord(fishElement) {
  return fishElement.querySelector('.fish-tag').textContent;
}

// Hook one fish and wind it all the way in. Returns the word it carries.
function catchWord(view) {
  const fish = firstVisibleFish(view);
  const word = tagWord(fish);
  fireEvent.click(fish.querySelector('.fish-art')); // the hook bites
  for (let step = 0; step < REEL_STEPS; step += 1) {
    fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));
  }
  return word;
}

function crateElement(view, crateId) {
  const wanted = `Legg fisken i kassen ${crateById(crateId).label}`;
  return [...view.container.querySelectorAll('.crate')].find((element) => element.getAttribute('aria-label') === wanted);
}

function crateProgress(view, crateId) {
  const wanted = `Kassen ${crateById(crateId).label}: `;
  const crate = [...view.container.querySelectorAll('.crate')]
    .find((element) => element.getAttribute('aria-label').startsWith(wanted));
  return crate.getAttribute('aria-label').slice(wanted.length);
}

function categoryOf(word) {
  return WORD_BANK.find((entry) => entry.word === word).cat;
}

// How many words one crate holds, straight from the bank, so changing the bank
// never means rewriting a rendered test.
function crateGoal(crateId) {
  return crateWordCount(crateId);
}

// Catch one word and put it in the crate it belongs in.
function catchAndSort(view) {
  const word = catchWord(view);
  fireEvent.click(crateElement(view, categoryOf(word)));
  ticks(DELIVER_TICKS + 2);
  return word;
}

// The word the very first fish of a pinned deal carries – the one the shoal
// brings into view first.
function firstDealtWord() {
  return fishWord(createSea(createTripPlan(1)).fishes[0]);
}

describe('word-fishing rendered game', () => {
  it('opens with a living sea, four crates and the day\'s order', () => {
    const view = render(<WordFishing />);

    expect(screen.getByRole('group', { name: /Havet med ord-fisker/ })).toBeInTheDocument();
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);

    // Every swimming fish carries its own word on a tag, and no word repeats.
    const tags = [...view.container.querySelectorAll('.fish-tag')].map((tag) => tag.textContent);
    expect(tags).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(tags).size).toBe(FISH_ON_SCREEN);

    // The boat, the line and the float are all part of the scene.
    expect(view.container.querySelector('.boat')).toBeTruthy();
    expect(view.container.querySelector('.fishing-line')).toBeTruthy();
    expect(view.container.querySelector('.fishing-float')).toBeTruthy();

    // Four crates, full strength, none of them an answer yet.
    const crates = [...view.container.querySelectorAll('.crate')];
    expect(crates).toHaveLength(4);
    for (const crate of crates) {
      expect(crate).toBeDisabled();
      expect(crate.getAttribute('aria-label')).toMatch(/^Kassen .+: 0 av \d+ ord$/);
    }

    expect(screen.getByText(tripRequest(createTripPlan(1)))).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
  });

  it('hooks a fish, winds it in and shows the word on deck', () => {
    const view = render(<WordFishing />);
    const fish = firstVisibleFish(view);
    const word = tagWord(fish);

    fireEvent.click(fish.querySelector('.fish-art'));

    const onLine = view.container.querySelector('.fish-hooked');
    expect(onLine).toBeTruthy();
    // A hooked fish stops showing its tag and shows the reel instead.
    expect(onLine.querySelector('.fish-tag')).toBeNull();
    expect(onLine.querySelectorAll('.reel-dot')).toHaveLength(REEL_STEPS);
    expect(onLine.querySelectorAll('.reel-dot.filled')).toHaveLength(0);

    for (let step = 1; step < REEL_STEPS; step += 1) {
      fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));
      expect(view.container.querySelectorAll('.fish-hooked .reel-dot.filled')).toHaveLength(step);
    }
    fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));

    const card = view.container.querySelector('.catch-card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.catch-word').textContent).toContain(word);
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
    expect(screen.getByRole('button', { name: `Hør ordet ${word}` })).toBeInTheDocument();
    // The crates can be answered now.
    expect(crateElement(view, categoryOf(word))).toBeEnabled();
    expect(TIMING.REEL_STEPS).toBe(REEL_STEPS);
  });

  it('reads the word aloud on the catch card, as optional support', () => {
    const spoken = [];
    vi.stubGlobal('speechSynthesis', {
      cancel: () => {},
      speak: (utterance) => spoken.push(utterance.text),
      getVoices: () => [],
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      constructor(text) { this.text = text; }
    });

    const view = render(<WordFishing />);
    const word = catchWord(view);
    fireEvent.click(view.container.querySelector('.catch-word'));

    expect(spoken).toEqual([word]);
    vi.unstubAllGlobals();
  });
});


describe('word-fishing catch and reward', () => {
  it('puts the catch in the crate the word belongs in, with nothing in the way', () => {
    const view = render(<WordFishing />);
    const word = catchWord(view);
    const crateId = categoryOf(word);

    fireEvent.click(crateElement(view, crateId));

    // The catch goes straight into the book and the crate – no card interrupts.
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.notice-card')).toBeNull();
    expect(view.container.querySelector('.trip-done')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    expect(crateProgress(view, crateId)).toBe(`1 av ${crateGoal(crateId)} ord`);
    expect(screen.getByText(`1 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT - 1} igjen.`)).toBeInTheDocument();

    // The caught word is really in the book.
    fireEvent.click(screen.getByRole('button', { name: /Fangstboka/ }));
    const book = screen.getByRole('dialog', { name: 'Fangstboka' });
    expect(within(book).getByText(word)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lukk fangstboka' }));

    ticks(DELIVER_TICKS + 2);
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);
  });

  it('writes a word into the book exactly once, however often it is caught', () => {
    const known = firstDealtWord();
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      ...createJournal(),
      words: [known],
    }));

    const view = render(<WordFishing />);

    expect(screen.getByText(`1 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT - 1} igjen.`)).toBeInTheDocument();
    expect(catchAndSort(view)).toBe(known);
    // The catch still fills the crate; the book is not written twice.
    expect(crateProgress(view, categoryOf(known))).toBe(`1 av ${crateGoal(categoryOf(known))} ord`);
    expect(screen.getByText(`1 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT - 1} igjen.`)).toBeInTheDocument();
  });

  it('lets a fish that belongs in another crate swim on, with nothing lost', () => {
    const view = render(<WordFishing />);
    const word = catchWord(view);
    const rightCrate = categoryOf(word);
    const wrongCrate = CATEGORY_CRATE_IDS.find((crateId) => crateId !== rightCrate);

    fireEvent.click(crateElement(view, wrongCrate));

    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    expect(view.container.querySelector('.notice-card')).toBeNull();
    // The fish is swimming again, and the right crate quietly shows the way.
    expect(view.container.querySelector('.fish-swim')).toBeTruthy();
    expect(view.container.querySelector('.crate.hint').getAttribute('aria-label'))
      .toBe(`Kassen ${crateById(rightCrate).label}: 0 av ${crateGoal(rightCrate)} ord`);
    expect(crateProgress(view, wrongCrate)).toBe(`0 av ${crateGoal(wrongCrate)} ord`);
    expect(screen.getByText(`0 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT} igjen.`)).toBeInTheDocument();
    // No failure language anywhere, and the day's order still stands.
    expect(screen.queryByText(/feil|galt|straff|mistet/i)).not.toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
  });

  it('tells the child when today\'s boat cannot take a fish, and lets it swim on', () => {
    // A later trip carries one crate only: everything else has to swim on.
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const orderTrip = createTripPlan(4);
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize(orderTrip));

    const view = render(<WordFishing />);
    expect(view.container.querySelectorAll('.crate')).toHaveLength(1);

    // Wait for a fish whose word no crate on board wants today.
    let target = null;
    for (let guard = 0; guard < 400 && !target; guard += 1) {
      target = visibleFish(view).find((element) => crateForWord(orderTrip, tagWord(element)) === null) ?? null;
      if (!target) ticks(5);
    }
    expect(target).toBeTruthy();
    const word = tagWord(target);
    expect(crateForWord(orderTrip, word)).toBeNull();

    fireEvent.click(target.querySelector('.fish-art'));
    for (let step = 0; step < REEL_STEPS; step += 1) {
      fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));
    }
    fireEvent.click(view.container.querySelector('.crate'));

    const notice = view.container.querySelector('.notice-card');
    expect(notice).toBeTruthy();
    expect(notice.textContent).toContain(tripRequest(orderTrip));
    // The fish is back in the water, nothing is counted and nothing is stamped.
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    expect(screen.getByText(`0 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 3 i dag')).toBeInTheDocument();

    fireEvent.click(notice);
    expect(view.container.querySelector('.notice-card')).toBeNull();
  });

  it('lets the child slip a catch back into the water', () => {
    const view = render(<WordFishing />);
    catchWord(view);

    fireEvent.click(screen.getByRole('button', { name: /Slipp ut igjen/ }));

    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(screen.getByText(`0 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT} igjen.`)).toBeInTheDocument();
    for (const crate of view.container.querySelectorAll('.crate')) expect(crate).toBeDisabled();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
  });
});


describe('word-fishing rewards and the fishing book', () => {
  it('finishes a trip with confetti, a stamp and a new reef decoration', () => {
    const view = render(<WordFishing />);
    for (let caught = 0; caught < 4; caught += 1) catchAndSort(view);

    const done = view.container.querySelector('.trip-done');
    expect(done).toBeTruthy();
    expect(done.textContent).toContain('Tur 1 er ferdig!');
    expect(done.textContent).toContain('Du fant sjøstjernen på sjøbunnen!');
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    // The reef grew: the first reward is painted on the seabed.
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();
    expect(view.container.querySelector('.reward-coral')).toBeNull();

    fireEvent.click(within(done).getByRole('button', { name: /Ny tur/ }));

    expect(view.container.querySelector('.trip-done')).toBeNull();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(screen.getByText(`4 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT - 4} igjen.`)).toBeInTheDocument();
    // The decoration stays on the seabed while the next trip starts.
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();
  });

  it('never celebrates a trip a second time after a reload', () => {
    // A trip that was already full when the page was closed: the next catch is
    // ordinary play, not another finished trip.
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize({ ...createTripPlan(1), collected: 4 }));
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({ ...createJournal(), trips: 1, decorations: [0] }));

    const view = render(<WordFishing />);
    expect(screen.getByText('4 av 4 i dag')).toBeInTheDocument();
    expect(view.container.querySelector('.trip-done')).toBeNull();

    catchAndSort(view);

    expect(view.container.querySelector('.trip-done')).toBeNull();
    expect(screen.getByText(`1 av ${WORD_COUNT} ord i fangstboka – ${WORD_COUNT - 1} igjen.`)).toBeInTheDocument();
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();
    expect(view.container.querySelector('.reward-coral')).toBeNull();
  });

  it('shows the caught words, the stamps and the reef in the book', () => {
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      words: ['fisk', 'is', 'sol'],
      trips: 2,
      decorations: [0, 1],
    }));
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize({ ...createTripPlan(1), collected: 2 }));

    const view = render(<WordFishing />);
    expect(screen.getByText('2 av 4 i dag')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fangstboka/ }));

    const book = screen.getByRole('dialog', { name: 'Fangstboka' });
    expect(book).toBeInTheDocument();
    expect(book.textContent).toContain(`3 av ${WORD_COUNT} ord fanget`);
    // Caught words read as words, the rest wait as question marks.
    expect(within(book).getByText('fisk')).toBeInTheDocument();
    expect(within(book).getByText('is')).toBeInTheDocument();
    expect(within(book).getByText('sol')).toBeInTheDocument();
    expect(screen.getAllByText('?').length).toBeGreaterThan(WORD_COUNT - 3);
    // Two finished trips left two stamps and two decorations.
    expect(within(book).getByText('Tur 1')).toBeInTheDocument();
    expect(within(book).getByText('Tur 2')).toBeInTheDocument();
    expect(within(book).getByText('Sjøstjernen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lukk fangstboka' }));
    expect(screen.queryByRole('dialog', { name: 'Fangstboka' })).not.toBeInTheDocument();
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();
    expect(view.container.querySelector('.reward-coral')).toBeTruthy();
  });

  it('closes the book with Escape and keeps the sound switch working', () => {
    render(<WordFishing />);
    fireEvent.click(screen.getByRole('button', { name: /Fangstboka/ }));
    expect(screen.getByRole('dialog', { name: 'Fangstboka' })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Fangstboka' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Slå av lyd' }));
    expect(screen.getByRole('button', { name: 'Slå på lyd' })).toBeInTheDocument();
    expect(window.localStorage.getItem('wordFishing:muted')).toBe('1');
  });
});

