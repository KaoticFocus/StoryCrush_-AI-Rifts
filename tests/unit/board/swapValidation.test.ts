import { describe, expect, it } from 'vitest';
import {
  areCoordinatesOrthogonallyAdjacent,
  createsMatchAfterSwap,
  validateScoringSwap,
  validateStructuralSwap,
} from '../../../src/game/board/swapValidation';
import { standardBoard } from './boardTestHelpers';

describe('swap validation', () => {
  it('detects horizontal and vertical adjacency', () => {
    expect(areCoordinatesOrthogonallyAdjacent({ row: 1, column: 1 }, { row: 1, column: 2 })).toBe(
      true,
    );
    expect(areCoordinatesOrthogonallyAdjacent({ row: 1, column: 1 }, { row: 2, column: 1 })).toBe(
      true,
    );
  });

  it('rejects diagonal and non-adjacent coordinates', () => {
    expect(areCoordinatesOrthogonallyAdjacent({ row: 1, column: 1 }, { row: 2, column: 2 })).toBe(
      false,
    );
    expect(areCoordinatesOrthogonallyAdjacent({ row: 1, column: 1 }, { row: 1, column: 3 })).toBe(
      false,
    );
  });

  it('rejects same-coordinate and out-of-bounds structural swaps', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    expect(validateStructuralSwap(board, { row: 0, column: 0 }, { row: 0, column: 0 })).toEqual({
      isValid: false,
      reason: 'same-coordinate',
    });

    expect(validateStructuralSwap(board, { row: -1, column: 0 }, { row: 0, column: 0 })).toEqual({
      isValid: false,
      reason: 'first-coordinate-out-of-bounds',
    });

    expect(validateStructuralSwap(board, { row: 0, column: 0 }, { row: 9, column: 9 })).toEqual({
      isValid: false,
      reason: 'second-coordinate-out-of-bounds',
    });
  });

  it('accepts an adjacent swap that creates a horizontal match', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const result = validateScoringSwap(board, { row: 0, column: 1 }, { row: 1, column: 1 });

    expect(result.isValid).toBe(true);
    expect(result.matchResult?.runs.some((run) => run.orientation === 'horizontal')).toBe(true);
  });

  it('accepts an adjacent swap that creates a vertical match via the second coordinate', () => {
    const board = standardBoard([
      ['sapphire', 'ruby', 'emerald'],
      ['topaz', 'sapphire', 'amethyst'],
      ['pearl', 'sapphire', 'topaz'],
    ]);

    const result = validateScoringSwap(board, { row: 0, column: 0 }, { row: 0, column: 1 });

    expect(result.isValid).toBe(true);
    expect(result.matchResult?.runs.some((run) => run.orientation === 'vertical')).toBe(true);
  });

  it('rejects adjacent swaps that do not create a match and preserves accepted board state', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const before = board.toGridSnapshot();
    const result = validateScoringSwap(board, { row: 0, column: 0 }, { row: 0, column: 1 });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('no-match-created');
    expect(result.board.toGridSnapshot()).toEqual(before);
    expect(board.toGridSnapshot()).toEqual(before);
  });

  it('marks structurally invalid scoring swaps with explicit structural reason', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const result = validateScoringSwap(board, { row: 0, column: 0 }, { row: 2, column: 2 });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('structurally-invalid');
    expect(result.structuralReason).toBe('not-adjacent');
  });

  it('reports match creation helper correctly', () => {
    const scoringBoard = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    const nonScoringBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    expect(createsMatchAfterSwap(scoringBoard, { row: 0, column: 1 }, { row: 1, column: 1 })).toBe(
      true,
    );
    expect(
      createsMatchAfterSwap(nonScoringBoard, { row: 0, column: 0 }, { row: 0, column: 1 }),
    ).toBe(false);
  });
});
