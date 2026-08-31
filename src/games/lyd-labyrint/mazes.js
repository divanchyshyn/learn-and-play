// Lyd-labyrinten's mazes are carved fresh for every new game with randomized
// Kruskal's algorithm. The result is a "perfect" maze - a spanning tree on the
// cell grid - so there is exactly one route from the start to the exit and
// every corridor that is not the way out ends in a real dead end. No loops,
// no shortcuts, so choosing the wrong branch costs a little exploring and the
// exit keeps a single, satisfying way in.
//
// Doors are spelling locks (see LydLabyrint.jsx). They ride two kinds of
// corridors: the one way to the exit, and the maze's dead ends. Keeping the
// route's locks and giving the wings the same number means the doors no longer
// outline the right path - every dead end can hide a spelling puzzle too.
//
// A maze is generated with an injectable `random` (defaults to Math.random),
// so tests can pin it and stay deterministic, while every fresh maze still
// feels brand new in the browser.
//
// Map legend (what the generator carves):
//   #  wall          .  floor
//   S  start (1,1)   X  exit (farthest floor cell from the start)
//   D  a door cell - spelling locks ride the way out and the dead ends alike

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

// The single path between two floor cells. The maze is a tree, so BFS finds
// exactly one path; used to choose the exit and to place the doors on the way.
// Exported so the maze tests can verify doors ride this same route.
export function uniquePath(floors, from, to) {
  const prev = new Map([[`${from.x},${from.y}`, null]]);
  const queue = [{ ...from }];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell.x === to.x && cell.y === to.y) break;
    for (const [dx, dy] of DIRS) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      const key = `${nx},${ny}`;
      if (!floors.has(key) || prev.has(key)) continue;
      prev.set(key, cell);
      queue.push({ x: nx, y: ny });
    }
  }
  const route = [];
  const endKey = `${to.x},${to.y}`;
  const startKey = `${from.x},${from.y}`;
  let key = endKey;
  while (key) {
    const [x, y] = key.split(',').map(Number);
    route.unshift({ x, y });
    if (key === startKey) break;
    const parent = prev.get(key);
    key = parent ? `${parent.x},${parent.y}` : '';
  }
  return route;
}
export function generateMaze({ name, theme, width = 17, height = 13, random = Math.random }) {
  // Cells live on the odd grid points; the passage between two neighbouring
  // cells sits on the even point in between. Carving a maze means deciding
  // which passages stay open until every cell is connected.
  const colCount = (width - 1) / 2;  // cells per row, e.g. 8 for a 17-wide board
  const rowCount = (height - 1) / 2; // cells per column, e.g. 6 for a 13-tall board
  const start = { x: 1, y: 1 };
  const cellIndex = (i, j) => j * colCount + i;

  // Union-find for Kruskal: which cells are already connected?
  const parent = [];
  const rank = [];
  for (let index = 0; index < colCount * rowCount; index += 1) {
    parent[index] = index;
    rank[index] = 0;
  }
  function find(cell) {
    let a = cell;
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  }
  function join(a, b) {
    let rootA = find(a);
    let rootB = find(b);
    if (rootA === rootB) return false;
    if (rank[rootA] < rank[rootB]) [rootA, rootB] = [rootB, rootA];
    if (rank[rootA] === rank[rootB]) rank[rootA] += 1;
    parent[rootB] = rootA;
    return true;
  }

  // Every cell is floor; every passage between cells starts as a wall.
  const floors = new Set();
  for (let i = 0; i < colCount; i += 1) {
    for (let j = 0; j < rowCount; j += 1) {
      floors.add(`${2 * i + 1},${2 * j + 1}`);
    }
  }

  // ---- randomized Kruskal: open passages in random order ---------------------
  // A passage is opened only when it would join two unconnected parts, never
  // when it would close a loop, so the result is a spanning tree: a "perfect"
  // maze with exactly one path between any two cells. In maze terms: one way
  // to the exit, and every wrong turn ends at a wall - a real dead end.
  const passages = [];
  for (let j = 0; j < rowCount; j += 1) {
    for (let i = 0; i < colCount; i += 1) {
      if (i + 1 < colCount) {
        // Passage to the cell on the right.
        passages.push({ x: 2 * i + 2, y: 2 * j + 1, from: cellIndex(i, j), to: cellIndex(i + 1, j) });
      }
      if (j + 1 < rowCount) {
        // Passage to the cell below.
        passages.push({ x: 2 * i + 1, y: 2 * j + 2, from: cellIndex(i, j), to: cellIndex(i, j + 1) });
      }
    }
  }
  for (const passage of shuffled(passages, random)) {
    if (join(passage.from, passage.to)) floors.add(`${passage.x},${passage.y}`);
  }

  // ---- Exit: the cell farthest from the start -------------------------------
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

  // ---- Doors: spelling locks across the whole maze --------------------------
  // The way out keeps its locks: the ones on the single start-to-exit route
  // (away from the first steps and the exit itself) move the game forward.
  // The maze's dead ends get the same amount on top, so the doors no longer
  // outline the right path - a locked wing of the maze is just as worth
  // exploring as the corridor that leads out.
  const targetDoors = Math.max(5, Math.round((width + height) / 4) - 1); // 17+13 -> 7
  const nearStart = (cell) => manhattan(cell, start) < 3;
  const nearExit = (cell) => manhattan(cell, exit) < 2;

  const route = uniquePath(floors, start, exit);
  const routePool = route.filter((cell) => !nearStart(cell) && !nearExit(cell));
  const routeKeys = new Set(routePool.map((cell) => `${cell.x},${cell.y}`));

  // Dead-end pools: first the true culs-de-sac - the floor cells with exactly
  // one neighbour, the tips a child reaches by following a wrong branch. A
  // second pool of deeper off-route corners is a safety net for mazes with
  // unusually few tips, so the dead ends can always hold their locks.
  const deadEndPool = [];
  const branchPool = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const key = `${x},${y}`;
      if (!floors.has(key) || routeKeys.has(key)) continue;
      if (nearStart({ x, y }) || nearExit({ x, y })) continue;
      const neighbours = floorNeighbourCount(floors, x, y);
      if (neighbours === 1) {
        deadEndPool.push({ x, y });
      } else if (neighbours >= 2 && x % 2 === 1 && y % 2 === 1) {
        branchPool.push({ x, y });
      }
    }
  }

  const doors = [];
  function placeDoors(pool, max) {
    for (const candidate of shuffled(pool, random)) {
      if (doors.length >= max) break;
      // Never two doors next to each other: solving door after door with no
      // walking in between would be gruelling.
      if (doors.some((door) => manhattan(door, candidate) === 1)) continue;
      doors.push({ x: candidate.x, y: candidate.y });
    }
  }

  // The right path keeps its current amount of locks...
  placeDoors(routePool, targetDoors);
  const routeDoors = doors.length;
  // ...and the dead ends get the same amount on top.
  placeDoors(deadEndPool, routeDoors * 2);
  placeDoors(branchPool, routeDoors * 2);

  return { name, theme, width, height, floors, doors, start, exit };
}