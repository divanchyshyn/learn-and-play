import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, cleanup, within } from '@testing-library/react';
import { TIMING, WordFishing, seaStage, stageHint } from './WordFishing.jsx';
import {
  DELIVER_TICKS, FISH_ON_SCREEN, TICK_MS, castBait, createSea, strikeFish,
} from './sea.js';
import { BITE_TICKS, BOAT_SPEED, BOAT_START_X, BOAT_TAP_OFFSET, CAST_TICKS, SLACK_TICKS } from './rig.js';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, createJournal, journalCodec, tripCodec,
} from './journal.js';
import { createTripPlan, tripRequest } from './trip.js';
import { sounds } from './sounds.js';
import {
  CATEGORY_CRATE_IDS, CRATE_TARGET, TARGET_WORD_COUNT, WORD_BANK, crateById, crateTarget, wordsInCrate,
} from './words.js';

// Math.random is pinned so the shoal, the cast and the bait are all
// deterministic: every fish enters from the right edge at the calmest speed and
// takes the first free lane, a cast leans left, and the first keepable fish in
// the shoal is the one that comes to the bait.
const SEA_WIDTH = 1000;

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.useFakeTimers();
  window.localStorage.clear();
  // jsdom has no layout: give every element a fixed geometry, so a tap on the
  // water maps to a percent of the sea box through getBoundingClientRect.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: SEA_WIDTH, bottom: 500, width: SEA_WIDTH, height: 500, x: 0, y: 0, toJSON: () => {},
  });
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

function tagWord(fishElement) {
  return fishElement.querySelector('.fish-tag').textContent;
}

function boatLeft(view) {
  return view.container.querySelector('.boat').style.left;
}

function hintText(view) {
  return view.container.querySelector('.dock-hint-stage').textContent;
}

// Tap the water where the boat should sail – the same tap a finger makes.
function tapWater(view, percent) {
  fireEvent.click(view.container.querySelector('.sea-surface'), { clientX: (percent / 100) * SEA_WIDTH });
}

function crank(view) {
  return view.container.querySelector('.reel-crank');
}

// Wait for the float to go under. The strike ring is the game's own signal, so
// the test follows that instead of counting ticks: the float flies out, a fish
// notices it, swims over, tastes it, and commits.
function waitForBite(view, guard = 400) {
  for (let step = 0; step < guard; step += 1) {
    if (view.container.querySelector('.strike-ring')) return true;
    ticks(1);
  }
  return false;
}

function castAndWaitForBite(view, guard = 400) {
  fireEvent.click(view.container.querySelector('.cast-button'));
  return waitForBite(view, guard);
}

// Pump the crank exactly as a child would: hold while the tension arc is not
// red, let go while it is. Returns when the fight is over either way.
function pump(view, guard = 400) {
  for (let step = 0; step < guard; step += 1) {
    const button = crank(view);
    if (!button) return true;
    const danger = view.container.querySelector('.reel[data-level="danger"]');
    fireEvent[danger ? 'pointerUp' : 'pointerDown'](button);
    ticks(1);
  }
  return false;
}

// Land one fish on deck and return the word it carries (shown on the catch
// card). It never sorts the catch: that is the reading task, and each test says
// for itself which crate it answers with.
function catchWord(view) {
  expect(castAndWaitForBite(view)).toBe(true);
  fireEvent.click(view.container.querySelector('.strike-ring'));
  expect(view.container.querySelector('.reel-crank')).toBeTruthy();
  expect(pump(view)).toBe(true);
  const card = view.container.querySelector('.catch-card');
  expect(card).toBeTruthy();
  return card.querySelector('.catch-word').textContent;
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

describe('word-fishing the opening screen', () => {
  it('opens with a living sea, an empty line and four crates', () => {
    const view = render(<WordFishing />);

    expect(screen.getByRole('group', { name: /Havet med ord-fisker/ })).toBeInTheDocument();
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);

    // Every swimming fish carries its own word on a tag, and no word repeats.
    const tags = fishElements(view).map(tagWord);
    expect(tags).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(tags).size).toBe(FISH_ON_SCREEN);
    // No fish is a control any more: the world is scenery, not a button.
    expect(view.container.querySelectorAll('.fish button')).toHaveLength(0);

    // The boat is there, the rod is there, and no line is in the water yet.
    expect(view.container.querySelector('.boat')).toBeTruthy();
    expect(view.container.querySelector('.rod-line')).toBeTruthy();
    expect(view.container.querySelector('.fishing-line')).toBeNull();
    expect(view.container.querySelector('.fishing-float')).toBeNull();
    expect(view.container.querySelector('.sea-surface')).toBeTruthy();
    expect(view.container.querySelector('.cast-button').textContent).toMatch(/Kast ut/);

    // Four crates, none of them an answer yet.
    const crates = [...view.container.querySelectorAll('.crate')];
    expect(crates).toHaveLength(4);
    for (const crate of crates) {
      expect(crate).toBeDisabled();
      expect(crate.getAttribute('aria-label')).toMatch(/^Kassen .+: 0 av \d+ ord$/);
    }

    expect(screen.getByText(tripRequest())).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
  });

  it('has no description paragraph: the hint line and the controls say what to do', () => {
    const view = render(<WordFishing />);
    // The long intro is gone, so the sea gets the space it needs.
    expect(view.container.querySelector('.fishing-intro')).toBeNull();
    expect(view.container.querySelectorAll('.game-header p')).toHaveLength(0);
    // One short hint, and the whole book's tally on the same line.
    expect(hintText(view)).toBe(stageHint(createSea(createTripPlan(1))));
    expect(hintText(view)).toMatch(/seile/i);
  });

  it('reads the stage out of the sea, the card and the finale', () => {
    const trip = createTripPlan(1);
    const sailing = createSea(trip);
    expect(seaStage(sailing)).toBe('sail');
    expect(stageHint(sailing)).toMatch(/seile/i);

    const bait = castBait(sailing);
    expect(seaStage(bait)).toBe('bait');
    expect(stageHint(bait)).toMatch(/flyr utover/i);

    const running = { ...bait, bait: { ...bait.bait, phase: 'waiting', ticks: 0 } };
    expect(stageHint(running)).toMatch(/vent/i);

    // A bite, a fight, a catch on deck, a finished trip and the finale each get
    // their own stage and their own one-line hint.
    const biting = { ...bait, bait: { ...bait.bait, phase: 'biting', fishId: 1 } };
    expect(seaStage(biting)).toBe('bite');
    expect(stageHint(biting)).toMatch(/napp/i);

    const hooked = strikeFish(biting);
    expect(seaStage(hooked)).toBe('fight');
    // A fresh hook is a slack line: the first thing to do is pull it tight…
    expect(stageHint(hooked)).toMatch(/stram/i);
    // …and then keep it in the band, easing before the red.
    const pulling = { ...hooked, fight: { ...hooked.fight, tension: 0.6 } };
    expect(stageHint(pulling)).toMatch(/sveiv/i);
    const straining = { ...hooked, fight: { ...hooked.fight, tension: 0.9 } };
    expect(stageHint(straining)).toMatch(/slipp/i);

    const aboard = { ...sailing, fishes: [{ id: 1, status: 'aboard' }] };
    expect(seaStage(aboard)).toBe('aboard');
    expect(stageHint(aboard)).toMatch(/hvilken kasse/i);
    expect(seaStage(aboard, { tripNumber: 1 })).toBe('card');
    expect(stageHint(aboard, { tripNumber: 1 })).toMatch(/ny tur/i);
    expect(seaStage(aboard, null, true)).toBe('finale');
  });
});

describe('word-fishing sailing the boat', () => {
  it('sails to the spot the child taps, one calm step at a time', () => {
    const view = render(<WordFishing />);
    expect(boatLeft(view)).toBe(`${BOAT_START_X}%`);

    tapWater(view, 70);

    // The spot is marked on the water, and the boat is on its way there.
    expect(view.container.querySelector('.sail-marker')).toBeTruthy();
    expect(view.container.querySelector('.sail-marker').style.left).toBe(`${70 - BOAT_TAP_OFFSET}%`);
    ticks(1);
    expect(boatLeft(view)).toBe(`${BOAT_START_X + BOAT_SPEED}%`);
    expect(view.container.querySelector('.boat.is-sailing')).toBeTruthy();

    // It arrives exactly on the spot and settles.
    for (let guard = 0; guard < 200 && view.container.querySelector('.sail-marker'); guard += 1) ticks(1);
    expect(boatLeft(view)).toBe(`${70 - BOAT_TAP_OFFSET}%`);
    expect(view.container.querySelector('.boat.is-sailing')).toBeNull();
  });

  it('keeps the rod glued to the boat and the line on the float', () => {
    const view = render(<WordFishing />);
    const layer = view.container.querySelector('.line-layer');
    const boat = view.container.querySelector('.boat');
    // The rod rides in a layer that sits exactly where the boat does, so the two
    // can never drift apart while the boat sails.
    expect(layer.style.left).toBe(boat.style.left);

    // Sail somewhere, then put the line out: the rod travels along, and the line
    // ends on the float at every tick on the way down.
    tapWater(view, 60);
    ticks(30);
    fireEvent.click(view.container.querySelector('.cast-button'));
    for (let tick = 0; tick <= CAST_TICKS; tick += 1) {
      const float = view.container.querySelector('.fishing-float');
      const d = view.container.querySelector('.fishing-line').getAttribute('d').split(' ');
      expect(Number(d.at(-2)) + parseFloat(layer.style.left)).toBeCloseTo(parseFloat(float.style.left), 3);
      expect(Number(d.at(-1))).toBeCloseTo(parseFloat(float.style.top), 3);
      expect(layer.style.left).toBe(view.container.querySelector('.boat').style.left);
      ticks(1);
    }
  });

  it('lets the arrow keys sail the boat for a child who cannot tap', () => {
    const view = render(<WordFishing />);
    fireEvent.keyDown(view.container.querySelector('.sea-surface'), { key: 'ArrowRight' });
    ticks(1);
    expect(boatLeft(view)).toBe(`${BOAT_START_X + BOAT_SPEED}%`);
  });

  it('answers a tap that cannot sail with a nudge instead of silence', () => {
    const view = render(<WordFishing />);
    fireEvent.click(view.container.querySelector('.cast-button'));

    // The line is out: tapping the water says why the boat holds still.
    tapWater(view, 70);
    const nudge = view.container.querySelector('.sea-nudge');
    expect(nudge).toBeTruthy();
    expect(nudge.textContent).toMatch(/dra opp/i);
    expect(view.container.querySelector('.sail-marker')).toBeNull();
    expect(boatLeft(view)).toBe(`${BOAT_START_X}%`);

    // The nudge is a moment, not a state.
    ticks(Math.ceil(TIMING.NUDGE_MS / TICK_MS) + 1);
    expect(view.container.querySelector('.sea-nudge')).toBeNull();

    // Pull the line up and the boat answers a tap again.
    fireEvent.click(screen.getByRole('button', { name: /Dra opp/ }));
    tapWater(view, 70);
    expect(view.container.querySelector('.sail-marker')).toBeTruthy();
  });
});


describe('word-fishing the bait and the bite', () => {
  it('throws the bait to a fresh spot, then waits for a fish to want it', () => {
    const view = render(<WordFishing />);
    fireEvent.click(view.container.querySelector('.cast-button'));

    // The cast itself: the float is in flight and the line reaches for it.
    expect(view.container.querySelector('.fishing-float').className).toContain('float-flying');
    expect(view.container.querySelector('.fishing-line')).toBeTruthy();

    // It lands and lies still, with the control turned into "pull it up".
    ticks(CAST_TICKS);
    expect(view.container.querySelector('.fishing-float').className).toContain('float-waiting');
    expect(screen.getByRole('button', { name: /Dra opp/ })).toBeInTheDocument();
    expect(view.container.querySelector('.fish-chasing')).toBeNull();

    // A fish notices it and swims over…
    let chasing = null;
    for (let guard = 0; guard < 60 && !chasing; guard += 1) {
      chasing = view.container.querySelector('.fish-chasing');
      if (!chasing) ticks(1);
    }
    expect(chasing).toBeTruthy();
    expect(chasing.querySelector('.chase-mark')).toBeTruthy();
    // …and its word can still be read while it comes over.
    expect(chasing.querySelector('.fish-tag')).toBeTruthy();

    // …tastes it…
    let nibbling = null;
    for (let guard = 0; guard < 60 && !nibbling; guard += 1) {
      nibbling = view.container.querySelector('.fish-nibbling');
      if (!nibbling) ticks(1);
    }
    expect(nibbling).toBeTruthy();
    expect(nibbling.querySelector('.fish-bubbles')).toBeTruthy();

    // …and then the float goes under: the one moment that matters.
    let biting = null;
    for (let guard = 0; guard < 60 && !biting; guard += 1) {
      biting = view.container.querySelector('.fish-biting');
      if (!biting) ticks(1);
    }
    expect(biting).toBeTruthy();
    expect(view.container.querySelector('.strike-ring')).toBeTruthy();
    expect(view.container.querySelector('.fishing-float').className).toContain('float-biting');
    expect(view.container.querySelector('.bite-mark')).toBeTruthy();
    // The one control in the action bar is now the strike.
    expect(within(view.container.querySelector('.action-bar')).getByRole('button', { name: /Napp/ })).toBeInTheDocument();
  });

  it('sets the hook only while the float is under', () => {
    const view = render(<WordFishing />);
    fireEvent.click(view.container.querySelector('.cast-button'));

    // A tap while the bait is still in flight is not a strike: the line is out,
    // but the float is not under yet.
    expect(view.container.querySelector('.strike-ring')).toBeNull();
    expect(view.container.querySelector('.fish-hooked')).toBeNull();
    ticks(CAST_TICKS);
    expect(view.container.querySelector('.fish-hooked')).toBeNull();

    expect(waitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
    expect(view.container.querySelector('.strike-ring')).toBeNull();
  });

  it('lets a bite nobody answered go: the bait stays and the fish swims on', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);

    ticks(BITE_TICKS);

    // The moment has passed: no catch, no hook, and the float is still there.
    expect(view.container.querySelector('.strike-ring')).toBeNull();
    expect(view.container.querySelector('.fish-hooked')).toBeNull();
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fishing-float')).toBeTruthy();
    // A splash to say the fish let go, and then it simply swims on.
    expect(view.container.querySelector('.fish-splash')).toBeTruthy();
    ticks(1);
    expect(view.container.querySelector('.fish-splash')).toBeNull();
    expect(view.container.querySelector('.fish-swim')).toBeTruthy();

    // Nothing is counted, nothing is scolded, and the day is untouched.
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();

    // Another fish takes an interest: a missed bite is never a dead end.
    expect(waitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
  });
});


describe('word-fishing the fight and the landing', () => {
  it('winds the fish in with the crank and shows the word on deck', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    // The fish is on the line: no tag, a crank instead, and a line in the water.
    const onLine = view.container.querySelector('.fish-hooked');
    expect(onLine).toBeTruthy();
    expect(onLine.querySelector('.fish-tag')).toBeNull();
    expect(view.container.querySelector('.tension-arc')).toBeTruthy();
    expect(view.container.querySelector('.fishing-line')).toBeTruthy();

    // Holding the crank answers the finger at once…
    fireEvent.pointerDown(crank(view));
    expect(view.container.querySelector('.reel.holding')).toBeTruthy();
    ticks(1);
    // …and tightens the line, which the arc paints.
    const offsetAfterOneTick = Number(view.container.querySelector('.arc-fill').getAttribute('stroke-dashoffset'));
    ticks(3);
    expect(Number(view.container.querySelector('.arc-fill').getAttribute('stroke-dashoffset')))
      .toBeLessThan(offsetAfterOneTick);
    fireEvent.pointerUp(crank(view));

    // A steady pump always lands the fish.
    expect(pump(view)).toBe(true);

    const card = view.container.querySelector('.catch-card');
    expect(card).toBeTruthy();
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
    expect(view.container.querySelector('.reel-crank')).toBeNull();
    // The word is there to be read, not tapped: plain text, no control – and
    // nothing anywhere in the game reads it aloud.
    expect(card.querySelector('.catch-word').tagName).toBe('P');
    expect(card.querySelector('button.catch-word')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hør ordet/ })).toBeNull();
    // The crates can be answered now.
    expect(crateElement(view, categoryOf(card.querySelector('.catch-word').textContent))).toBeEnabled();
  });

  it('lets the fish throw the hook if the child never winds', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.reel[data-level="slack"]')).toBeTruthy();
    expect(view.container.querySelector('.slack-warning').textContent).toBe('Stram!');

    // Nothing is touched at all: the line is not pulling, so the fish works the
    // hook out – and it is gone.
    ticks(SLACK_TICKS);
    expect(view.container.querySelector('.reel-crank')).toBeNull();
    expect(view.container.querySelector('.fish-splash')).toBeTruthy();
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();

    // Nothing is counted, nothing is scolded, nothing is lost.
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();

    // And the line can go out again straight away.
    expect(view.container.querySelector('.cast-button')).toBeTruthy();
    expect(castAndWaitForBite(view)).toBe(true);
  });

  it('warns before the line breaks, and lets the fish go if it is held too long', () => {
    const snapSound = vi.spyOn(sounds, 'snap');
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    fireEvent.pointerDown(crank(view));
    let sawWarning = false;
    for (let step = 0; step < 60 && view.container.querySelector('.reel-crank'); step += 1) {
      ticks(1);
      sawWarning = sawWarning || Boolean(view.container.querySelector('.reel-warning'));
    }

    // The arc turned red, the warning showed, and then the line gave way.
    expect(sawWarning).toBe(true);
    expect(view.container.querySelector('.reel-crank')).toBeNull();
    expect(view.container.querySelector('.fish-splash')).toBeTruthy();
    expect(snapSound).toHaveBeenCalled();
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    // Nothing is counted, nothing is scolded, nothing is lost.
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(screen.getByText('0 av 4 i dag')).toBeInTheDocument();
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();

    // The line can be cast again at once.
    expect(view.container.querySelector('.cast-button')).toBeTruthy();
    expect(castAndWaitForBite(view)).toBe(true);
  });

  it('answers the finger and the keyboard on the crank, and lets go either way', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    const button = crank(view);
    const holding = () => Boolean(view.container.querySelector('.reel.holding'));

    // A press starts winding…
    fireEvent.pointerDown(button);
    expect(holding()).toBe(true);
    // …and a finger lifted anywhere releases it again.
    fireEvent.pointerUp(window);
    expect(holding()).toBe(false);

    // A keyboard or switch user winds with Space, and lets go on release.
    fireEvent.keyDown(button, { key: ' ' });
    expect(holding()).toBe(true);
    fireEvent.keyUp(button, { key: ' ' });
    expect(holding()).toBe(false);

    // Leaving the button with a finger still down is a release too.
    fireEvent.pointerDown(button);
    fireEvent.pointerLeave(button);
    expect(holding()).toBe(false);
  });

  it('holds the boat still for the whole fight', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.reel-crank')).toBeTruthy();

    tapWater(view, 80);
    expect(view.container.querySelector('.sea-nudge')).toBeTruthy();
    expect(view.container.querySelector('.sail-marker')).toBeNull();
    expect(boatLeft(view)).toBe(`${BOAT_START_X}%`);

    // The fight can still be won: nothing was lost to the stray tap.
    expect(pump(view)).toBe(true);
    expect(view.container.querySelector('.catch-card')).toBeTruthy();
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
    for (let guard = 0; guard < 60; guard += 1) {
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

  it('keeps the shoal scenery while a catch waits on deck', () => {
    const view = render(<WordFishing />);
    const word = catchWord(view);
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();

    // The catch card is what the child acts on now: the water is not a control,
    // the float is gone, and no fish anywhere is tappable.
    expect(view.container.querySelector('.fish button')).toBeNull();
    expect(view.container.querySelector('.strike-ring')).toBeNull();
    expect(view.container.querySelector('.action-bar')).toBeNull();
    tapWater(view, 70);
    expect(view.container.querySelector('.sea-nudge')).toBeTruthy();
    expect(boatLeft(view)).toBe(`${BOAT_START_X}%`);
    expect(view.container.querySelector('.catch-word').textContent).toContain(word);

    // Once the catch is in its crate, the boat fishes again.
    fireEvent.click(crateElement(view, categoryOf(word)));
    ticks(DELIVER_TICKS + 2);
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
    expect(view.container.querySelector('.cast-button')).toBeTruthy();
    expect(castAndWaitForBite(view)).toBe(true);
    expect(view.container.querySelector('.fish-biting')).toBeTruthy();
  });

  it('lets a fish that belongs in another crate swim on, with nothing lost', () => {
    const view = render(<WordFishing />);
    const word = catchWord(view);
    const rightCrate = categoryOf(word);
    const wrongCrate = CATEGORY_CRATE_IDS.find((crateId) => crateId !== rightCrate);

    fireEvent.click(crateElement(view, wrongCrate));

    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();
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
});


describe('word-fishing rewards and the fishing book', () => {
  it('says what to do next, and marks the crates live only when a catch waits', () => {
    const view = render(<WordFishing />);
    expect(hintText(view)).toMatch(/seile/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();

    fireEvent.click(view.container.querySelector('.cast-button'));
    ticks(CAST_TICKS);
    expect(hintText(view)).toMatch(/vent/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();

    expect(waitForBite(view)).toBe(true);
    expect(hintText(view)).toMatch(/napp/i);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    // A freshly hooked fish has a slack line: the hint asks for a pull first.
    expect(hintText(view)).toMatch(/stram/i);

    // Wind a few turns and the line is in the band, where the hint simply says
    // to keep going.
    fireEvent.pointerDown(crank(view));
    ticks(4);
    expect(hintText(view)).toMatch(/sveiv/i);
    fireEvent.pointerUp(crank(view));

    expect(pump(view)).toBe(true);
    const word = view.container.querySelector('.catch-word').textContent;
    expect(hintText(view)).toMatch(/hvilken kasse/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeTruthy();
    for (const crate of view.container.querySelectorAll('.crate')) expect(crate).toBeEnabled();

    // Once the catch is in, the dock goes quiet and the hint talks about sailing.
    fireEvent.click(crateElement(view, categoryOf(word)));
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();
    expect(hintText(view)).toMatch(/seile/i);
  });

  it('finishes a trip with confetti, a stamp and a new reef decoration', () => {
    const view = render(<WordFishing />);
    for (let caught = 0; caught < 4; caught += 1) catchAndSort(view);

    const done = view.container.querySelector('.trip-done');
    expect(done).toBeTruthy();
    expect(done.textContent).toContain('Tur 1 er ferdig!');
    expect(done.textContent).toContain('Du fant sjøstjernen på sjøbunnen!');
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    // The dock says why nothing can be answered until the next trip starts.
    expect(hintText(view)).toMatch(/ny tur/i);
    // Nobody can fish while the card is up, so nothing may look tappable.
    expect(view.container.querySelectorAll('.fish button')).toHaveLength(0);
    expect(view.container.querySelector('.action-bar')).toBeNull();
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
});


describe('word-fishing saved trips', () => {
  it('reads an old one-crate order trip back as the free-sorting trip that replaced it', () => {
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize({
      number: 4,
      kind: 'order',
      crates: ['nature'],
      goal: 3,
      collected: 2,
      orderCrateId: 'nature',
    }));

    const view = render(<WordFishing />);

    // The boat keeps its number and its two catches, but carries all four
    // crates: badge, order card and the next «Ny tur» can never disagree.
    expect(screen.getByText('Tur 4')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.crate')).toHaveLength(4);
    expect(screen.getByText('2 av 4 i dag')).toBeInTheDocument();
    expect(screen.getByText(tripRequest())).toBeInTheDocument();
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);
    expect(view.container.querySelector('.trip-done')).toBeNull();

    // A catch from any category sorts as usual.
    catchAndSort(view);
    expect(screen.getByText('3 av 4 i dag')).toBeInTheDocument();
  });
});


describe('word-fishing the very last word', () => {
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
    // The game is over: no new line can be cast, and nothing looks tappable.
    expect(view.container.querySelectorAll('.fish button')).toHaveLength(0);
    expect(view.container.querySelector('.action-bar')).toBeNull();

    fireEvent.click(within(finale).getByRole('button', { name: /Start på nytt/ }));

    expect(view.container.querySelector('.finale-done')).toBeNull();
    expect(screen.getByText('Tur 1')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.crate')).toHaveLength(4);
    expect(crateProgress(view, CATEGORY_CRATE_IDS[0])).toBe(`0 av ${CRATE_TARGET} ord`);
    expect(view.container.querySelector('.reward-starfish')).toBeNull();
  });
});

describe('word-fishing the fishing book dialog', () => {
  it('opens the book with every page and closes it with Escape', () => {
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({
      ...createJournal(),
      words: ['fisk', 'is', 'sol'],
      trips: 2,
      decorations: [0, 1],
    }));
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize({ ...createTripPlan(1), collected: 2 }));

    render(<WordFishing />);
    expect(screen.getByText('2 av 4 i dag')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fangstboka/ }));

    const book = screen.getByRole('dialog', { name: 'Fangstboka' });
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

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Fangstboka' })).not.toBeInTheDocument();
  });

  it('keeps the sound switch working', () => {
    render(<WordFishing />);
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

