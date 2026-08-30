import { describe, it, expect } from 'vitest';
import { THEMES, generateMaze } from './mazes.js';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const RANDOM = () => 0;

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reachable(floors, from) {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [{ ...from }];
  while (queue.length > 0) {
    const cell = queue.pop();
    for (const [dx, dy] of DIRS) {
      const key = `${cell.x + dx},${cell.y + dy}`;
      if (floors.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
  }
  return seen;
}

function distances(floors, from) {
  const dist = new Map([[`${from.x},${from.y}`, 0]]);
  const queue = [{ ...from }];
  while (queue.length > 0) {
    const cell = queue.shift();
    const d = dist.get(`${cell.x},${cell.y}`);
    for (const [dx, dy] of DIRS) {
      const key = `${cell.x + dx},${cell.y + dy}`;
      if (!floors.has(key) || dist.has(key)) continue;
      dist.set(key, d + 1);
      queue.push({ x: cell.x + dx, y: cell.y + dy });
    }
  }
  return dist;
}

describe('lyd-labyrint maze collection', () => {
  it('ships at least three themed habitats with fresh names', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(THEMES.map((t) => t.theme)).size).toBe(THEMES.length);
    expect(new Set(THEMES.map((t) => t.name)).size).toBe(THEMES.length);
  });

  for (const def of THEMES) {
    const maze = generateMaze({ ...def, random: RANDOM });

    describe(`lyd-labyrint maze: ${def.name}`, () => {
      it('has a start and a distinct exit on floor cells', () => {
        expect(maze.start).toEqual({ x: 1, y: 1 });
        expect(maze.floors.has('1,1')).toBe(true);
        expect(maze.floors.has(`${maze.exit.x},${maze.exit.y}`)).toBe(true);
        expect(maze.start).not.toEqual(maze.exit);
      });

      it('is a big play surface with real branching to explore', () => {
        expect(maze.floors.size).toBeGreaterThan(def.width * def.height * 0.28);
        let junctions = 0;
        for (const key of maze.floors) {
          const [x, y] = key.split(',').map(Number);
          const n = DIRS.filter(([dx, dy]) => maze.floors.has(`${x + dx},${y + dy}`)).length;
          if (n >= 3) junctions += 1;
        }
        expect(junctions).toBeGreaterThanOrEqual(3);
        expect(maze.doors.length).toBeGreaterThanOrEqual(5);
        expect(maze.doors.length).toBeLessThanOrEqual(8);
      });

      it('reaches every floor cell and the exit from the start', () => {
        const seen = reachable(maze.floors, maze.start);
        expect(seen.size).toBe(maze.floors.size);
        expect(seen.has(`${maze.exit.x},${maze.exit.y}`)).toBe(true);
      });

      it('spreads the doors as corridor locks, never traps', () => {
        for (const door of maze.doors) {
          expect(maze.floors.has(`${door.x},${door.y}`)).toBe(true);
          expect(manhattan(door, maze.start)).toBeGreaterThanOrEqual(3);
          expect(manhattan(door, maze.exit)).toBeGreaterThanOrEqual(2);
          const n = DIRS.filter(([dx, dy]) => maze.floors.has(`${door.x + dx},${door.y + dy}`)).length;
          expect(n).toBeGreaterThanOrEqual(2);
        }
        for (let i = 0; i < maze.doors.length; i += 1) {
          for (let j = i + 1; j < maze.doors.length; j += 1) {
            expect(manhattan(maze.doors[i], maze.doors[j])).not.toBe(1);
          }
        }
      });

      it('puts the exit at the farthest point from the start', () => {
        const dist = distances(maze.floors, maze.start);
        const max = Math.max(...dist.values());
        expect(dist.get(`${maze.exit.x},${maze.exit.y}`)).toBe(max);
        // The exit must genuinely take some exploring.
        expect(max).toBeGreaterThanOrEqual(12);
      });
    });
  }

  it('is deterministic under a fixed random source', () => {
    const a = generateMaze({ ...THEMES[2], random: () => 0.5 });
    const b = generateMaze({ ...THEMES[2], random: () => 0.5 });
    expect([...a.floors].sort()).toEqual([...b.floors].sort());
    expect(a.doors).toEqual(b.doors);
    expect(a.exit).toEqual(b.exit);
  });

  it('carves brand-new mazes when the world rotates', () => {
    const a = generateMaze({ ...THEMES[0], random: () => 0 });
    const b = generateMaze({ ...THEMES[0], random: () => 0.999 });
    let shared = 0;
    for (const key of a.floors) if (b.floors.has(key)) shared += 1;
    expect(shared).toBeLessThan(a.floors.size);
  });
});