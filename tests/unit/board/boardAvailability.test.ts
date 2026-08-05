import { describe, expect, it } from 'vitest';
import {
  findMatchRuns,
  validatePlayableSwap,
  validateUnavailableCoordinates,
} from '../../../src/game/board';
import { BoardDomainError } from '../../../src/game/board/errors';
import { standardBoard } from './boardTestHelpers';

describe('board availability', () => {
  it('rejects out-of-bounds, duplicate, and fractional coordinates', () => {
    const dimensions = { rows: 3, columns: 3 };

    expect(() => validateUnavailableCoordinates([{ row: 3, column: 0 }], dimensions)).toThrow(
      BoardDomainError,
    );
    expect(() =>
      validateUnavailableCoordinates(
        [
          { row: 1, column: 1 },
          { row: 1, column: 1 },
        ],
        dimensions,
      ),
    ).toThrow(BoardDomainError);
    expect(() => validateUnavailableCoordinates([{ row: 1.5, column: 1 }], dimensions)).toThrow(
      BoardDomainError,
    );
  });

  it('normalizes coordinates row-major and returns defensive clones', () => {
    const source = [
      { row: 2, column: 0 },
      { row: 0, column: 2 },
    ];
    const normalized = validateUnavailableCoordinates(source, { rows: 3, columns: 3 });

    expect(normalized).toEqual([
      { row: 0, column: 2 },
      { row: 2, column: 0 },
    ]);
    expect(normalized[0]).not.toBe(source[1]);
  });

  it('rejects swaps from or to an unavailable cell', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);

    expect(
      validatePlayableSwap(board, { row: 0, column: 1 }, { row: 1, column: 1 }, [
        { row: 0, column: 1 },
      ]).reason,
    ).toBe('cell-unavailable');
    expect(
      validatePlayableSwap(board, { row: 0, column: 1 }, { row: 1, column: 1 }, [
        { row: 1, column: 1 },
      ]).reason,
    ).toBe('cell-unavailable');
  });

  it('uses unavailable cells as horizontal and vertical run separators', () => {
    const horizontal = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);
    const vertical = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['ruby', 'amethyst', 'pearl'],
      ['ruby', 'emerald', 'topaz'],
    ]);

    expect(findMatchRuns(horizontal, [{ row: 0, column: 1 }]).runs).toHaveLength(0);
    expect(findMatchRuns(vertical, [{ row: 1, column: 0 }]).runs).toHaveLength(0);
  });

  it('preserves findMatchRuns behavior for an empty unavailable list', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    expect(findMatchRuns(board, [])).toEqual(findMatchRuns(board));
  });
});
