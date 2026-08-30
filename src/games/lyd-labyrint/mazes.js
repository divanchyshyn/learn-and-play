// Lyd-labyrinten's mazes are carved fresh for every new game: a classic
// recursive-backtracker maze (single-width corridors, junctions, dead ends)
// that is then "braided" – a handful of walls are knocked out so there are
// loops and shortcuts to explore too. Bigger and branchier than the old
// hand-built chains, and never a dead end in the *frustrating* sense,
// because every door is an openable spelling lock rather than a "wrong" choice.
//
// A maze is generated with an injectable `random` (defaults to Math.random),
// so tests can pin it and stay deterministic, while every fresh maze still
// feels brand new in the browser.
//
// Map legend (what the generator carves):
//   #  wall          .  floor
//   S  start (1,1)   X  exit (farthest floor cell from the start)
//   D  a door cell – every door is a spelling puzzle, see LydLabyrint.jsx

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export const THEMES = [
  { name: 'Skogen', theme: 'skog', width: 17, height: 13 },
  { name: 'Havet', theme: 'hav', width: 17, height: 15 },
  { name: 'Savannen', theme: 'savanne', width: 17, height: 13 },
];

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function floorNeighbourCount(floors, x, y) {
  return DIRS.filter(([dx, dy]) => floors.has(`${x + dx},${y + dy}`)).length;
}

// Breadth-first distances from `from` across all floor cells. Doors are open
// by definition here: every door can be solved, so the world a child can
// ultimately explore is the whole floor grid.
function distances(floors, from) {
  const dist = new Map([[`${from.x},${from.y}`, 0]]);
  const queue = [{ ...from }];
  while (queue.length > 0) {
    const cell = queue.shift();
    const d = dist.get(`${cell.x},${cell.y}`);
    for (const [dx, dy] of DIRS) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      const key = `${nx},${ny}`;
      if (!floors.has(key) || dist.has(key)) continue;
      dist.set(key, d + 1);
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}

export function generateMaze({ name, theme, width = 17, height = 13, random = Math.random }) {
  // ---- Carve a perfect maze with the recursive backtracker -----------------
  const floors = new Set();
  const start = { x: 1, y: 1 };
  floors.add('1,1');
  const stack = [{ ...start }];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const options = shuffled(DIRS, random).filter(([dx, dy]) => {
      const nx = current.x + dx * 2;
      const ny = current.y + dy * 2;
      return nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && !floors.has(`${nx},${ny}`);
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[0];
    const mid = { x: current.x + dx, y: current.y + dy };
    const far = { x: current.x + dx * 2, y: current.y + dy * 2 };
    floors.add(`${mid.x},${mid.y}`);
    floors.add(`${far.x},${far.y}`);
    stack.push(far);
  }

  // ---- Braid: remove a handful of walls to create loops --------------------
  // Only wall cells that separate two floors count, so every removal opens a
  // genuine shortcut instead of a pocked blob.
  const wallCandidates = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (floors.has(`${x},${y}`)) continue;
      if (floorNeighbourCount(floors, x, y) >= 2) wallCandidates.push({ x, y });
    }
  }
  const braidCount = Math.max(4, Math.floor(wallCandidates.length * 0.12));
  for (const wall of shuffled(wallCandidates, random).slice(0, braidCount)) {
    floors.add(`${wall.x},${wall.y}`);
  }

  // ---- Exit: the floor cell farthest from the start ------------------------
  const dist = distances(floors, start);
  let exit = { ...start };
  let best = -1;
  dist.forEach((d, key) => {
    if (d > best) {
      best = d;
      const [x, y] = key.split(',').map(Number);
      exit = { x, y };
    }
  });

  // ---- Doors: spelling locks scattered along the corridors -----------------
  // Doors sit on ordinary floor cells with floor on at least two sides, never
  // on the start or exit, never right next to either, and never adjacent to
  // each other (solving door after door with no walking between would be
  // gruelling). Target ~7 for the current grid sizes.
  const targetDoors = Math.max(5, Math.round((width + height) / 4) - 1); // 17+13 -> 7
  const pool = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const key = `${x},${y}`;
      if (!floors.has(key)) continue;
      if (manhattan({ x, y }, start) < 3) continue; // keep the first steps free
      if (manhattan({ x, y }, exit) < 2) continue;  // a clear run-in to the exit
      if (floorNeighbourCount(floors, x, y) < 2) continue;
      pool.push({ x, y });
    }
  }
  const doors = [];
  for (const candidate of shuffled(pool, random)) {
    if (doors.length >= targetDoors) break;
    if (!doors.some((door) => manhattan(door, candidate) === 1)) doors.push({ x: candidate.x, y: candidate.y });
  }

  return { name, theme, width, height, floors, doors, start, exit };
}
