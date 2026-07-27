import { describe, expect, it } from 'vitest';
import { boardCoordinateToBrowserCanvasPoint } from '../../../src/game/presentation/testing/browserCanvasGeometry';

describe('boardCoordinateToBrowserCanvasPoint', () => {
  const geometry = {
    logicalCanvasWidth: 960,
    logicalCanvasHeight: 540,
    boardX: 32,
    boardY: 44,
    cellSize: 50,
    rows: 8,
    columns: 8,
  };

  it('maps top-left and bottom-right board cells for a desktop canvas', () => {
    expect(
      boardCoordinateToBrowserCanvasPoint({
        coordinate: { row: 0, column: 0 },
        geometry,
        canvasBounds: { width: 960, height: 540 },
      }),
    ).toEqual({ x: 57, y: 69 });
    expect(
      boardCoordinateToBrowserCanvasPoint({
        coordinate: { row: 7, column: 7 },
        geometry,
        canvasBounds: { width: 960, height: 540 },
      }),
    ).toEqual({ x: 407, y: 419 });
  });

  it('scales logical board coordinates to a portrait mobile canvas', () => {
    expect(
      boardCoordinateToBrowserCanvasPoint({
        coordinate: { row: 7, column: 7 },
        geometry,
        canvasBounds: { width: 480, height: 270 },
      }),
    ).toEqual({ x: 203.5, y: 209.5 });
  });

  it('rejects coordinates outside the board', () => {
    expect(() =>
      boardCoordinateToBrowserCanvasPoint({
        coordinate: { row: 8, column: 0 },
        geometry,
        canvasBounds: { width: 960, height: 540 },
      }),
    ).toThrow('outside browser geometry');
  });
});
