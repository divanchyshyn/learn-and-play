import { describe, it, expect } from 'vitest';
import { MAZES } from './mazes.js';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function reachableCells(maze, isPassable) {
  const seen = new Set([`${maze.start.x},${maze.start.y}`]);
  const queue = [[maze.start.x, maze.start.y]];
  while (queue.length > 0) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (isPassable(nx, ny) && !seen.has(key)) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

describe('lyd-labyrint maze collection', () => {
  it('ships at least three mazes with 3–6 junctions each', () => {
    expect(MAZES.length).toBeGreaterThanOrEqual(3);
    for (const maze of MAZES) {
      const junctions = maze.doors.filter((door) => door.ok).length;
      expect(junctions, `${maze.name} junction count`).toBeGreaterThanOrEqual(3);
      expect(junctions, `${maze.name} junction count`).toBeLessThanOrEqual(6);
      expect(maze.doors.length, `${maze.name} door pairing`).toBe(junctions * 2);
    }
  });
});

for (const maze of MAZES) {
  describe(`lyd-labyrint maze: ${maze.name}`, () => {
    it('has a start and an exit on distinct floor cells', () => {
      expect(maze.start).toBeTruthy();
      expect(maze.exit).toBeTruthy();
      expect(maze.floors.has(`${maze.start.x},${maze.start.y}`)).toBe(true);
      expect(maze.floors.has(`${maze.exit.x},${maze.exit.y}`)).toBe(true);
      expect(maze.start).not.toEqual(maze.exit);
    });

    it('can reach every floor cell from the start', () => {
      const seen = reachableCells(maze, (x, y) => maze.floors.has(`${x},${y}`));
      expect(seen.size).toBe(maze.floors.size);
    });

    it('reaches the exit while wrong doors stay closed – no detours possible', () => {
      const seen = reachableCells(maze, (x, y) => {
        if (!maze.floors.has(`${x},${y}`)) return false;
        const door = maze.doors.find((d) => d.x === x && d.y === y);
        return !door || door.ok;
      });
      expect(seen.has(`${maze.exit.x},${maze.exit.y}`)).toBe(true);
    });

    it('makes every bounce-back door a one-cell stub', () => {
      for (const door of maze.doors.filter((d) => !d.ok)) {
        const openNeighbours = DIRS.filter(([dx, dy]) =>
          maze.floors.has(`${door.x + dx},${door.y + dy}`)).length;
        expect(openNeighbours, `bounce-back door at ${door.x},${door.y}`).toBe(1);
      }
    });

    it('keeps every correct door connected on both sides', () => {
      for (const door of maze.doors.filter((d) => d.ok)) {
        const openNeighbours = DIRS.filter(([dx, dy]) =>
          maze.floors.has(`${door.x + dx},${door.y + dy}`)).length;
        expect(openNeighbours, `correct door at ${door.x},${door.y}`).toBeGreaterThanOrEqual(2);
      }
    });

    it('places every door on a floor cell', () => {
      for (const door of maze.doors) {
        expect(maze.floors.has(`${door.x},${door.y}`), `door at ${door.x},${door.y}`).toBe(true);
      }
    });
  });
}
