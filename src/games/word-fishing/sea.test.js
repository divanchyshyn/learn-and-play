import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CHASE_TICKS, DELIVER_TICKS, FISH_ON_SCREEN, LANES, OFFER_TICKS, SPEED_MAX, SPEED_MIN, WATERLINE,
  aboardFish, baitFish, baitPosition, canCastBait, canPullIn, canSail, canStrike, castBait, createSea,
  deliverFish, fishPosition, fishWord, hookedFish, lineTarget, netPoint, pullInBait, rodTipPoint, sailBoat,
  setReelHold, slipFish, strikeFish, tickSea,
} from './sea.js';
import {
  BITE_TICKS, BOAT_MAX_X, BOAT_SPEED, BOAT_START_X, CAST_TICKS, DROP_MAX_DEPTH, DROP_MIN_DEPTH, DROP_SWAY,
  NIBBLE_EACH, NIBBLES_MIN, RIG_DX, RIG_Y, SLACK_TICKS, TENSION_NEAR,
} from './rig.js';
import { createTripPlan } from './trip.js';
import { WORD_BANK } from './words.js';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A first-trip plan: all four crates, so every word the shoal carries can be kept.
const freeSortTrip = () => createTripPlan(1);

function words(sea) {
  return sea.fishes.map((fish) => fish.wordIndex);
}

function fishById(sea, id) {
  return sea.fishes.find((fish) => fish.id === id) ?? null;
}

function tickTimes(sea, count) {
  let next = sea;
  for (let tick = 0; tick < count; tick += 1) next = tickSea(next);
  return next;
}

// Cast, then wait exactly as long as the game needs for a fish to notice the
// bait, swim over and commit to it. With Math.random pinned the numbers are
// fixed: the float flies for CAST_TICKS, lies still for OFFER_TICKS, the fish
// swims over in CHASE_TICKS, and NIBBLES_MIN tastes of NIBBLE_EACH ticks end in
// the bite. The sea comes back with the float under and `canStrike` true.
function biteReady(sea) {
  const wait = CAST_TICKS + OFFER_TICKS + CHASE_TICKS + NIBBLES_MIN * NIBBLE_EACH;
  const next = tickTimes(castBait(sea), wait);
  expect(next.bait.phase).toBe('biting');
  return next;
}

// Hold the crank while the line has room, ease it while it does not – the pump
// a child plays. Returns the sea with the fight over.
function windIn(sea) {
  let next = sea;
  for (let guard = 0; guard < 400 && next.fight; guard += 1) {
    next = tickSea(setReelHold(next, next.fight.tension < TENSION_NEAR));
  }
  return next;
}

// The whole trip a child makes: cast, wait for the bite, strike, wind the fish
// in. Returns the sea with the catch on deck.
function catchFish(sea) {
  return windIn(strikeFish(biteReady(sea)));
}

describe('word-fishing sea setup', () => {
  it('opens with a small shoal of calm, off-stage fish in an empty boat', () => {
    const sea = createSea(freeSortTrip());
    expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(hookedFish(sea)).toBeNull();
    expect(aboardFish(sea)).toBeNull();
    expect(sea.bait).toBeNull();
    expect(sea.fight).toBeNull();
    expect(sea.boat.x).toBe(BOAT_START_X);
    expect(canSail(sea)).toBe(true);
    expect(canCastBait(sea)).toBe(true);
    expect(canPullIn(sea)).toBe(false);
    expect(canStrike(sea)).toBe(false);
    expect(lineTarget(sea)).toBeNull();

    for (const fish of sea.fishes) {
      expect(fish.status).toBe('swim');
      expect(fish.speed).toBeGreaterThanOrEqual(SPEED_MIN);
      expect(fish.speed).toBeLessThanOrEqual(SPEED_MAX);
      expect(LANES).toContain(fish.lane);
      expect([1, -1]).toContain(fish.dir);
      // Everyone waits just outside the visible water before drifting in.
      expect(fishPosition(fish).x < 0 || fishPosition(fish).x > 100).toBe(true);
    }
  });

  it('never shows the same word on two fish at once', () => {
    for (let trial = 0; trial < 30; trial += 1) {
      expect(new Set(words(createSea(freeSortTrip()))).size).toBe(FISH_ON_SCREEN);
    }
  });

  it('stays distinct over a long session full of comings and goings', () => {
    let sea = createSea(freeSortTrip());
    for (let tick = 0; tick < 800; tick += 1) {
      sea = tickSea(sea);
      expect(new Set(words(sea)).size).toBe(sea.fishes.length);
      expect(sea.fishes.length).toBe(FISH_ON_SCREEN);
    }
  });

  it('spreads the opening shoal across different lanes and entry times', () => {
    const sea = createSea(freeSortTrip());
    expect(new Set(sea.fishes.map((fish) => fish.lane)).size).toBe(FISH_ON_SCREEN);
    const entries = sea.fishes.map((fish) => fishPosition(fish).x);
    expect(new Set(entries).size).toBe(FISH_ON_SCREEN);
  });
});


describe('word-fishing sailing', () => {
  it('sails to the spot that was tapped, one calm step at a time', () => {
    const sea = createSea(freeSortTrip());
    const sailing = sailBoat(sea, 60);
    expect(sailing.boat.targetX).toBe(60);

    const afterOne = tickSea(sailing);
    expect(afterOne.boat.x).toBe(BOAT_START_X + BOAT_SPEED);

    let arrived = afterOne;
    for (let guard = 0; guard < 200 && arrived.boat.x !== 60; guard += 1) arrived = tickSea(arrived);
    expect(arrived.boat.x).toBe(60);
    expect(tickSea(arrived).boat.x).toBe(60);
  });

  it('keeps the whole rig together: the rod tip and the net travel with the boat', () => {
    const home = createSea(freeSortTrip()).boat;
    const sailed = tickTimes(sailBoat(createSea(freeSortTrip()), 60), 40).boat;
    expect(rodTipPoint(sailed).x - sailed.x).toBe(rodTipPoint(home).x - home.x);
    expect(netPoint(sailed).x).toBeGreaterThan(sailed.x);
    expect(netPoint(sailed).y).toBe(RIG_Y.net);
  });

  it('holds the boat still while a line is in the water', () => {
    const cast = castBait(createSea(freeSortTrip()));
    expect(canSail(cast)).toBe(false);
    expect(sailBoat(cast, 60)).toBe(cast);

    // Pull the line up and the boat is free to sail again.
    const up = pullInBait(cast);
    expect(canSail(up)).toBe(true);
    expect(sailBoat(up, 60).boat.targetX).toBe(60);
  });

  it('holds the boat still while a catch waits on deck', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    expect(aboardFish(aboard)).toBeTruthy();
    expect(canSail(aboard)).toBe(false);
    expect(sailBoat(aboard, 60)).toBe(aboard);
  });

  it('sails nowhere for a tap on the spot the boat is already at', () => {
    const sea = createSea(freeSortTrip());
    expect(sailBoat(sea, BOAT_START_X)).toBe(sea);
  });
});

describe('word-fishing putting the line out', () => {
  it('lowers the bait into the water under the boat and stops the boat there', () => {
    const sailing = tickTimes(sailBoat(createSea(freeSortTrip()), 60), 40);
    const cast = castBait(sailing);

    expect(cast.bait.phase).toBe('flying');
    // A line is put out from where the boat is, so the boat stops for it.
    expect(cast.boat.targetX).toBe(sailing.boat.x);
    // The bait goes down under the boat, in the rod's own column…
    expect(cast.bait.x).toBeGreaterThanOrEqual(sailing.boat.x + RIG_DX.rodTip - DROP_SWAY);
    expect(cast.bait.x).toBeLessThanOrEqual(sailing.boat.x + RIG_DX.rodTip + DROP_SWAY);
    // …well below the hull and inside the water the fish swim in.
    expect(cast.bait.y).toBeGreaterThan(WATERLINE);
    expect(cast.bait.y).toBeGreaterThanOrEqual(DROP_MIN_DEPTH);
    expect(cast.bait.y).toBeLessThanOrEqual(DROP_MAX_DEPTH);
  });

  it('keeps the bait in the water even when the boat hugs an edge', () => {
    const left = castBait(createSea(freeSortTrip()));
    expect(left.bait.x).toBeGreaterThan(3);
    const right = castBait(tickTimes(sailBoat(createSea(freeSortTrip()), 90), 60));
    expect(right.boat.x).toBe(BOAT_MAX_X);
    expect(right.bait.x).toBeLessThan(97);
    expect(right.bait.y).toBeLessThan(60);
  });

  it('falls from the rod tip into the water, then floats there', () => {
    const cast = castBait(createSea(freeSortTrip()));
    const tip = rodTipPoint(cast.boat);
    const start = baitPosition(cast);
    expect(start.x).toBeCloseTo(tip.x);
    expect(start.y).toBeCloseTo(tip.y);

    // It only ever goes down: the bait is lowered, never lobbed.
    let previous = start.y;
    for (let tick = 1; tick <= CAST_TICKS; tick += 1) {
      const y = baitPosition(tickTimes(cast, tick)).y;
      expect(y).toBeGreaterThan(previous);
      previous = y;
    }

    const landed = tickTimes(cast, CAST_TICKS);
    expect(landed.bait.phase).toBe('waiting');
    expect(baitPosition(landed)).toEqual({ x: landed.bait.x, y: landed.bait.y });
    // And it came to rest right below the rod it was lowered from.
    expect(Math.abs(landed.bait.x - rodTipPoint(landed.boat).x)).toBeLessThanOrEqual(DROP_SWAY);
  });

  it('refuses a second cast while a line is already out', () => {
    const cast = castBait(createSea(freeSortTrip()));
    expect(canCastBait(cast)).toBe(false);
    expect(castBait(cast)).toBe(cast);
  });

  it('refuses a cast while a catch still waits on deck', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    expect(canCastBait(aboard)).toBe(false);
    expect(castBait(aboard)).toBe(aboard);
  });

  it('pulls the line up again, and the fish that was after it swims on', () => {
    const cast = castBait(createSea(freeSortTrip()));
    expect(canPullIn(cast)).toBe(true);
    const up = pullInBait(cast);
    expect(up.bait).toBeNull();
    expect(canCastBait(up)).toBe(true);

    // The same while a fish is already on its way to the bait.
    const waiting = tickTimes(cast, CAST_TICKS + OFFER_TICKS + 1);
    const tempted = baitFish(waiting);
    expect(tempted.status).toBe('chasing');
    const pulled = pullInBait(tickTimes(waiting, 3));
    expect(pulled.bait).toBeNull();
    const freed = fishById(pulled, tempted.id);
    expect(freed.status).toBe('swim');
    expect(freed.spat).toBe(false);
  });

  it('has nothing to pull up when no line is out', () => {
    const sea = createSea(freeSortTrip());
    expect(pullInBait(sea)).toBe(sea);
  });
});


describe('word-fishing waiting for a bite', () => {
  it('lets the float lie still before anything happens, then a fish comes over', () => {
    const cast = castBait(createSea(freeSortTrip()));
    const landed = tickTimes(cast, CAST_TICKS);
    expect(landed.bait.phase).toBe('waiting');
    expect(baitFish(landed)).toBeNull();

    // A moment of calm, and then someone notices the bait.
    const tempted = tickTimes(cast, CAST_TICKS + OFFER_TICKS);
    expect(baitFish(tempted).status).toBe('chasing');
    expect(tempted.fishes.filter((entry) => entry.status !== 'swim')).toHaveLength(1);

    // It really swims over: tick after tick it is closer to the float.
    const distanceTo = (sea) => {
      const position = fishPosition(baitFish(sea), sea.boat);
      return Math.hypot(position.x - sea.bait.x, position.y - sea.bait.y);
    };
    const near = distanceTo(tickTimes(cast, CAST_TICKS + OFFER_TICKS + CHASE_TICKS - 1));
    const far = distanceTo(tickTimes(cast, CAST_TICKS + OFFER_TICKS + 1));
    expect(near).toBeLessThan(far);

    // Arrived, it starts tasting the bait – then the float goes under.
    const tasting = tickTimes(cast, CAST_TICKS + OFFER_TICKS + CHASE_TICKS);
    expect(baitFish(tasting).status).toBe('nibbling');
    expect(baitFish(tasting).chaseT).toBe(1);
    expect(canStrike(tasting)).toBe(false);

    const biting = biteReady(createSea(freeSortTrip()));
    expect(baitFish(biting).status).toBe('biting');
    expect(canStrike(biting)).toBe(true);
    // The fish is right at the float, jostling it.
    const atBait = fishPosition(baitFish(biting), biting.boat);
    expect(Math.abs(atBait.x - biting.bait.x)).toBeLessThan(2.5);
    expect(Math.abs(atBait.y - biting.bait.y)).toBeLessThan(2.5);
  });

  it('lets a bite nobody answered go: the fish swims on and the bait stays', () => {
    const biting = biteReady(createSea(freeSortTrip()));
    const fishId = biting.bait.fishId;
    const waited = tickTimes(biting, BITE_TICKS);

    expect(waited.bait.phase).toBe('waiting');
    expect(waited.bait.fishId).toBeNull();
    // The bait is still exactly where it was cast: nothing is lost.
    expect({ x: waited.bait.x, y: waited.bait.y }).toEqual({ x: biting.bait.x, y: biting.bait.y });
    expect(canStrike(waited)).toBe(false);

    const letGo = fishById(waited, fishId);
    expect(letGo.status).toBe('swim');
    expect(letGo.spat).toBe(true);
    expect(aboardFish(waited)).toBeNull();

    // The splash is a moment, not a state…
    expect(fishById(tickTimes(waited, 1), fishId).spat).toBe(false);

    // …and another fish comes along: a missed bite is never a dead end.
    const again = tickTimes(waited, OFFER_TICKS + CHASE_TICKS + NIBBLES_MIN * NIBBLE_EACH);
    expect(again.bait.phase).toBe('biting');
    expect(canStrike(again)).toBe(true);
  });

  it('only a bite can be struck: nothing happens before it or after it', () => {
    const cast = castBait(createSea(freeSortTrip()));
    expect(strikeFish(cast)).toBe(cast); // still flying
    const tasting = tickTimes(cast, CAST_TICKS + OFFER_TICKS + CHASE_TICKS);
    expect(strikeFish(tasting)).toBe(tasting); // only tasting
    const gone = tickTimes(biteReady(createSea(freeSortTrip())), BITE_TICKS);
    expect(strikeFish(gone)).toBe(gone); // the moment has passed
  });
});

describe('word-fishing the fight', () => {
  it('puts the fish on the line the moment it is struck, from the spot it took the bait', () => {
    const biting = biteReady(createSea(freeSortTrip()));
    const fishId = biting.bait.fishId;
    const hooked = strikeFish(biting);

    // The float is gone the moment the hook bites: the line runs to the fish.
    expect(hooked.bait).toBeNull();
    expect(hookedFish(hooked).id).toBe(fishId);
    expect(hooked.fight).toMatchObject({ fishId, distance: 0, tension: 0, holding: false });
    expect(hookedFish(hooked).hookX).toBe(biting.bait.x);
    expect(hookedFish(hooked).hookY).toBe(biting.bait.y);
    expect(lineTarget(hooked)).toEqual(fishPosition(hookedFish(hooked), hooked.boat));
  });

  it('winds the fish in and tightens the line while the crank is held', () => {
    const hooked = strikeFish(biteReady(createSea(freeSortTrip())));
    const pulled = tickSea(setReelHold(hooked, true));
    expect(pulled.fight.holding).toBe(true);
    expect(pulled.fight.distance).toBeGreaterThan(0);
    expect(pulled.fight.tension).toBeGreaterThan(0);
    // The fight is mirrored onto the fish, so the scene paints one object.
    expect(hookedFish(pulled).distance).toBe(pulled.fight.distance);
    expect(hookedFish(pulled).tension).toBe(pulled.fight.tension);

    // The fish really does come closer to the boat as the line is wound in:
    // after a few turns it is clearly nearer the net than where it took the bait.
    // (One tick is not enough to compare – the thrashing swings it about as much
    // as one turn of the crank pulls it in.)
    let wound = hooked;
    for (let tick = 0; tick < 12; tick += 1) wound = tickSea(setReelHold(wound, true));
    const start = fishPosition(hookedFish(hooked), hooked.boat);
    const end = fishPosition(hookedFish(wound), wound.boat);
    expect(Math.abs(end.x - netPoint(wound.boat).x)).toBeLessThan(Math.abs(start.x - netPoint(hooked.boat).x));
    expect(Math.abs(end.y - netPoint(wound.boat).y)).toBeLessThan(Math.abs(start.y - netPoint(hooked.boat).y));
  });

  it('eases the line and loses a little of it when the crank is let go', () => {
    let sea = strikeFish(biteReady(createSea(freeSortTrip())));
    for (let tick = 0; tick < 8; tick += 1) sea = tickSea(setReelHold(sea, true));
    const strained = sea.fight;
    const eased = tickSea(setReelHold(sea, false));
    expect(eased.fight.tension).toBeLessThan(strained.tension);
    expect(eased.fight.distance).toBeLessThan(strained.distance);
    // The crank answers the finger at once, without waiting for a sea tick.
    expect(setReelHold(sea, true).fight.holding).toBe(true);
    expect(setReelHold(sea, false).fight.holding).toBe(false);
  });

  it('lets the fish throw the hook when the line is left slack', () => {
    const hooked = strikeFish(biteReady(createSea(freeSortTrip())));
    const fishId = hooked.fight.fishId;

    // Nobody touches the crank for the whole slack window: the hook is not being
    // pulled on, so the fish works it out.
    let sea = hooked;
    for (let tick = 0; tick < SLACK_TICKS; tick += 1) sea = tickSea(sea);

    expect(sea.fight).toBeNull();
    expect(aboardFish(sea)).toBeNull();
    const free = fishById(sea, fishId);
    expect(free.status).toBe('swim');
    expect(free.thrown).toBe(true);
    expect(free.escaped).toBe(false);
    // Nothing is counted, and the line can go out again at once.
    expect(canCastBait(sea)).toBe(true);
    expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(words(sea)).size).toBe(FISH_ON_SCREEN);

    // The splash is a moment, not a state.
    expect(fishById(tickSea(sea), fishId).thrown).toBe(false);
  });

  it('keeps the hook in for a child who keeps winding', () => {
    const hooked = strikeFish(biteReady(createSea(freeSortTrip())));
    let sea = hooked;
    // Wind in fits and starts, never letting the line lie slack for long: the
    // hook stays in, and the fish really does come closer to the boat.
    for (let cycle = 0; cycle < 2; cycle += 1) {
      for (let tick = 0; tick < 7; tick += 1) sea = tickSea(setReelHold(sea, true));
      for (let tick = 0; tick < 4; tick += 1) sea = tickSea(setReelHold(sea, false));
    }
    expect(sea.fight).not.toBeNull();
    expect(sea.fight.slack).toBeLessThan(SLACK_TICKS);
    expect(hookedFish(sea).distance).toBeGreaterThan(hooked.fight.distance);
  });

  it('lands the fish in the net when the fight is won', () => {
    const won = windIn(strikeFish(biteReady(createSea(freeSortTrip()))));
    const fish = aboardFish(won);
    expect(fish).toBeTruthy();
    expect(won.fight).toBeNull();
    expect(hookedFish(won)).toBeNull();
    expect(fishPosition(fish, won.boat).x).toBeCloseTo(netPoint(won.boat).x, 1);
    expect(fishPosition(fish, won.boat).y).toBeCloseTo(RIG_Y.net, 1);
    expect(canCastBait(won)).toBe(false); // the catch comes first
  });

  it('frees the fish with a splash when the line is held until it snaps', () => {
    let sea = strikeFish(biteReady(createSea(freeSortTrip())));
    const fishId = sea.fight.fishId;
    for (let guard = 0; guard < 200 && sea.fight; guard += 1) sea = tickSea(setReelHold(sea, true));

    expect(sea.fight).toBeNull();
    expect(aboardFish(sea)).toBeNull();
    const free = fishById(sea, fishId);
    expect(free.status).toBe('swim');
    expect(free.escaped).toBe(true);
    // Nothing is counted and nothing is lost: the line can be cast again.
    expect(canCastBait(sea)).toBe(true);
    expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('lets a whole trip be fished again from the start after a snapped line', () => {
    let sea = strikeFish(biteReady(createSea(freeSortTrip())));
    for (let guard = 0; guard < 200 && sea.fight; guard += 1) sea = tickSea(setReelHold(sea, true));
    const hooked = strikeFish(biteReady(sea));
    expect(hookedFish(hooked)).toBeTruthy();
    expect(aboardFish(windIn(hooked))).toBeTruthy();
  });
});


describe('word-fishing releasing and delivering', () => {
  it('says whether a new line may be cast at all', () => {
    const sea = createSea(freeSortTrip());
    expect(canCastBait(sea)).toBe(true);
    const aboard = catchFish(sea);
    const id = aboardFish(aboard).id;
    expect(canCastBait(aboard)).toBe(false);
    expect(canCastBait(deliverFish(aboard, id, 'animals'))).toBe(true);
  });

  it('sends a fish back into the water below the boat when it is let go', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    const id = aboardFish(aboard).id;
    const slipped = slipFish(aboard, id);
    const free = fishById(slipped, id);
    expect(free.status).toBe('swim');
    expect(free.x).toBeCloseTo(netPoint(aboard.boat).x);
    expect(LANES).toContain(free.lane);
    expect(aboardFish(slipped)).toBeNull();
    expect(free.distance).toBe(0);
    expect(free.tension).toBe(0);
  });

  it('leaves a swimming fish and unknown ids alone', () => {
    const sea = createSea(freeSortTrip());
    expect(slipFish(sea, sea.fishes[0].id)).toBe(sea);
    expect(slipFish(sea, 9999)).toBe(sea);
    expect(deliverFish(sea, 9999, 'animals')).toBe(sea);
  });

  it('drops a catch into its crate, then refills the water', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    const id = aboardFish(aboard).id;
    const delivered = deliverFish(aboard, id, 'animals');
    const fish = fishById(delivered, id);
    expect(fish.status).toBe('delivered');
    expect(fish.crateId).toBe('animals');
    expect(aboardFish(delivered)).toBeNull();

    let after = delivered;
    for (let tick = 0; tick < DELIVER_TICKS; tick += 1) after = tickSea(after);
    expect(fishById(after, id)).toBeNull();
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('sends a replacement in the moment a catch lands in its crate', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    const delivered = deliverFish(aboard, aboardFish(aboard).id, 'animals');

    // The caught fish is still sinking, and the water is already full again.
    expect(delivered.fishes.filter((fish) => fish.status === 'delivered')).toHaveLength(1);
    expect(delivered.fishes.filter((fish) => fish.status === 'swim')).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(words(delivered)).size).toBe(delivered.fishes.length);

    let after = delivered;
    for (let tick = 0; tick < DELIVER_TICKS; tick += 1) after = tickSea(after);
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(after.fishes.every((fish) => fish.status === 'swim')).toBe(true);
  });

  it('only delivers a fish that is really on deck', () => {
    const sea = createSea(freeSortTrip());
    expect(deliverFish(sea, sea.fishes[0].id, 'animals')).toBe(sea);
    const hooked = strikeFish(biteReady(sea));
    expect(deliverFish(hooked, hooked.fight.fishId, 'animals')).toBe(hooked);
  });
});


describe('word-fishing the fishing book', () => {
  it('never lets a caught word back into the water', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    const caught = aboardFish(aboard);
    const caughtWord = fishWord(caught);
    let after = deliverFish(aboard, caught.id, 'animals');

    // Long enough for several shoals to come and go. The fish sinking into the
    // crate is the catch itself; no *swimming* fish may ever carry the word.
    for (let tick = 0; tick < 1200; tick += 1) {
      after = tickSea(after);
      expect(after.fishes.some((fish) => fish.status !== 'delivered' && fishWord(fish) === caughtWord)).toBe(false);
    }
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('never deals a word the book already has', () => {
    const unavailable = new Set(WORD_BANK.map((entry) => entry.word).slice(0, 70));
    let sea = createSea(freeSortTrip(), unavailable);
    for (let tick = 0; tick < 1200; tick += 1) {
      sea = tickSea(sea);
      for (const fish of sea.fishes) expect(unavailable.has(fishWord(fish))).toBe(false);
    }
    expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
  });

  it('lets the shoal run down when there is no uncaught word left', () => {
    // Every word is out of play: no fish may be dealt, caught words included.
    const unavailable = new Set(WORD_BANK.map((entry) => entry.word));
    let sea = createSea(freeSortTrip(), unavailable);
    expect(sea.fishes).toHaveLength(0);
    for (let tick = 0; tick < 200; tick += 1) sea = tickSea(sea);
    expect(sea.fishes).toHaveLength(0);
    // A cast into an empty sea is still safe: nobody arrives, nothing breaks.
    const empty = tickTimes(castBait(sea), CAST_TICKS + OFFER_TICKS + CHASE_TICKS);
    expect(empty.fishes).toHaveLength(0);
    expect(empty.bait.phase).toBe('waiting');
    expect(empty.bait.fishId).toBeNull();
  });

  it('replaces a fish whose word was taken out of play while it swam', () => {
    const sea = createSea(freeSortTrip());
    const stale = sea.fishes[0];
    const blocked = fishWord(stale);
    const next = tickSea({ ...sea, unavailable: new Set([blocked]) });

    // The stale fish is gone and a fresh, keepable one swims in its place.
    expect(next.fishes.some((fish) => fishWord(fish) === blocked)).toBe(false);
    expect(next.fishes).toHaveLength(FISH_ON_SCREEN);
    expect(new Set(words(next)).size).toBe(FISH_ON_SCREEN);
  });

  it('takes the words a finished crate leaves behind out of the deal', () => {
    const aboard = catchFish(createSea(freeSortTrip()));
    const leftBehind = ['katt', 'hund'];
    let after = deliverFish(aboard, aboardFish(aboard).id, 'animals', leftBehind);
    expect(after.unavailable.has('katt')).toBe(true);
    expect(after.unavailable.has('hund')).toBe(true);

    // The words leaving the water with the catch never come back.
    for (let tick = 0; tick < 400; tick += 1) {
      after = tickSea(after);
      expect(after.fishes.some((fish) => fish.status !== 'delivered' && leftBehind.includes(fishWord(fish)))).toBe(false);
    }
    expect(after.fishes).toHaveLength(FISH_ON_SCREEN);
  });
});

describe('word-fishing invariants', () => {
  it('keeps every promise through a mixed play session', () => {
    let sea = createSea(freeSortTrip());
    for (let round = 0; round < 6; round += 1) {
      // Sail somewhere new, cast, land a fish, put it in its crate.
      sea = tickTimes(sailBoat(sea, 20 + round * 10), 40);
      const aboard = catchFish(sea);
      expect(aboard.fishes).toHaveLength(FISH_ON_SCREEN);
      expect(new Set(words(aboard)).size).toBe(FISH_ON_SCREEN);
      const id = aboardFish(aboard).id;
      sea = deliverFish(aboard, id, 'animals');
      for (let tick = 0; tick < DELIVER_TICKS; tick += 1) sea = tickSea(sea);

      expect(sea.fishes).toHaveLength(FISH_ON_SCREEN);
      expect(aboardFish(sea)).toBeNull();
      expect(hookedFish(sea)).toBeNull();
      expect(sea.bait).toBeNull();
      expect(sea.fight).toBeNull();
      // Nothing in the sea shape ever counts a miss, a mistake or a try.
      expect(Object.keys(sea).sort()).toEqual(['bait', 'boat', 'fight', 'fishes', 'order', 'orderPos', 'trip', 'unavailable']);
      for (const fish of sea.fishes) {
        expect(['swim', 'chasing', 'nibbling', 'biting', 'hooked', 'aboard', 'delivered']).toContain(fish.status);
      }
    }
  });
});
