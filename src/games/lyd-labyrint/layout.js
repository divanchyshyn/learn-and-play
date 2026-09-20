// Board sizing for Lyd-labyrinten. The component hands these numbers to the
// stylesheet as custom properties and computes the maze cell size from the
// live viewport, so the board always fits the space it actually has:
//
// - beside the direction pad on screens from 700px up, where the pad's column
//   (three 64px keys plus two 9px gaps) and the column gap are subtracted from
//   the page width before the cell size is worked out, and
// - with the pad stacked underneath on narrower screens, where the vertical
//   budget grows by the pad's height.
//
// The old stylesheet reserved a hard-coded 170px for the side controls while
// the pad really takes 210px plus the gap, so wide screens ended up with the
// maze sliding underneath the direction pad. Keeping the arithmetic in one
// place and covering it with tests makes that class of bug impossible to
// reintroduce.

export const PAGE_MAX_WIDTH = 900;
export const PAGE_GUTTER = 28;
export const PAD_SIZE = 64;
export const PAD_GAP = 9;
export const PAD_COLUMN = PAD_SIZE * 3 + PAD_GAP * 2;
export const SIDE_BY_SIDE_MIN_WIDTH = 700;
export const BOARD_BORDER = 8;
export const BOARD_MIN_CELL = 21;
export const BOARD_MAX_CELL = 66;

// Breathing room kept between the board and the page edges.
const BOARD_MARGIN = 10;
// Vertical gap between the rows of the stage; mirrors the `.labyrinth-stage`
// `gap` in style.css.
const STAGE_GAP = 18;
// Room the page chrome needs above and below the board: page padding, the
// compact header, the control chip row and the gaps between them. Deliberately
// roomy so the maze never needs a scroll on a tablet.
const PAGE_PADDING_TOP = 18;
const HEADER_HEIGHT = 110;
const CONTROLS_HEIGHT = 40;
const PAGE_PADDING_BOTTOM = 38;

// The stage column gap mirrors `clamp(16px, 3vw, 28px)` in style.css.
export function stageColumnGap(viewportWidth) {
  return Math.min(28, Math.max(16, viewportWidth * 0.03));
}

export function isSideBySide(viewportWidth) {
  return viewportWidth >= SIDE_BY_SIDE_MIN_WIDTH;
}

export function pageChromeHeight(viewportWidth) {
  const base = PAGE_PADDING_TOP + HEADER_HEIGHT + STAGE_GAP + CONTROLS_HEIGHT + PAGE_PADDING_BOTTOM;
  return isSideBySide(viewportWidth) ? base : base + PAD_COLUMN + STAGE_GAP;
}

export function boardCellSize(viewportWidth, viewportHeight, columns, rows) {
  const sideReserve = isSideBySide(viewportWidth)
    ? PAD_COLUMN + stageColumnGap(viewportWidth)
    : 0;
  const pageWidth = Math.min(viewportWidth - PAGE_GUTTER, PAGE_MAX_WIDTH);
  const widthBudget = pageWidth - sideReserve - BOARD_BORDER - BOARD_MARGIN;
  const heightBudget = viewportHeight - pageChromeHeight(viewportWidth) - BOARD_BORDER;
  const cell = Math.min(widthBudget / columns, heightBudget / rows, BOARD_MAX_CELL);
  return Math.max(BOARD_MIN_CELL, Math.floor(cell));
}

export function boardLayout(viewportWidth, viewportHeight, columns, rows) {
  return {
    sideBySide: isSideBySide(viewportWidth),
    columnGap: stageColumnGap(viewportWidth),
    cell: boardCellSize(viewportWidth, viewportHeight, columns, rows),
  };
}
