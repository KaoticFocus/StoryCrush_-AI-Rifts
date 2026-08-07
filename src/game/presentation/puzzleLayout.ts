import { type BoardCoordinate } from '../board';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PuzzleLayout {
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;
  rows: number;
  columns: number;
  padding: number;
  gutter: number;
  cellSize: number;
  boardRect: Rectangle;
  hudRect: Rectangle;
  footerRect: Rectangle;
  threatHudHeight: number;
}

function createRectangle(x: number, y: number, width: number, height: number): Rectangle {
  return { x, y, width, height };
}

/** Phone-class portrait widths: board should nearly fill safe width. */
function isPhonePortraitWidth(width: number): boolean {
  return width <= 500;
}

function isPhoneLandscape(width: number, height: number): boolean {
  return width > height && height <= 500;
}

/**
 * Phone portrait: prioritize playable grid width, then compact HUD/footer,
 * and only then reduce cell size when essential chrome cannot fit.
 */
function calculatePhonePortraitLayout(
  width: number,
  height: number,
  rows: number,
  columns: number,
  threatHudHeight: number,
): PuzzleLayout {
  // 6–10px side gutters; also reserves room for a thin Fantasy frame outside the grid.
  const sideGutter = Math.max(6, Math.min(10, Math.round(width * 0.022)));
  const regionGap = 6;
  const topPad = sideGutter;

  const shortPhone = height <= 640;
  // Short phones: shrink chrome floors before sacrificing board width fill.
  const minHudHeight = (shortPhone ? 70 : 84) + threatHudHeight;
  const preferredHudHeight = Math.min(
    (shortPhone ? 110 : 128) + threatHudHeight,
    Math.max(minHudHeight, Math.floor(height * (shortPhone ? 0.13 : 0.145)) + threatHudHeight),
  );
  // Two-column control grid; keep the floor low enough that 320×568 can still width-fill.
  const minFooterHeight = shortPhone ? 100 : 118;
  const preferredFooterHeight = Math.min(
    shortPhone ? 128 : 148,
    Math.max(minFooterHeight, Math.floor(height * (shortPhone ? 0.145 : 0.16))),
  );

  const widthCell = Math.max(24, Math.floor((width - sideGutter * 2) / columns));

  let hudHeight = preferredHudHeight;
  let footerHeight = preferredFooterHeight;
  let cellSize = widthCell;

  const verticalChrome = (hud: number, footer: number) =>
    topPad + hud + regionGap + regionGap + footer + topPad;

  let availableBoardHeight = height - verticalChrome(hudHeight, footerHeight);
  let boardHeight = cellSize * rows;

  if (boardHeight > availableBoardHeight) {
    const deficit = boardHeight - availableBoardHeight;
    const hudShrink = Math.min(deficit, Math.max(0, hudHeight - minHudHeight));
    hudHeight -= hudShrink;
    const still = deficit - hudShrink;
    const footerShrink = Math.min(still, Math.max(0, footerHeight - minFooterHeight));
    footerHeight -= footerShrink;
    availableBoardHeight = height - verticalChrome(hudHeight, footerHeight);
    boardHeight = cellSize * rows;
  }

  if (boardHeight > availableBoardHeight) {
    cellSize = Math.max(24, Math.floor(Math.min(widthCell, availableBoardHeight / rows)));
    availableBoardHeight = height - verticalChrome(hudHeight, footerHeight);
  }

  const boardWidth = cellSize * columns;
  boardHeight = cellSize * rows;
  const boardX = Math.floor((width - boardWidth) / 2);
  const boardAreaTop = topPad + hudHeight + regionGap;
  const boardY = Math.floor(boardAreaTop + Math.max(0, (availableBoardHeight - boardHeight) / 2));
  const footerY = Math.min(boardY + boardHeight + regionGap, height - topPad - footerHeight);

  return {
    orientation: 'portrait',
    viewportWidth: width,
    viewportHeight: height,
    rows,
    columns,
    padding: sideGutter,
    gutter: regionGap,
    cellSize,
    boardRect: createRectangle(boardX, boardY, boardWidth, boardHeight),
    hudRect: createRectangle(sideGutter, topPad, width - sideGutter * 2, hudHeight),
    footerRect: createRectangle(sideGutter, footerY, width - sideGutter * 2, footerHeight),
    threatHudHeight,
  };
}

/** Tablet portrait: balanced composition with an intentional board max width. */
function calculateTabletPortraitLayout(
  width: number,
  height: number,
  rows: number,
  columns: number,
  threatHudHeight: number,
): PuzzleLayout {
  const padding = Math.max(20, Math.floor(Math.min(width, height) * 0.03));
  const gutter = Math.max(12, Math.floor(padding * 0.65));
  const footerHeight = Math.max(120, Math.floor(height * 0.14));
  const hudHeight = Math.max(120, Math.min(200, Math.floor(height * 0.18))) + threatHudHeight;

  const boardAreaHeight = height - padding * 2 - hudHeight - footerHeight - gutter * 2;
  // Cap width utilization so tablet boards do not stretch edge-to-edge.
  const maxBoardWidth = Math.min(width - padding * 2, Math.floor(width * 0.72), 640);
  const cellSize = Math.max(
    24,
    Math.floor(Math.min(maxBoardWidth / columns, boardAreaHeight / rows, 72)),
  );

  const boardWidth = cellSize * columns;
  const boardHeight = cellSize * rows;
  const boardX = Math.floor((width - boardWidth) / 2);
  const boardAreaTop = padding + hudHeight + gutter;
  const boardY = Math.floor(boardAreaTop + Math.max(0, (boardAreaHeight - boardHeight) / 2));

  return {
    orientation: 'portrait',
    viewportWidth: width,
    viewportHeight: height,
    rows,
    columns,
    padding,
    gutter,
    cellSize,
    boardRect: createRectangle(boardX, boardY, boardWidth, boardHeight),
    hudRect: createRectangle(padding, padding, width - padding * 2, hudHeight),
    footerRect: createRectangle(
      padding,
      boardY + boardHeight + gutter,
      width - padding * 2,
      footerHeight,
    ),
    threatHudHeight,
  };
}

function calculatePortraitLayout(
  width: number,
  height: number,
  rows: number,
  columns: number,
  threatHudHeight: number,
): PuzzleLayout {
  if (isPhonePortraitWidth(width)) {
    return calculatePhonePortraitLayout(width, height, rows, columns, threatHudHeight);
  }
  return calculateTabletPortraitLayout(width, height, rows, columns, threatHudHeight);
}

function calculateLandscapeLayout(
  width: number,
  height: number,
  rows: number,
  columns: number,
  threatHudHeight: number,
): PuzzleLayout {
  const phone = isPhoneLandscape(width, height);
  const padding = phone
    ? Math.max(8, Math.floor(Math.min(width, height) * 0.02))
    : Math.max(20, Math.floor(Math.min(width, height) * 0.035));
  const gutter = phone
    ? Math.max(8, Math.floor(padding * 0.8))
    : Math.max(16, Math.floor(padding * 0.8));
  const footerHeight = phone
    ? Math.max(72, Math.min(100, Math.floor(height * 0.2)))
    : Math.max(124, Math.floor(height * 0.17));
  const preferredHudWidth = phone
    ? Math.max(168, Math.min(220, Math.floor(width * 0.26)))
    : Math.max(250, Math.min(360, Math.floor(width * 0.28)));
  const maxBoardWidth = width - padding * 2 - preferredHudWidth - gutter;
  const maxBoardHeight = height - padding * 2 - footerHeight - gutter;
  // Desktop/tablet landscape: keep an intentional board ceiling.
  const cellCap = phone ? 96 : 68;
  const cellSize = Math.max(
    24,
    Math.floor(Math.min(maxBoardWidth / columns, maxBoardHeight / rows, cellCap)),
  );

  const boardWidth = cellSize * columns;
  const boardHeight = cellSize * rows;
  const boardAreaWidth = width - padding * 2 - preferredHudWidth - gutter;
  const boardX = Math.floor(padding + Math.max(0, (boardAreaWidth - boardWidth) / 2));
  const boardY = Math.floor(padding + Math.max(0, (maxBoardHeight - boardHeight) / 2));
  const hudX = boardX + boardWidth + gutter;
  const hudHeight = height - padding * 2;

  return {
    orientation: 'landscape',
    viewportWidth: width,
    viewportHeight: height,
    rows,
    columns,
    padding,
    gutter,
    cellSize,
    boardRect: createRectangle(boardX, boardY, boardWidth, boardHeight),
    hudRect: createRectangle(hudX, padding, Math.max(120, width - hudX - padding), hudHeight),
    footerRect: createRectangle(
      padding,
      boardY + boardHeight + gutter,
      width - padding * 2,
      footerHeight,
    ),
    threatHudHeight,
  };
}

export function calculatePuzzleLayout(input: {
  width: number;
  height: number;
  rows: number;
  columns: number;
  threatHudHeight?: number;
}): PuzzleLayout {
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const rows = input.rows;
  const columns = input.columns;
  const threatHudHeight = Math.max(0, Math.floor(input.threatHudHeight ?? 0));
  const usePortrait = width < height * 1.05;

  if (usePortrait) {
    return calculatePortraitLayout(width, height, rows, columns, threatHudHeight);
  }

  return calculateLandscapeLayout(width, height, rows, columns, threatHudHeight);
}

export function getBoardCellBounds(layout: PuzzleLayout, coordinate: BoardCoordinate): Rectangle {
  return {
    x: layout.boardRect.x + coordinate.column * layout.cellSize,
    y: layout.boardRect.y + coordinate.row * layout.cellSize,
    width: layout.cellSize,
    height: layout.cellSize,
  };
}

export function boardCoordinateToScreenPosition(
  layout: PuzzleLayout,
  coordinate: BoardCoordinate,
): { x: number; y: number } {
  const bounds = getBoardCellBounds(layout, coordinate);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function screenPositionToBoardCoordinate(
  layout: PuzzleLayout,
  point: { x: number; y: number },
): BoardCoordinate | null {
  const localX = point.x - layout.boardRect.x;
  const localY = point.y - layout.boardRect.y;

  if (
    localX < 0 ||
    localY < 0 ||
    localX >= layout.boardRect.width ||
    localY >= layout.boardRect.height
  ) {
    return null;
  }

  return {
    row: Math.min(layout.rows - 1, Math.floor(localY / layout.cellSize)),
    column: Math.min(layout.columns - 1, Math.floor(localX / layout.cellSize)),
  };
}
