import { describe, expect, it } from 'vitest';
import { Board } from '../../../src/game/board/Board';
import {
  getSpecialActivationEffect,
  resolveSpecialActivations,
} from '../../../src/game/board/specialActivation';
import {
  crossClearPiece,
  boardFromPieces,
  lineClearPiece,
  standardPiece,
  wildcardPiece,
} from './boardTestHelpers';

function coordsToKeys(coordinates: ReadonlyArray<{ row: number; column: number }>): string[] {
  return coordinates.map((coordinate) => `${coordinate.row},${coordinate.column}`);
}

describe('special activation effects', () => {
  it('line-clear horizontal affects complete row in deterministic order', () => {
    const board = boardFromPieces([
      [standardPiece('ruby'), standardPiece('sapphire'), standardPiece('emerald')],
      [standardPiece('topaz'), lineClearPiece('ruby', 'horizontal'), standardPiece('pearl')],
    ]);

    const result = getSpecialActivationEffect({ board, coordinate: { row: 1, column: 1 } });
    expect(result).toEqual([
      { row: 1, column: 0 },
      { row: 1, column: 1 },
      { row: 1, column: 2 },
    ]);
  });

  it('line-clear vertical affects complete column in deterministic order', () => {
    const board = boardFromPieces([
      [standardPiece('ruby'), lineClearPiece('sapphire', 'vertical')],
      [standardPiece('emerald'), standardPiece('topaz')],
      [standardPiece('amethyst'), standardPiece('pearl')],
    ]);

    const result = getSpecialActivationEffect({ board, coordinate: { row: 0, column: 1 } });
    expect(result).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 1 },
      { row: 2, column: 1 },
    ]);
  });

  it('cross-clear covers full row then column with center once', () => {
    const board = boardFromPieces([
      [crossClearPiece('ruby'), standardPiece('sapphire'), standardPiece('emerald')],
      [standardPiece('topaz'), standardPiece('amethyst'), standardPiece('pearl')],
      [standardPiece('ruby'), standardPiece('sapphire'), standardPiece('emerald')],
    ]);

    const result = getSpecialActivationEffect({ board, coordinate: { row: 0, column: 0 } });
    expect(result).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
    ]);
  });

  it('wildcard clears target type and includes itself', () => {
    const board = boardFromPieces([
      [wildcardPiece('ruby'), standardPiece('sapphire'), lineClearPiece('ruby', 'vertical')],
      [standardPiece('ruby'), crossClearPiece('emerald'), standardPiece('topaz')],
    ]);

    const result = getSpecialActivationEffect({
      board,
      coordinate: { row: 0, column: 0 },
      wildcardTarget: { mode: 'piece-type', pieceType: 'ruby' },
    });

    expect(coordsToKeys(result)).toEqual(['0,0', '0,2', '1,0']);
  });
});

describe('resolveSpecialActivations', () => {
  it('activates matched specials in row-major order and discovers chain triggers', () => {
    // Cross at (0,2) clears row 0 + column 2, chaining into the wildcard at (1,2).
    const board = boardFromPieces([
      [lineClearPiece('ruby', 'horizontal'), standardPiece('sapphire'), crossClearPiece('emerald')],
      [standardPiece('ruby'), standardPiece('topaz'), wildcardPiece('ruby')],
    ]);

    const result = resolveSpecialActivations({
      board,
      initialTriggers: [
        { coordinate: { row: 0, column: 2 }, reason: 'matched' },
        { coordinate: { row: 0, column: 0 }, reason: 'matched' },
      ],
    });

    expect(result.events.map((event) => event.coordinate)).toEqual([
      { row: 0, column: 2 },
      { row: 0, column: 0 },
      { row: 1, column: 2 },
    ]);

    expect(result.events[0].newlyTriggeredSpecialCoordinates).toEqual([{ row: 1, column: 2 }]);
    expect(new Set(coordsToKeys(result.affectedCoordinates)).size).toBe(
      result.affectedCoordinates.length,
    );
  });

  it('upgrades trigger reason priority and enforces activation limit', () => {
    const board = Board.fromGrid([[lineClearPiece('ruby', 'horizontal')]]);

    const result = resolveSpecialActivations({
      board,
      initialTriggers: [
        { coordinate: { row: 0, column: 0 }, reason: 'chain-reaction' },
        { coordinate: { row: 0, column: 0 }, reason: 'direct-swap' },
      ],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].reason).toBe('direct-swap');

    expect(() =>
      resolveSpecialActivations({
        board,
        initialTriggers: [{ coordinate: { row: 0, column: 0 }, reason: 'matched' }],
        maxSpecialActivations: 0,
      }),
    ).toThrow();
  });
});
