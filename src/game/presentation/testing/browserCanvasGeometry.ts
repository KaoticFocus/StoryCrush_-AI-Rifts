import { type BoardCoordinate } from '../../board';

export interface BrowserBoardGeometry {
  logicalCanvasWidth: number;
  logicalCanvasHeight: number;
  boardX: number;
  boardY: number;
  cellSize: number;
  rows: number;
  columns: number;
}

export interface BrowserCanvasBounds {
  width: number;
  height: number;
}

export function boardCoordinateToBrowserCanvasPoint(input: {
  coordinate: BoardCoordinate;
  geometry: BrowserBoardGeometry;
  canvasBounds: BrowserCanvasBounds;
}): { x: number; y: number } {
  const { coordinate, geometry, canvasBounds } = input;
  if (
    coordinate.row < 0 ||
    coordinate.row >= geometry.rows ||
    coordinate.column < 0 ||
    coordinate.column >= geometry.columns
  ) {
    throw new Error(
      `board coordinate is outside browser geometry: ${coordinate.row}:${coordinate.column}`,
    );
  }

  const logicalX = geometry.boardX + (coordinate.column + 0.5) * geometry.cellSize;
  const logicalY = geometry.boardY + (coordinate.row + 0.5) * geometry.cellSize;
  return {
    x: (logicalX / geometry.logicalCanvasWidth) * canvasBounds.width,
    y: (logicalY / geometry.logicalCanvasHeight) * canvasBounds.height,
  };
}
