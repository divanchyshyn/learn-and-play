import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, cleanup, within } from '@testing-library/react';
import { TIMING, WordFishing } from './WordFishing.jsx';
import { DELIVER_TICKS, FISH_ON_SCREEN, GRIP_TICKS, REEL_STEPS, TICK_MS } from './sea.js';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, createJournal, journalCodec, tripCodec,
} from './journal.js';
import { createTripPlan, crateForWord, tripRequest } from './trip.js';
import { sounds } from './sounds.js';
import {
  CATEGORY_CRATE_IDS, CRATE_TARGET, TARGET_WORD_COUNT, WORD_BANK, crateById, crateTarget, wordsInCrate,
} from './words.js';

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
  // A crate is labelled with what to do while a catch waits on deck, and with
  // its progress the rest of the time – both start from the crate's own name.
  const label = crateById(crateId).label;
  return [...view.container.querySelectorAll('.crate')]
    .find((element) => (element.getAttribute('aria-label') ?? '').includes(label));
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

// How many words fill one crate, straight from the target, so changing the
// pool behind it never means rewriting a rendered test.
function crateGoal(crateId) {
  return crateTarget(crateId);
}

// Catch one word and put it in the crate it belongs in.
function catchAndSort(view) {
  const word = catchWord(view);
  fireEvent.click(crateElement(view, categoryOf(word)));
  ticks(DELIVER_TICKS + 2);
  return word;
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

  it('sets every crate goal at ten even though its pool holds twenty', () => {
    const view = render(<WordFishing />);
    for (const crateId of CATEGORY_CRATE_IDS) {
      expect(crateProgress(view, crateId)).toBe(`0 av ${CRATE_TARGET} ord`);
      expect(wordsInCrate(crateId).length).toBeGreaterThan(CRATE_TARGET);
    }
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
    // The word is there to be read, not tapped: it is plain text, with no
    // control – and nothing anywhere in the game reads it aloud.
    expect(card.querySelector('.catch-word').tagName).toBe('P');
    expect(card.querySelector('button.catch-word')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hør ordet/ })).toBeNull();
    // The crates can be answered now.
    expect(crateElement(view, categoryOf(word))).toBeEnabled();
    expect(TIMING.REEL_STEPS).toBe(REEL_STEPS);
  });

  it('never pronounces a word: catching, sorting and slipping all stay silent', () => {
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

    // The catch card shows the word and offers no way to hear it.
    expect(view.container.querySelector('.catch-word').textContent).toContain(word);
    fireEvent.click(view.container.querySelector('.catch-word'));
    expect(spoken).toEqual([]);

    // A catch that belongs in another crate is simply answered with silence.
    const wrongCrate = CATEGORY_CRATE_IDS.find((crateId) => crateId !== categoryOf(word));
    fireEvent.click(crateElement(view, wrongCrate));
    expect(spoken).toEqual([]);

    // Sorting the next catch correctly is silent too.
    catchAndSort(view);
    expect(spoken).toEqual([]);
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
    expect(screen.getByText(`1 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 1} igjen.`)).toBeInTheDocument();

    // The caught word is really in the book.
    fireEvent.click(screen.getByRole('button', { name: /Fangstboka/ }));
    const book = screen.getByRole('dialog', { name: 'Fangstboka' });
    expect(within(book).getByText(word)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lukk fangstboka' }));

    ticks(DELIVER_TICKS + 2);
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);
  });

  it('never lets a word that is already in the book swim again', () => {
    const known = WORD_BANK[0].word;
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      ...createJournal(),
      words: [known],
    }));

    const view = render(<WordFishing />);

    expect(screen.getByText(`1 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 1} igjen.`)).toBeInTheDocument();
    // Several shoals come and go; the caught word is never among them.
    for (let guard = 0; guard < 80; guard += 1) {
      const tags = [...view.container.querySelectorAll('.fish-tag')].map((tag) => tag.textContent);
      expect(tags).not.toContain(known);
      ticks(10);
    }

    // A word the book has not seen still fills its crate and joins the book.
    const word = catchAndSort(view);
    expect(word).not.toBe(known);
    const crateId = categoryOf(word);
    const crateCount = crateId === categoryOf(known) ? 2 : 1;
    expect(crateProgress(view, crateId)).toBe(`${crateCount} av ${crateGoal(crateId)} ord`);
    expect(screen.getByText(`2 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 2} igjen.`)).toBeInTheDocument();
  });

  it('makes the shoal inert while a catch waits on deck – nothing looks tappable', () => {
    const hookSound = vi.spyOn(sounds, 'hook');
    const view = render(<WordFishing />);
    const word = catchWord(view);
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
    hookSound.mockClear();

    // The fish that has landed is scenery now: the catch card and the crates are
    // what the child acts on, so it is not a button (nor is anything else).
    expect(view.container.querySelector('.fish-aboard button')).toBeNull();
    expect(view.container.querySelector('.fish-aboard .fish-art').tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: /feste kroken/ })).toBeNull();

    // Tapping a swimming fish is therefore not a move at all: no sound, no state.
    let swimming = null;
    for (let guard = 0; guard < 400 && !swimming; guard += 1) {
      swimming = visibleFish(view).find((element) => !element.className.includes('aboard'));
      if (!swimming) ticks(5);
    }
    expect(swimming).toBeTruthy();
    fireEvent.click(swimming.querySelector('.fish-art'));
    expect(hookSound).not.toHaveBeenCalled();
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
    expect(view.container.querySelector('.catch-card')).toBeTruthy();
    expect(view.container.querySelector('.catch-word').textContent).toContain(word);

    // Once the catch is in its crate, the shoal answers again.
    fireEvent.click(crateElement(view, categoryOf(word)));
    ticks(DELIVER_TICKS + 2);
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    fireEvent.click(firstVisibleFish(view).querySelector('.fish-art'));
    expect(hookSound).toHaveBeenCalled();
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
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
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
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
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 3 i dag')).toBeInTheDocument();

    fireEvent.click(notice);
    expect(view.container.querySelector('.notice-card')).toBeNull();
  });

  it('lets a fish pull itself free when the child stops reeling', () => {
    const escapeSound = vi.spyOn(sounds, 'escape');
    const view = render(<WordFishing />);
    const fish = firstVisibleFish(view);
    const word = tagWord(fish);

    fireEvent.click(fish.querySelector('.fish-art')); // the hook bites
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();

    // The line is left alone for the whole grip window.
    ticks(GRIP_TICKS);

    // A real possibility, and a real splash to go with it.
    expect(view.container.querySelector('.fish-hooked')).toBeNull();
    expect(view.container.querySelector('.fish-splash')).toBeTruthy();
    expect(escapeSound).toHaveBeenCalled();
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    // Nothing is counted, nothing is scolded, nothing is lost.
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();

    // The splash is a moment; then the fish simply swims on…
    ticks(1);
    expect(view.container.querySelector('.fish-splash')).toBeNull();

    // …and can be hooked again straight away.
    const again = [...view.container.querySelectorAll('.fish')]
      .find((element) => element.querySelector('.fish-tag')?.textContent === word);
    expect(again).toBeTruthy();
    fireEvent.click(again.querySelector('.fish-art'));
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
  });

  it('keeps a fish on the line for a child who keeps tapping', () => {
    const view = render(<WordFishing />);
    const fish = firstVisibleFish(view);
    fireEvent.click(fish.querySelector('.fish-art'));

    // Tapping along, with a pause between turns, always lands the fish.
    for (let step = 1; step <= REEL_STEPS; step += 1) {
      ticks(Math.floor(GRIP_TICKS / 2));
      fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));
      if (step < REEL_STEPS) expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
    }

    expect(view.container.querySelector('.catch-card')).toBeTruthy();
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
  });

  it('shows the line losing its hold before the fish gets away', () => {
    const view = render(<WordFishing />);
    const fish = firstVisibleFish(view);
    fireEvent.click(fish.querySelector('.fish-art'));

    // Most of the grip spent: the dots flare and the line sags.
    ticks(GRIP_TICKS - 4);

    expect(view.container.querySelector('.reel-meter.slack')).toBeTruthy();
    expect(view.container.querySelector('.fishing-line.taut')).toBeNull();
    expect(view.container.querySelector('.fishing-line')).toBeTruthy();
  });

  it('shows the catch landing in its crate, then lets the pop fade', () => {
    const view = render(<WordFishing />);
    const word = catchAndSort(view);

    // The fish visibly lands in the crate it was put in, with its +1.
    const crateId = categoryOf(word);
    const crate = crateElement(view, crateId);
    expect(crate.className).toContain('landed');
    const landing = crate.querySelector('.crate-landing');
    expect(landing).toBeTruthy();
    expect(landing.querySelector('.crate-gain').textContent).toBe('+1');
    expect(crateProgress(view, crateId)).toBe(`1 av ${crateGoal(crateId)} ord`);

    // The pop is a moment, not a state.
    ticks(Math.ceil(TIMING.LANDED_MS / TICK_MS) + 1);
    expect(view.container.querySelector('.crate-landing')).toBeNull();
    expect(view.container.querySelector('.crate.landed')).toBeNull();
  });

  it('marks a brand-new word with a +1 on its crate', () => {
    const view = render(<WordFishing />);
    const word = catchWord(view);
    const crateId = categoryOf(word);

    fireEvent.click(crateElement(view, crateId));

    const crate = crateElement(view, crateId);
    expect(crate.querySelector('.crate-landing .crate-gain').textContent).toBe('+1');
    expect(crateProgress(view, crateId)).toBe(`1 av ${crateGoal(crateId)} ord`);
  });

  it('says what the dock is waiting for, and marks the crates live only then', () => {
    const view = render(<WordFishing />);

    const hint = () => view.container.querySelector('.dock-hint').textContent;
    expect(hint()).toMatch(/fang en fisk/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();

    const fish = firstVisibleFish(view);
    const word = tagWord(fish);
    fireEvent.click(fish.querySelector('.fish-art'));
    expect(hint()).toMatch(/sveiv/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();

    for (let step = 0; step < REEL_STEPS; step += 1) {
      fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));
    }
    expect(hint()).toMatch(/hvilken kasse/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeTruthy();
    for (const crate of view.container.querySelectorAll('.crate')) expect(crate).toBeEnabled();

    // Once the catch is in, the dock goes quiet again.
    fireEvent.click(crateElement(view, categoryOf(word)));
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();
    expect(hint()).toMatch(/fang en fisk/i);
  });

  it('lets the child slip a catch back into the water', () => {
    const view = render(<WordFishing />);
    catchWord(view);

    fireEvent.click(screen.getByRole('button', { name: /Slipp ut igjen/ }));

    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
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
    // The dock says why nothing can be answered until the next trip starts.
    expect(view.container.querySelector('.dock-hint').textContent).toMatch(/ny tur/i);
    // Nobody can be hooked while the card is up, so nothing may look tappable.
    expect(view.container.querySelectorAll('.fish button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /feste kroken|Sveiv inn/ })).toBeNull();
    // The reef grew: the first reward is painted on the seabed.
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();
    expect(view.container.querySelector('.reward-coral')).toBeNull();

    fireEvent.click(within(done).getByRole('button', { name: /Ny tur/ }));

    expect(view.container.querySelector('.trip-done')).toBeNull();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(screen.getByText(`4 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 4} igjen.`)).toBeInTheDocument();
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
    expect(screen.getByText(`1 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 1} igjen.`)).toBeInTheDocument();
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();
    expect(view.container.querySelector('.reward-coral')).toBeNull();
  });

  it('ends an order trip once its crate reaches its target, instead of forcing the round', () => {
    const naturePool = wordsInCrate('nature').map((entry) => entry.word);
    const lastNature = naturePool[CRATE_TARGET - 1];
    expect(naturePool.length).toBeGreaterThan(CRATE_TARGET);
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      ...createJournal(),
      words: naturePool.slice(0, CRATE_TARGET - 1),
    }));
    // Trip 4 is the single-crate trip; 0.5 picks Nature.
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize(createTripPlan(4, () => 0.5)));

    const view = render(<WordFishing />);
    expect(view.container.querySelectorAll('.crate')).toHaveLength(1);
    expect(screen.getByText('0 av 3 i dag')).toBeInTheDocument();

    // An ordered trip always keeps a fish worth catching in the water.
    let target = null;
    for (let guard = 0; guard < 400 && !target; guard += 1) {
      target = visibleFish(view).find((element) => tagWord(element) === lastNature) ?? null;
      if (!target) ticks(5);
    }
    expect(target).toBeTruthy();
    fireEvent.click(target.querySelector('.fish-art'));
    for (let step = 0; step < REEL_STEPS; step += 1) {
      fireEvent.click(view.container.querySelector('.fish-hooked .fish-art'));
    }
    fireEvent.click(crateElement(view, 'nature'));

    // The crate filled, so the trip is over even though the goal was 3.
    const done = view.container.querySelector('.trip-done');
    expect(done).toBeTruthy();
    expect(done.textContent).toContain('Kassen Natur er full');
    expect(done.textContent).toContain('Tur 1 er ferdig!');
    expect(screen.getByText('1 av 3 i dag')).toBeInTheDocument();
    expect(screen.getByText(`${CRATE_TARGET} av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - CRATE_TARGET} igjen.`)).toBeInTheDocument();
    // The filled crate earns its reward like any finished trip.
    expect(view.container.querySelector('.reward-starfish')).toBeTruthy();

    // The next trip follows the cycle with all crates open again.
    fireEvent.click(within(done).getByRole('button', { name: /Ny tur/ }));
    expect(view.container.querySelectorAll('.crate')).toHaveLength(4);
    expect(screen.getByText(tripRequest(createTripPlan(2)))).toBeInTheDocument();
    // The ten uncaught words the finished pool still holds stay out of the
    // water: the rest of the run can only meet the other categories.
    expect(categoryOf(catchAndSort(view))).not.toBe('nature');
  });

  it('re-deals a workless saved trip as the next trip, on the cycle', () => {
    const natureWords = wordsInCrate('nature').map((entry) => entry.word);
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      ...createJournal(),
      words: natureWords,
      trips: 4,
    }));
    // Trip 4 is the single-crate trip, already dealt to Nature and now full:
    // the save holds a boat with nothing left to fish for.
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize(createTripPlan(4, () => 0.5)));

    const view = render(<WordFishing />);

    // On load a fresh trip is dealt from the journal, so the boat is number 5
    // and the cycle moves on to free sorting instead of repeating the order
    // trip – badge, card and the next «Ny tur» can never disagree.
    expect(screen.getByText('Tur 5')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.crate')).toHaveLength(4);
    expect(screen.getByText(tripRequest(createTripPlan(5)))).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);
    expect(view.container.querySelector('.trip-done')).toBeNull();

    // The sea is alive, and the words it deals avoid the full Nature crate.
    const word = catchAndSort(view);
    expect(categoryOf(word)).not.toBe('nature');
  });

  it('celebrates the very last word with confetti and a fresh start', () => {
    // Three crates are at their target; the home crate only has nine of its
    // ten, so the book is one word short. Every word still swimming belongs to
    // that one open crate, and any of them closes the book.
    const openCrateId = CATEGORY_CRATE_IDS[CATEGORY_CRATE_IDS.length - 1];
    const words = [];
    for (const crateId of CATEGORY_CRATE_IDS) {
      const pool = wordsInCrate(crateId).map((entry) => entry.word);
      words.push(...pool.slice(0, crateId === openCrateId ? CRATE_TARGET - 1 : CRATE_TARGET));
    }
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      ...createJournal(),
      words,
      trips: 2,
      decorations: [0, 1],
    }));

    const view = render(<WordFishing />);
    expect(view.container.querySelector('.finale-done')).toBeNull();
    expect(screen.getByText(`${TARGET_WORD_COUNT - 1} av ${TARGET_WORD_COUNT} ord i fangstboka – 1 igjen.`)).toBeInTheDocument();

    expect(categoryOf(catchAndSort(view))).toBe(openCrateId);

    const finale = view.container.querySelector('.finale-done');
    expect(finale).toBeTruthy();
    expect(finale.textContent).toContain('Gratulerer!');
    expect(finale.textContent).toContain(ALL_WORDS_MESSAGE);
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    // The game is over: nothing in the shoal can be hooked any more.
    expect(view.container.querySelectorAll('.fish button')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Ny tur/ })).toBeDisabled();

    // Starting over really starts over: an empty book and a living sea again.
    fireEvent.click(within(finale).getByRole('button', { name: /Start på nytt/ }));
    expect(view.container.querySelector('.finale-done')).toBeNull();
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    ticks(DELIVER_TICKS + 2);
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);
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
    expect(book.textContent).toContain(`3 av ${TARGET_WORD_COUNT} ord fanget`);
    // Caught words read as words, the rest wait as question marks – three
    // found slots and one "?" for every word left of the forty-word goal.
    expect(within(book).getByText('fisk')).toBeInTheDocument();
    expect(within(book).getByText('is')).toBeInTheDocument();
    expect(within(book).getByText('sol')).toBeInTheDocument();
    expect(book.querySelectorAll('.word-slots .found')).toHaveLength(3);
    expect(book.querySelectorAll('.word-slots .missing')).toHaveLength(TARGET_WORD_COUNT - 3);
    // Every category page counts against its ten-word target.
    expect(within(book).getAllByText(`1 av ${CRATE_TARGET}`)).toHaveLength(3);
    expect(within(book).getAllByText(`0 av ${CRATE_TARGET}`)).toHaveLength(1);
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

  it('behaves like the modal dialog it declares itself to be', () => {
    render(<WordFishing />);
    const opener = screen.getByRole('button', { name: /Fangstboka/ });
    opener.focus();
    fireEvent.click(opener);

    // The focus moves into the book…
    const book = screen.getByRole('dialog', { name: 'Fangstboka' });
    expect(document.activeElement).toBe(book);

    // …Tab stays inside it instead of wandering off behind the overlay…
    const close = screen.getByRole('button', { name: 'Lukk fangstboka' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);

    // …and closing it hands the focus back to the button that opened it.
    fireEvent.click(close);
    expect(screen.queryByRole('dialog', { name: 'Fangstboka' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });
});

