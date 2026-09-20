import { describe, it, expect } from 'vitest';
import {
  BOARD_BORDER,
  BOARD_MAX_CELL,
  BOARD_MIN_CELL,
  PAGE_GUTTER,
  PAGE_MAX_WIDTH,
  PAD_COLUMN,
  boardCellSize,
  boardLayout,
  isSideBySide,
  pageChromeHeight,
  stageColumnGap,
} from './layout.js';

// The board and the direction pad share one row from 700px up. This mirrors
// what the CSS does with the values the component hands it, so a squeezed
// board plus the pad column can be checked against the page width directly.
function boardMetrics(viewportWidth, viewportHeight, columns, rows) {
  const layout = boardLayout(viewportWidth, viewportHeight, columns, rows);
  return {
    ...layout,
    pageWidth: Math.min(viewportWidth - PAGE_GUTTER, PAGE_MAX_WIDTH),
    sideReserve: layout.sideBySide ? PAD_COLUMN + layout.columnGap : 0,
    boardWidth: layout.cell * columns + BOARD_BORDER,
    boardHeight: layout.cell * rows + BOARD_BORDER,
  };
}

describe('sound-labyrinth board sizing', () => {
  it('keeps the maze clear of the direction pad on the desktop screen from the bug report', () => {
    const fit = boardMetrics(1167, 1078, 17, 13);
    expect(fit.sideBySide).toBe(true);
    expect(fit.boardWidth + fit.sideReserve).toBeLessThanOrEqual(fit.pageWidth);
    // The old hard-coded 170px reserve was smaller than the pad's real column
    // (three 64px keys and two 9px gaps), which let the board slide under it.
    expect(fit.sideReserve).toBeGreaterThanOrEqual(PAD_COLUMN);
    expect(fit.cell).toBeGreaterThanOrEqual(BOARD_MIN_CELL);
  });

  it('fits maze and pad together on every tablet width that switches to the side layout', () => {
    for (const width of [700, 768, 834, 1024]) {
      const fit = boardMetrics(width, 1024, 17, 13);
      expect(fit.sideBySide).toBe(true);
      expect(fit.boardWidth + fit.sideReserve).toBeLessThanOrEqual(fit.pageWidth);
    }
  });

  it('uses the full page width once the pad stacks underneath', () => {
    const fit = boardMetrics(430, 900, 17, 13);
    expect(fit.sideBySide).toBe(false);
    expect(fit.sideReserve).toBe(0);
    expect(fit.boardWidth).toBeLessThanOrEqual(fit.pageWidth);
  });

  it('keeps the board inside the vertical space so the controls stay on screen', () => {
    const fit = boardMetrics(1440, 620, 17, 13);
    expect(fit.cell).toBeGreaterThan(BOARD_MIN_CELL);
    expect(fit.cell).toBeLessThan(BOARD_MAX_CELL);
    expect(fit.boardHeight + pageChromeHeight(1440)).toBeLessThanOrEqual(620);
  });

  it('clamps tiny screens to the minimum cell and small mazes to the maximum', () => {
    expect(boardCellSize(320, 480, 17, 13)).toBe(BOARD_MIN_CELL);
    expect(boardCellSize(2400, 1600, 8, 6)).toBe(BOARD_MAX_CELL);
  });

  it('switches to the side-by-side layout exactly at the shared breakpoint', () => {
    expect(isSideBySide(699)).toBe(false);
    expect(isSideBySide(700)).toBe(true);
  });

  it('caps the gap between board and pad like the stylesheet clamp', () => {
    expect(stageColumnGap(390)).toBeCloseTo(16);
    expect(stageColumnGap(800)).toBeCloseTo(24);
    expect(stageColumnGap(2000)).toBeCloseTo(28);
  });
});
