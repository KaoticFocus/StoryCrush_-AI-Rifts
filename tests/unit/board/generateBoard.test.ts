import { describe, expect, it } from 'vitest';
import { generateBoard } from '../../../src/game/board/generateBoard';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { BoardDomainError } from '../../../src/game/board/errors';

const pieceTypes = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'] as const;

describe('generateBoard', () => {
  it('creates a board with the requested dimensions', () => {
    const board = generateBoard({ rows: 8, columns: 7, pieceTypes, seed: 123 });

    expect(board.getDimensions()).toEqual({ rows: 8, columns: 7 });
  });

  it('uses only allowed piece types', () => {
    const board = generateBoard({ rows: 6, columns: 6, pieceTypes, seed: 42 });
    const allowed = new Set(pieceTypes);

    for (const row of board.toGridSnapshot()) {
      for (const piece of row) {
        expect(allowed.has(piece.pieceType)).toBe(true);
      }
    }
  });

  it('produces identical boards for the same inputs', () => {
    const first = generateBoard({ rows: 8, columns: 8, pieceTypes, seed: 5000 });
    const second = generateBoard({ rows: 8, columns: 8, pieceTypes, seed: 5000 });

    expect(first.toGridSnapshot()).toEqual(second.toGridSnapshot());
  });

  it('produces different boards for different seeds', () => {
    const first = generateBoard({ rows: 8, columns: 8, pieceTypes, seed: 501 });
    const second = generateBoard({ rows: 8, columns: 8, pieceTypes, seed: 502 });

    expect(first.toGridSnapshot()).not.toEqual(second.toGridSnapshot());
  });

  it('creates no initial horizontal or vertical matches', () => {
    const board = generateBoard({ rows: 9, columns: 9, pieceTypes, seed: 7777 });
    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(0);
    expect(result.matchedCoordinates).toHaveLength(0);
  });

  it('rejects empty piece type lists', () => {
    expect(() => generateBoard({ rows: 8, columns: 8, pieceTypes: [], seed: 1 })).toThrowError(
      BoardDomainError,
    );
  });

  it('rejects invalid dimensions', () => {
    expect(() => generateBoard({ rows: 0, columns: 8, pieceTypes, seed: 1 })).toThrowError(
      BoardDomainError,
    );
    expect(() => generateBoard({ rows: 8, columns: -1, pieceTypes, seed: 1 })).toThrowError(
      BoardDomainError,
    );
  });

  it('rejects invalid piece identifiers', () => {
    expect(() =>
      generateBoard({
        rows: 8,
        columns: 8,
        pieceTypes: ['ruby', 'unknown-piece'],
        seed: 1,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('fails clearly when inputs cannot satisfy no-initial-match generation', () => {
    expect(() =>
      generateBoard({
        rows: 1,
        columns: 3,
        pieceTypes: ['ruby'],
        seed: 99,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('rejects invalid seeds', () => {
    expect(() =>
      generateBoard({
        rows: 8,
        columns: 8,
        pieceTypes,
        seed: Number.NaN,
      }),
    ).toThrowError(BoardDomainError);
  });
});
