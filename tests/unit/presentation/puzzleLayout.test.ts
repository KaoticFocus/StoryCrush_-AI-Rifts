import { describe, expect, it } from 'vitest';
import {
  boardCoordinateToScreenPosition,
  calculatePuzzleLayout,
  screenPositionToBoardCoordinate,
} from '../../../src/game/presentation/puzzleLayout';

describe('puzzleLayout', () => {
  it.each([
    [320, 568],
    [360, 800],
    [390, 844],
    [412, 915],
    [844, 390],
    [1280, 720],
    [1440, 900],
  ])('keeps the board, HUD, and footer inside %ix%i', (width, height) => {
    const layout = calculatePuzzleLayout({ width, height, rows: 8, columns: 8 });

    expect(layout.cellSize).toBeGreaterThanOrEqual(24);
    expect(layout.boardRect.x).toBeGreaterThanOrEqual(0);
    expect(layout.boardRect.y).toBeGreaterThanOrEqual(0);
    expect(layout.boardRect.x + layout.boardRect.width).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.boardRect.y + layout.boardRect.height).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.footerRect.y + layout.footerRect.height).toBeLessThanOrEqual(
      layout.viewportHeight,
    );
  });

  it('creates a centered portrait layout with non-overlapping HUD and board', () => {
    const layout = calculatePuzzleLayout({ width: 390, height: 844, rows: 8, columns: 8 });

    expect(layout.orientation).toBe('portrait');
    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.boardRect.y).toBeGreaterThanOrEqual(layout.hudRect.y + layout.hudRect.height);
    expect(layout.boardRect.x + layout.boardRect.width / 2).toBeCloseTo(
      layout.viewportWidth / 2,
      0,
    );
    expect(layout.boardRect.y + layout.boardRect.height).toBeLessThanOrEqual(layout.viewportHeight);
  });

  it('fits inside the reduced content area used by safe-area simulation', () => {
    const layout = calculatePuzzleLayout({ width: 296, height: 514, rows: 8, columns: 8 });

    expect(layout.viewportWidth).toBe(296);
    expect(layout.boardRect.x + layout.boardRect.width).toBeLessThanOrEqual(296);
    expect(layout.footerRect.y + layout.footerRect.height).toBeLessThanOrEqual(514);
  });

  it('creates a landscape layout that fits HUD and board without overlap', () => {
    const layout = calculatePuzzleLayout({ width: 1280, height: 720, rows: 8, columns: 8 });

    expect(layout.orientation).toBe('landscape');
    expect(layout.boardRect.x + layout.boardRect.width).toBeLessThanOrEqual(layout.hudRect.x);
    expect(layout.boardRect.height).toBe(layout.cellSize * 8);
    expect(layout.footerRect.y + layout.footerRect.height).toBeLessThanOrEqual(
      layout.viewportHeight,
    );
  });

  it('round-trips board coordinates through screen positions', () => {
    const layout = calculatePuzzleLayout({ width: 1024, height: 768, rows: 8, columns: 8 });
    const screen = boardCoordinateToScreenPosition(layout, { row: 3, column: 5 });

    expect(screenPositionToBoardCoordinate(layout, screen)).toEqual({ row: 3, column: 5 });
  });

  it('rejects outside-board positions and maps edge cells correctly', () => {
    const layout = calculatePuzzleLayout({ width: 800, height: 600, rows: 8, columns: 8 });

    expect(
      screenPositionToBoardCoordinate(layout, {
        x: layout.boardRect.x - 1,
        y: layout.boardRect.y + layout.cellSize / 2,
      }),
    ).toBeNull();

    expect(
      screenPositionToBoardCoordinate(layout, {
        x: layout.boardRect.x + layout.boardRect.width - 1,
        y: layout.boardRect.y + layout.boardRect.height - 1,
      }),
    ).toEqual({ row: 7, column: 7 });
  });
});
