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
}

function createRectangle(x: number, y: number, width: number, height: number): Rectangle {
  return { x, y, width, height };
}

function calculatePortraitLayout(
  width: number,
  height: number,
  rows: number,
  columns: number,
): PuzzleLayout {
  const padding = Math.max(18, Math.floor(Math.min(width, height) * 0.035));
  const gutter = Math.max(14, Math.floor(padding * 0.7));
  const footerHeight = Math.max(124, Math.floor(height * 0.17));
  const hudHeight = Math.max(136, Math.min(210, Math.floor(height * 0.24)));

  const boardAreaHeight = height - padding * 2 - hudHeight - footerHeight - gutter * 2;
  const boardAreaWidth = width - padding * 2;
  const cellSize = Math.max(
    24,
    Math.floor(Math.min(boardAreaWidth / columns, boardAreaHeight / rows)),
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
  };
}

export function calculatePuzzleLayout(input: {
  width: number;
  height: number;
  rows: number;
  columns: number;
}): PuzzleLayout {
  const width = Math.max(320, Math.floor(input.width));
  const height = Math.max(320, Math.floor(input.height));
  const rows = input.rows;
  const columns = input.columns;

  const padding = Math.max(20, Math.floor(Math.min(width, height) * 0.035));
  const gutter = Math.max(16, Math.floor(padding * 0.8));
  const footerHeight = Math.max(124, Math.floor(height * 0.17));
  const preferredHudWidth = Math.max(250, Math.min(360, Math.floor(width * 0.28)));
  const maxBoardWidth = width - padding * 2 - preferredHudWidth - gutter;
  const maxBoardHeight = height - padding * 2 - footerHeight - gutter;
  const landscapeCellSize = Math.floor(Math.min(maxBoardWidth / columns, maxBoardHeight / rows));
  const usePortrait = width < height * 1.05;

  if (usePortrait) {
    return calculatePortraitLayout(width, height, rows, columns);
  }

  const cellSize = landscapeCellSize;
  const boardWidth = cellSize * columns;
  const boardHeight = cellSize * rows;
  const boardAreaWidth = width - padding * 2 - preferredHudWidth - gutter;
  const boardX = Math.floor(padding + Math.max(0, (boardAreaWidth - boardWidth) / 2));
  const boardY = Math.floor(padding + Math.max(0, (maxBoardHeight - boardHeight) / 2));
  const hudX = boardX + boardWidth + gutter;

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
    hudRect: createRectangle(hudX, padding, width - hudX - padding, height - padding * 2),
    footerRect: createRectangle(padding, boardY + boardHeight + gutter, boardWidth, footerHeight),
  };
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
