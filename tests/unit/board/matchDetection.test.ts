import { describe, expect, it } from 'vitest';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { standardBoard } from './boardTestHelpers';

describe('findMatchRuns', () => {
  it('returns no matches for a no-match board', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(0);
    expect(result.matchedCoordinates).toHaveLength(0);
  });

  it('finds a horizontal match of three', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].orientation).toBe('horizontal');
    expect(result.runs[0].coordinates).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
  });

  it('finds a vertical match of three', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['ruby', 'amethyst', 'pearl'],
      ['ruby', 'emerald', 'topaz'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].orientation).toBe('vertical');
    expect(result.runs[0].coordinates).toEqual([
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
    ]);
  });

  it('finds horizontal runs longer than three', () => {
    const board = standardBoard([
      ['sapphire', 'sapphire', 'sapphire', 'sapphire', 'sapphire'],
      ['ruby', 'emerald', 'topaz', 'amethyst', 'pearl'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].coordinates).toHaveLength(5);
    expect(result.runs[0].pieceType).toBe('sapphire');
  });

  it('finds vertical runs longer than three', () => {
    const board = standardBoard([
      ['emerald', 'ruby'],
      ['emerald', 'sapphire'],
      ['emerald', 'topaz'],
      ['emerald', 'amethyst'],
      ['emerald', 'pearl'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].orientation).toBe('vertical');
    expect(result.runs[0].coordinates).toHaveLength(5);
  });

  it('finds multiple independent matches', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'ruby', 'topaz'],
      ['sapphire', 'emerald', 'topaz', 'amethyst'],
      ['pearl', 'sapphire', 'amethyst', 'topaz'],
      ['emerald', 'sapphire', 'amethyst', 'topaz'],
      ['ruby', 'sapphire', 'amethyst', 'topaz'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(4);
  });

  it('represents intersecting T-shaped matches with separate runs', () => {
    const board = standardBoard([
      ['emerald', 'topaz', 'amethyst', 'pearl', 'ruby'],
      ['ruby', 'sapphire', 'ruby', 'topaz', 'emerald'],
      ['sapphire', 'ruby', 'ruby', 'ruby', 'topaz'],
      ['topaz', 'sapphire', 'ruby', 'emerald', 'pearl'],
      ['amethyst', 'pearl', 'sapphire', 'topaz', 'emerald'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(2);
    expect(result.runs.map((run) => run.orientation).sort()).toEqual(['horizontal', 'vertical']);
  });

  it('represents intersecting L-shaped matches with separate runs', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald', 'topaz'],
      ['topaz', 'ruby', 'ruby', 'ruby'],
      ['emerald', 'sapphire', 'ruby', 'amethyst'],
      ['pearl', 'topaz', 'ruby', 'sapphire'],
    ]);

    const result = findMatchRuns(board);

    expect(result.runs).toHaveLength(2);
    expect(result.runs.map((run) => run.orientation).sort()).toEqual(['horizontal', 'vertical']);
  });

  it('returns unique matched coordinates without duplicates', () => {
    const board = standardBoard([
      ['emerald', 'topaz', 'amethyst', 'pearl', 'ruby'],
      ['ruby', 'sapphire', 'ruby', 'topaz', 'emerald'],
      ['sapphire', 'ruby', 'ruby', 'ruby', 'topaz'],
      ['topaz', 'sapphire', 'ruby', 'emerald', 'pearl'],
      ['amethyst', 'pearl', 'sapphire', 'topaz', 'emerald'],
    ]);

    const result = findMatchRuns(board);

    const keySet = new Set(
      result.matchedCoordinates.map((entry) => `${entry.row},${entry.column}`),
    );
    expect(keySet.size).toBe(result.matchedCoordinates.length);
  });

  it('does not mutate the board', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const before = board.toGridSnapshot();
    findMatchRuns(board);

    expect(board.toGridSnapshot()).toEqual(before);
  });
});
