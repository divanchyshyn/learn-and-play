// Lyd-labyrinten's mazes are carved fresh for every new game with randomized
// Kruskal's algorithm. The result is a "perfect" maze - a spanning tree on the
// cell grid - so there is exactly one route from the start to the exit and
// every corridor that is not the way out ends in a real dead end. No loops,
// no shortcuts, so choosing the wrong branch costs a little exploring and the
// exit keeps a single, satisfying way in.
//
// Doors are spelling locks (see LydLabyrint.jsx). They ride two kinds of
// corridors: the one way to the exit, and the maze's dead ends. The way out
// carries at most five locks; the dead-end branches wear the same number on
// top - spread along their corridors, not pinned to the far wall - so the
// doors never outline the correct route: every dead end can hide a spelling
// puzzle too.
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
  // The way out keeps at most five locks - spelling every door on a long route
  // would drag, and fewer locks make the pathway harder to trace. The maze's
  // dead-end branches get the same count on top, spread along their corridors
  // (resting mid-corridor, not just pinned against the far wall), so the doors
  // never outline the correct route: a locked wing is just as worth exploring
  // as the corridor that leads out.
  const routeDoorMax = 5;
  const nearStart = (cell) => manhattan(cell, start) < 3;
  const nearExit = (cell) => manhattan(cell, exit) < 2;

  const route = uniquePath(floors, start, exit);
  const routePool = route.filter((cell) => !nearStart(cell) && !nearExit(cell));
  // The full route is the spine the dead-end branches hang off of.
  const routeKeys = new Set(route.map((cell) => `${cell.x},${cell.y}`));

  // Collect every off-route floor cell that may hold a lock, then group them
  // into branches: each connected shape hangs off the route at exactly one
  // point and runs out into a cul-de-sac. Branch length varies, so a branch
  // with room to explore can hide its lock anywhere along its corridor.
  const offRouteKeys = new Set();
  const offRouteCells = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const key = `${x},${y}`;
      if (!floors.has(key) || routeKeys.has(key)) continue;
      if (nearStart({ x, y }) || nearExit({ x, y })) continue;
      offRouteKeys.add(key);
      offRouteCells.push({ x, y });
    }
  }

  function branchComponents() {
    const components = [];
    const seen = new Set();
    for (const cell of offRouteCells) {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const component = [cell];
      const queue = [{ ...cell }];
      while (queue.length > 0) {
        const current = queue.pop();
        for (const [dx, dy] of DIRS) {
          const nextKey = `${current.x + dx},${current.y + dy}`;
          if (!offRouteKeys.has(nextKey) || seen.has(nextKey)) continue;
          seen.add(nextKey);
          const next = { x: current.x + dx, y: current.y + dy };
          component.push(next);
          queue.push(next);
        }
      }
      components.push(component);
    }
    return components;
  }

  // The corridor depth of every cell in one branch, measured from the cell
  // that touches the route. Depth 0 is the junction with the way out; the
  // deepest cells are the cul-de-sac tips against the outer wall. Returned as
  // a list of depth layers so a lock can be spread along the whole branch.
  function branchDepthLayers(component) {
    const entry = component.find((cell) =>
      DIRS.some(([dx, dy]) => routeKeys.has(`${cell.x + dx},${cell.y + dy}`)));

    if (!entry) return [];
    const layers = [[entry]];
    const depth = new Map([[`${entry.x},${entry.y}`, 0]]);
    const queue = [{ ...entry }];
    while (queue.length > 0) {
      const cell = queue.shift();
      const cellDepth = depth.get(`${cell.x},${cell.y}`);
      for (const [dx, dy] of DIRS) {
        const key = `${cell.x + dx},${cell.y + dy}`;
        if (!offRouteKeys.has(key) || depth.has(key)) continue;
        depth.set(key, cellDepth + 1);
        if (!layers[cellDepth + 1]) layers[cellDepth + 1] = [];
        layers[cellDepth + 1].push({ x: cell.x + dx, y: cell.y + dy });
        queue.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
    return layers;
  }

  // Pick a lock position inside one branch: skip the junction cell itself (a
  // door right on the way out would read as part of it) and choose a random
  // depth, so locks rest in the middle of a corridor just as often as at a
  // branch's far end - never only against the wall.
  function pickBranchSpot(component) {
    const layers = branchDepthLayers(component);
    const maxDepth = layers.length - 1;
    if (maxDepth < 1) return null;
    const depth = 1 + Math.floor(random() * maxDepth);
    const cellsAtDepth = layers[depth];
    return cellsAtDepth[Math.floor(random() * cellsAtDepth.length)];
  }

  const doors = [];
  function canPlace(candidate) {
    // Never two doors next to each other: solving door after door with no
    // walking in between would be gruelling.
    return !doors.some((door) => manhattan(door, candidate) === 1);
  }

  function placeDoors(pool, max) {
    for (const candidate of shuffled(pool, random)) {
      if (doors.length >= max) break;
      if (!canPlace(candidate)) continue;
      doors.push({ x: candidate.x, y: candidate.y });
    }
  }

  // The right path keeps at most routeDoorMax locks, one per playable stretch...
  placeDoors(routePool, routeDoorMax);
  const routeDoors = doors.length;
  const targetTotal = routeDoors * 2;

  // ...and the dead-end branches get the same count on top, one lock spread
  // along each branch's corridor. If a maze sprouts fewer branches than locks,
  // leftover corridor cells fill the gap.
  for (const component of shuffled(branchComponents(), random)) {
    if (doors.length >= targetTotal) break;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const spot = pickBranchSpot(component);
      if (!spot) break;
      if (canPlace(spot)) {
        doors.push({ x: spot.x, y: spot.y });
        break;
      }
    }
  }
  if (doors.length < targetTotal) {
    const leftovers = offRouteCells
      .filter((cell) => !doors.some((door) => door.x === cell.x && door.y === cell.y));
    for (const candidate of shuffled(leftovers, random)) {
      if (doors.length >= targetTotal) break;
      if (!canPlace(candidate)) continue;
      doors.push({ x: candidate.x, y: candidate.y });
    }
  }

  return { name, theme, width, height, floors, doors, start, exit };
}
