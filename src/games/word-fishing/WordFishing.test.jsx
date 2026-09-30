import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, cleanup, within } from '@testing-library/react';
import { TIMING, WordFishing, seaStage, stageHint } from './WordFishing.jsx';
import {
  DELIVER_TICKS, FISH_ON_SCREEN, LANES, OFFER_TICKS, TICK_MS, castBait, createSea, strikeFish,
} from './sea.js';
import { BITE_TICKS, BOAT_SPEED, BOAT_START_X, BOAT_TAP_OFFSET, CAST_TICKS, RIG_DX, RIG_Y } from './rig.js';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, createJournal, journalCodec, tripCodec,
} from './journal.js';
import { REEF_REWARDS, createTripPlan } from './trip.js';
import { sounds } from './sounds.js';
import {
  CATEGORY_CRATE_IDS, CRATE_TARGET, TARGET_WORD_COUNT, WORD_BANK, crateById, crateTarget, wordsInCrate,
} from './words.js';

// Math.random is pinned so the shoal, the cast and the bait are all
// deterministic: every fish enters from the right edge at the calmest speed and
// takes the first free lane, a cast leans left, and the first keepable fish in
// the shoal is the one that comes to the bait.
const SEA_WIDTH = 1000;

// The ten treasures lead with the wreck (see REEF_REWARDS in trip.js).
const FIRST_FIND = REEF_REWARDS[0];
const SECOND_FIND = REEF_REWARDS[1];

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

// The trip counter painted on the boat's hull: the one piece of the old order
// card that is still on screen.
function boatProgress(view) {
  return view.container.querySelector('.boat-trip-progress').textContent;
}

function hintText(view) {
  return view.container.querySelector('.dock-hint-stage').textContent;
}

// Tap the water where the boat should sail – the same tap a finger makes.
function tapWater(view, percent) {
  fireEvent.click(view.container.querySelector('.sea-surface'), { clientX: (percent / 100) * SEA_WIDTH });
}

function spool(view) {
  return view.container.querySelector('.reel-spool');
}

// The spool's centre as the mounted component sees it: jsdom has no layout, so
// every element shares the fixed geometry mocked above and the reel reads a
// finger's angle around the middle of the sea box.
const REEL_CENTRE = { x: SEA_WIDTH / 2, y: 250 };
const REEL_RADIUS = 120;

function reelPoint(degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    clientX: REEL_CENTRE.x + Math.cos(radians) * REEL_RADIUS,
    clientY: REEL_CENTRE.y + Math.sin(radians) * REEL_RADIUS,
  };
}

// Turn the spool the way a finger does: press it and draw a circle in quarter
// turns. The reel answers every step at once; the sea tick then winds.
function spinReel(view, degrees = 360) {
  const button = spool(view);
  fireEvent.pointerDown(button, reelPoint(0));
  for (let turned = 90; turned <= degrees; turned += 90) {
    fireEvent.pointerMove(button, reelPoint(turned));
  }
  fireEvent.pointerUp(button);
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

// The bait only reaches a fish already swimming nearby (see BAIT_REACH in
// rig.js), so a cast at the boat's home spot looks at empty water. Sailing to a
// fish is what the game asks the child to do, and what these tests do too: tap
// the water a little to the left of a fish that is on screen – the float hangs
// off the rod's own column, and the fish keeps swimming while the boat arrives –
// and wait for the boat to settle on the spot.
function sailNearFish(view, guard = 200) {
  const swimmers = fishElements(view).filter((element) => element.className.includes('fish-swim'));
  if (swimmers.length === 0) return;
  const onScreen = swimmers.filter((element) => {
    const x = parseFloat(element.style.left);
    return x > 10 && x < 90;
  });
  const aim = (onScreen.length > 0 ? onScreen : swimmers)
    .reduce((best, element) => (parseFloat(element.style.left) < parseFloat(best.style.left) ? element : best));
  tapWater(view, parseFloat(aim.style.left) - 8);
  for (let step = 0; step < guard && view.container.querySelector('.sail-marker'); step += 1) ticks(1);
}

function castAndWaitForBite(view, guard = 400) {
  sailNearFish(view);
  fireEvent.click(view.container.querySelector('.cast-button'));
  return waitForBite(view, guard);
}

// Wind the reel exactly as a child would: a full turn of the spool every tick
// until the fish is on deck. Returns when the fight is over either way.
function pump(view, guard = 400) {
  for (let step = 0; step < guard; step += 1) {
    if (!spool(view)) return true;
    spinReel(view, 360);
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
  expect(view.container.querySelector('.reel-spool')).toBeTruthy();
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

    // The one control sits in the crates' own row, between the second crate and the
    // third: the water above it holds art only, so no control can ever stand over a
    // find, and the row the crates already needed is what carries the control.
    const actionBar = view.container.querySelector('.action-bar');
    expect(actionBar).toBeTruthy();
    expect(view.container.querySelector('.sea').contains(actionBar)).toBe(false);
    expect(actionBar.parentElement).toBe(view.container.querySelector('.crate-dock'));
    const cratesInRow = view.container.querySelectorAll('.crate-dock .crate');
    expect(actionBar.previousElementSibling).toBe(cratesInRow[1]);
    expect(actionBar.nextElementSibling).toBe(cratesInRow[2]);

    // Four crates, none of them an answer yet.
    const crates = [...view.container.querySelectorAll('.crate')];
    expect(crates).toHaveLength(4);
    for (const crate of crates) {
      expect(crate).toBeDisabled();
      expect(crate.getAttribute('aria-label')).toMatch(/^Kassen .+: 0 av \d+ ord$/);
    }

    // The order card is gone: the boat itself carries the day's counter.
    expect(view.container.querySelector('.trip-order')).toBeNull();
    expect(boatProgress(view)).toBe('0 av 4');
  });

  it('mounts the whole stage: every sprite a photograph, none of them stretched', () => {
    const view = render(<WordFishing />);

    expect(view.container.querySelector('.sea-bed')).toBeTruthy();
    expect(view.container.querySelector('.sea-floor .reef-rock img')).toBeTruthy();
    expect(view.container.querySelector('.sea-floor .reef-anchor img')).toBeTruthy();
    expect(view.container.querySelector('.sea-waves')).toBeTruthy();
    expect(view.container.querySelector('.sea-glint')).toBeTruthy();
    // The glint shares the strip's layer, so what paints it over the strip is the
    // order the stage mounts: the light of a surface belongs on top of the surface.
    expect(view.container.querySelector('.sea-glint')
      .compareDocumentPosition(view.container.querySelector('.sea-waves')) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy();
    expect(view.container.querySelector('.sea-snow .snow-flake')).toBeTruthy();

    // Every photograph the scene mounts comes from the game's own asset folder,
    // and every one of them is decorative: a sprite is the world, never a control
    // and never a label, so it carries no alt text and no title.
    const sprites = [...view.container.querySelectorAll('img')];
    expect(sprites.length).toBeGreaterThanOrEqual(6);
    for (const sprite of sprites) {
      expect(sprite.getAttribute('src'), 'a sprite with no picture').toMatch(/photo-assets\/[\w-]+\.webp$/);
      expect(sprite.getAttribute('alt'), 'a sprite must stay silent').toBe('');
      expect(sprite.getAttribute('aria-hidden')).toBe('true');
    }
    // The plates are CSS backgrounds, so each one is handed to the scene as a
    // custom property - a plate that never arrives would leave a black sea.
    for (const property of ['--sky-photo', '--water-photo', '--seabed-photo', '--surface-photo']) {
      const holder = [...view.container.querySelectorAll('*')]
        .find((element) => (element.getAttribute('style') ?? '').includes(property));
      expect(holder, `${property} is never set`).toBeTruthy();
      expect(holder.getAttribute('style')).toContain('photo-assets/');
    }
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

    // A float that has landed and had its own moment in empty water says so:
    // waiting longer changes nothing until a fish swims into the bait's reach, so
    // the child is sent to the fish instead.
    const empty = { ...bait, bait: { ...bait.bait, phase: 'waiting', ticks: OFFER_TICKS } };
    expect(stageHint(empty)).toMatch(/ingen fisk/i);

    // A cast is never called barren before the water has had that moment.
    const justLanded = { ...bait, bait: { ...bait.bait, phase: 'waiting', ticks: 0 } };
    expect(stageHint(justLanded)).toMatch(/vent/i);

    // With a fish inside the reach of that float, it is simply waiting for it.
    const withinReach = { id: 99, status: 'swim', x: empty.bait.x + 4, lane: LANES[0] };
    const running = { ...empty, fishes: [...empty.fishes, withinReach] };
    expect(stageHint(running)).toMatch(/vent/i);

    // A bite, a fight, a catch on deck, a finished trip and the finale each get
    // their own stage and their own one-line hint.
    const biting = { ...bait, bait: { ...bait.bait, phase: 'biting', fishId: 1 } };
    expect(seaStage(biting)).toBe('bite');
    expect(stageHint(biting)).toMatch(/napp/i);

    const hooked = strikeFish(biting);
    expect(seaStage(hooked)).toBe('fight');
    // A fish on the line has one thing to do, whatever shape the fight is in.
    expect(stageHint(hooked)).toMatch(/sveiv/i);
    const turning = { ...hooked, fight: { ...hooked.fight, distance: 0.6 } };
    expect(stageHint(turning)).toMatch(/sveiv/i);

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
      const frame = view.container.querySelector('.fishing-line-frame');
      // The line is a single frame from (0,0) to (1,1) that one transform stretches
      // onto its two ends (see LineLayer in SeaScene.jsx): the near end belongs on
      // the rod tip, the far end on the float, tick after tick.
      const [x, y, scaleX, scaleY] = frame.style.transform.match(/-?[\d.]+/g).map(Number);
      expect(x).toBeCloseTo(RIG_DX.rodTip, 3);
      expect(y).toBeCloseTo(RIG_Y.rodTip, 3);
      expect(x + scaleX + parseFloat(layer.style.left)).toBeCloseTo(parseFloat(float.style.left), 3);
      expect(y + scaleY).toBeCloseTo(parseFloat(float.style.top), 3);
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
    // Sail to a fish first: the bait only reaches a fish swimming nearby.
    sailNearFish(view);
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

  it('leaves a cast in empty water alone, and says why', () => {
    const view = render(<WordFishing />);
    // Every fish starts off stage, so a cast at the boat's home spot lands in
    // water nothing swims in yet: nobody notices it at first – and the game says
    // as much instead of leaving the float there unexplained.
    fireEvent.click(view.container.querySelector('.cast-button'));
    ticks(CAST_TICKS + 30);
    expect(view.container.querySelector('.fishing-float').className).toContain('float-waiting');
    expect(view.container.querySelector('.fish-chasing')).toBeNull();
    expect(view.container.querySelector('.strike-ring')).toBeNull();
    expect(hintText(view)).toMatch(/ingen fisk/i);

    // A tap on the water is answered with what that takes, because a child tapping
    // there is very likely trying to sail to a fish they can see.
    tapWater(view, 70);
    expect(view.container.querySelector('.sea-nudge').textContent).toMatch(/seil til en fisk/i);
    expect(boatLeft(view)).toBe(`${BOAT_START_X}%`);

    // Nothing is counted and nothing is lost: the float is simply far from the
    // shoal, and the day is untouched.
    expect(boatProgress(view)).toBe('0 av 4');
    expect(view.container.querySelector('.dock-hint-tally').textContent).toMatch(/^0 av \d+ ord i fangstboka/);

    // And when a fish finally swims into reach, the float is taken at once: a
    // float in empty water is never a dead end, only a quiet spot.
    let chaser = null;
    for (let guard = 0; guard < 400 && !chaser; guard += 1) {
      chaser = view.container.querySelector('.fish-chasing');
      if (!chaser) ticks(1);
    }
    expect(chaser).toBeTruthy();
  });

  it('sets the hook only while the float is under', () => {
    const view = render(<WordFishing />);
    sailNearFish(view);
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
    expect(boatProgress(view)).toBe('0 av 4');
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();

    // Another fish takes an interest: a missed bite is never a dead end.
    expect(waitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
  });
});


describe('word-fishing the fight and the landing', () => {
  it('winds the fish in with the reel and shows the word on deck', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    // The fish is on the line: no tag, a reel instead, and a line in the water.
    const onLine = view.container.querySelector('.fish-hooked');
    expect(onLine).toBeTruthy();
    expect(onLine.querySelector('.fish-tag')).toBeNull();
    expect(view.container.querySelector('.fishing-line')).toBeTruthy();

    // A finger on the spool answers at once: the handle follows the turn…
    const button = spool(view);
    const handle = () => view.container.querySelector('.reel-handle').style.rotate;
    fireEvent.pointerDown(button, reelPoint(0));
    expect(view.container.querySelector('.reel.turning')).toBeTruthy();
    const before = handle();
    fireEvent.pointerMove(button, reelPoint(90));
    expect(handle()).not.toBe(before);
    // …and the sea tick then winds the line in.
    ticks(1);
    expect(spool(view)).toBeTruthy();
    fireEvent.pointerUp(button);

    // Spinning the reel always brings the fish home.
    expect(pump(view)).toBe(true);

    const card = view.container.querySelector('.catch-card');
    expect(card).toBeTruthy();
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
    expect(view.container.querySelector('.reel-spool')).toBeNull();
    // The word is there to be read, not tapped: plain text, no control – and
    // nothing anywhere in the game reads it aloud.
    expect(card.querySelector('.catch-word').tagName).toBe('P');
    expect(card.querySelector('button.catch-word')).toBeNull();
    expect(screen.queryByRole('button', { name: /Hør ordet/ })).toBeNull();
    // The crates can be answered now.
    expect(crateElement(view, categoryOf(card.querySelector('.catch-word').textContent))).toBeEnabled();
  });

  it('has nothing to read but the fish: no bar and no warning on the reel', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    // The spool is the whole control: no meter beside it, no level, no warning
    // over it – a child only has to spin.
    const button = spool(view);
    expect(view.container.querySelector('.reel').className).toBe('reel');
    expect(view.container.querySelector('.tension-meter')).toBeNull();
    expect(view.container.querySelector('.tension-fill')).toBeNull();
    expect(view.container.querySelector('.reel-warning')).toBeNull();
    expect(view.container.querySelector('.slack-warning')).toBeNull();
    expect(button.parentElement).toBe(view.container.querySelector('.action-bar .reel'));

    // A turn winds the fish in on the next sea tick, and leaving the reel alone
    // costs nothing: the fish is still on the line however long the child waits.
    fireEvent.pointerDown(button, reelPoint(0));
    fireEvent.pointerMove(button, reelPoint(90));
    ticks(1);
    fireEvent.pointerUp(button);
    ticks(60);
    expect(spool(view)).toBeTruthy();
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
    expect(view.container.querySelector('.catch-card')).toBeNull();

    // And spinning the reel from there still lands it.
    expect(pump(view)).toBe(true);
    expect(view.container.querySelector('.catch-word')).toBeTruthy();
  });

  it('keeps the fish on the line if the child never winds', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    // Nothing is touched at all, and nothing has to be: the fish waits on the
    // line for as long as the child takes to think about it.
    ticks(120);
    expect(view.container.querySelector('.reel-spool')).toBeTruthy();
    expect(view.container.querySelector('.fish-hooked')).toBeTruthy();
    expect(view.container.querySelector('.fish-splash')).toBeNull();
    expect(view.container.querySelector('.catch-card')).toBeNull();
    expect(view.container.querySelector('.fish-aboard')).toBeNull();

    // Nothing is counted, nothing is scolded, nothing is lost.
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(boatProgress(view)).toBe('0 av 4');
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();

    // And the fish is still there to be wound in.
    expect(pump(view)).toBe(true);
    expect(view.container.querySelector('.catch-card')).toBeTruthy();
  });

  it('lands the fish for a child who turns the reel and never eases', () => {
    const plopSound = vi.spyOn(sounds, 'plop');
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.reel-warning')).toBeNull();

    // A child who simply keeps spinning: no warning ever appears, the line never
    // gives way, and the fish lands.
    for (let step = 0; step < 60 && spool(view); step += 1) {
      spinReel(view, 180);
      ticks(1);
    }

    expect(view.container.querySelector('.reel-spool')).toBeNull();
    expect(view.container.querySelector('.catch-card')).toBeTruthy();
    expect(view.container.querySelector('.fish-aboard')).toBeTruthy();
    expect(view.container.querySelector('.fish-splash')).toBeNull();
    expect(plopSound).toHaveBeenCalled();
    // The catch is on deck, so the book has not counted it yet: the word is
    // counted when it lands in its crate, which is the reading task to come.
    expect(screen.getByText(`0 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT} igjen.`)).toBeInTheDocument();
    expect(boatProgress(view)).toBe('0 av 4');
    expect(view.container.querySelector('.crate-dock.live')).toBeTruthy();
    expect(screen.queryByText(/feil|galt|straff|mistet|stakk av/i)).not.toBeInTheDocument();
  });

  it('answers the finger and the keyboard on the reel, and lets go either way', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));

    const button = spool(view);
    const turning = () => Boolean(view.container.querySelector('.reel.turning'));
    const handle = () => view.container.querySelector('.reel-handle').style.rotate;

    // A tap on the spool – the same click a switch, a screen reader or Enter and
    // Space send a button – is one deliberate quarter turn, like the arrows.
    const tapped = handle();
    fireEvent.click(button);
    expect(handle()).not.toBe(tapped);

    // A finger on the spool starts the turn, and a circle feeds the fight.
    fireEvent.pointerDown(button, reelPoint(0));
    expect(turning()).toBe(true);
    const before = handle();
    fireEvent.pointerMove(button, reelPoint(90));
    expect(handle()).not.toBe(before);

    // …and a finger lifted anywhere ends it again.
    fireEvent.pointerUp(window);
    expect(turning()).toBe(false);

    // A keyboard or switch user turns the reel with the arrow keys.
    const right = handle();
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(handle()).not.toBe(right);
    // Key repeat would spin the reel far too fast to steer, so it is ignored.
    const once = handle();
    fireEvent.keyDown(button, { key: 'ArrowRight', repeat: true });
    expect(handle()).toBe(once);
    // The other arrow turns the same line in the other direction.
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(handle()).not.toBe(once);

    // Leaving the spool with a finger still down is a release too.
    fireEvent.pointerDown(button, reelPoint(0));
    expect(turning()).toBe(true);
    fireEvent.pointerLeave(button);
    expect(turning()).toBe(false);

    // A drag already wound the line, so the click the browser fires when it ends
    // must not add an extra quarter turn…
    fireEvent.pointerDown(button, reelPoint(0));
    fireEvent.pointerMove(button, reelPoint(90));
    fireEvent.pointerMove(button, reelPoint(180));
    fireEvent.pointerUp(button);
    const dragged = handle();
    fireEvent.click(button);
    expect(handle()).toBe(dragged);
    // …while a real tap straight after still winds.
    fireEvent.click(button);
    expect(handle()).not.toBe(dragged);
  });

  it('holds the boat still for the whole fight', () => {
    const view = render(<WordFishing />);
    expect(castAndWaitForBite(view)).toBe(true);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    expect(view.container.querySelector('.reel-spool')).toBeTruthy();

    // The water holds the boat where it fished from, wherever that is: a stray
    // tap is answered with a nudge, not with a sail.
    const held = boatLeft(view);
    tapWater(view, 80);
    expect(view.container.querySelector('.sea-nudge')).toBeTruthy();
    expect(view.container.querySelector('.sail-marker')).toBeNull();
    expect(boatLeft(view)).toBe(held);

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
    // the float is gone, and no fish anywhere is tappable. The boat stays where
    // it landed the catch, whatever the child taps.
    const held = boatLeft(view);
    expect(view.container.querySelector('.fish button')).toBeNull();
    expect(view.container.querySelector('.strike-ring')).toBeNull();
    expect(view.container.querySelector('.action-bar')).toBeNull();
    tapWater(view, 70);
    expect(view.container.querySelector('.sea-nudge')).toBeTruthy();
    expect(boatLeft(view)).toBe(held);
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
    expect(boatProgress(view)).toBe('0 av 4');
  });
});


describe('word-fishing rewards and the fishing book', () => {
  it('says what to do next, and marks the crates live only when a catch waits', () => {
    const view = render(<WordFishing />);
    expect(hintText(view)).toMatch(/seile/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();

    // Sail to a fish before casting: a float in empty water is not waiting for
    // anything, and says so (see the test below).
    sailNearFish(view);
    fireEvent.click(view.container.querySelector('.cast-button'));
    ticks(CAST_TICKS);
    expect(hintText(view)).toMatch(/vent/i);
    expect(view.container.querySelector('.crate-dock.live')).toBeNull();

    expect(waitForBite(view)).toBe(true);
    expect(hintText(view)).toMatch(/napp/i);
    fireEvent.click(view.container.querySelector('.strike-ring'));
    // A fish on the line keeps the same one-line hint, before and after the
    // child has turned the reel: there is nothing else to read.
    expect(hintText(view)).toMatch(/sveiv/i);

    spinReel(view, 360);
    ticks(1);
    expect(hintText(view)).toMatch(/sveiv/i);
    expect(view.container.querySelector('.reel-spool')).toBeTruthy();

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
    expect(done.textContent).toContain(`Du fant ${FIRST_FIND.label.toLowerCase()} på sjøbunnen!`);
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    // The dock says why nothing can be answered until the next trip starts.
    expect(hintText(view)).toMatch(/ny tur/i);
    // Nobody can fish while the card is up, so nothing may look tappable.
    expect(view.container.querySelectorAll('.fish button')).toHaveLength(0);
    expect(view.container.querySelector('.action-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: /feste kroken|Sveiv inn/ })).toBeNull();
    // The reef grew: the first reward is painted on the seabed, with the trip's
    // own find shown on the card, and the newest find glows where it landed.
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}`)).toBeTruthy();
    expect(view.container.querySelector(`.reward-${SECOND_FIND.id}`)).toBeNull();
    expect(done.querySelector('.trip-done-art img.reef-art')).toBeTruthy();
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}.is-new`)).toBeTruthy();

    // The glow is a moment, not a state: once its time is up the find settles
    // into the collection like every other one.
    act(() => {
      vi.advanceTimersByTime(TIMING.REWARD_POP_MS + TICK_MS);
    });
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}`)).toBeTruthy();
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}.is-new`)).toBeNull();

    fireEvent.click(within(done).getByRole('button', { name: /Ny tur/ }));

    expect(view.container.querySelector('.trip-done')).toBeNull();
    expect(boatProgress(view)).toBe('0 av 4');
    expect(screen.getByText(`4 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 4} igjen.`)).toBeInTheDocument();
    // The decoration stays on the seabed while the next trip starts.
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}`)).toBeTruthy();
    // Four full catches – cast, bite, fight and delivery, each tick rendered –
    // are slow when every test file runs at once, so give this the same
    // generous timeout as the other long game tests.
  }, 20000);

  it('never celebrates a trip a second time after a reload', () => {
    // A trip that was already full when the page was closed: the next catch is
    // ordinary play, not another finished trip.
    window.localStorage.setItem(TRIP_KEY, tripCodec.serialize({ ...createTripPlan(1), collected: 4 }));
    window.localStorage.setItem(JOURNAL_KEY, journalCodec.serialize({ ...createJournal(), trips: 1, decorations: [0] }));

    const view = render(<WordFishing />);
    expect(boatProgress(view)).toBe('4 av 4');
    expect(view.container.querySelector('.trip-done')).toBeNull();

    catchAndSort(view);

    expect(view.container.querySelector('.trip-done')).toBeNull();
    expect(screen.getByText(`1 av ${TARGET_WORD_COUNT} ord i fangstboka – ${TARGET_WORD_COUNT - 1} igjen.`)).toBeInTheDocument();
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}`)).toBeTruthy();
    expect(view.container.querySelector(`.reward-${SECOND_FIND.id}`)).toBeNull();
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

    // The boat keeps its number on the flag and its two catches, but carries
    // all four crates: the flag, the counter on the hull and the next «Ny tur»
    // can never disagree.
    expect(view.container.querySelector('.boat-flag-number').textContent).toBe('4');
    expect(view.container.querySelectorAll('.crate')).toHaveLength(4);
    expect(boatProgress(view)).toBe('2 av 4');
    expect(fishElements(view)).toHaveLength(FISH_ON_SCREEN);
    expect(view.container.querySelector('.trip-done')).toBeNull();

    // A catch from any category sorts as usual.
    catchAndSort(view);
    expect(boatProgress(view)).toBe('3 av 4');
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
    expect(view.container.querySelector('.boat-flag-number').textContent).toBe('1');
    expect(view.container.querySelectorAll('.crate')).toHaveLength(4);
    expect(crateProgress(view, CATEGORY_CRATE_IDS[0])).toBe(`0 av ${CRATE_TARGET} ord`);
    expect(view.container.querySelector(`.reward-${FIRST_FIND.id}`)).toBeNull();
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

    const view = render(<WordFishing />);
    expect(boatProgress(view)).toBe('2 av 4');

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
    // Two finished trips left two stamps and two decorations, counted against
    // the ten treasures the seabed now holds.
    expect(within(book).getByText('Tur 1')).toBeInTheDocument();
    expect(within(book).getByText('Tur 2')).toBeInTheDocument();
    expect(within(book).getByText(FIRST_FIND.label)).toBeInTheDocument();
    expect(within(book).getByText(`2 av ${REEF_REWARDS.length}`)).toBeInTheDocument();

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

