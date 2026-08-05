import { describe, expect, it } from 'vitest';
import { RandomSource } from '../../../src/game/board/boardTypes';
import { isDeadBoard } from '../../../src/game/board/deadBoard';
import { BoardDomainError } from '../../../src/game/board/errors';
import { findMatchRuns } from '../../../src/game/board/matchDetection';
import { createPieceInventory } from '../../../src/game/board/pieceInventory';
import {
  rearrangeBoardToStablePlayable,
  reshuffleDeadBoard,
} from '../../../src/game/board/reshuffleBoard';
import { findPlayableSwaps } from '../../../src/game/board/validMoves';
import {
  boardFromPieces,
  crossClearPiece,
  lineClearPiece,
  standardBoard,
  wildcardPiece,
  standardPiece,
} from './boardTestHelpers';

class MaxIndexRandom implements RandomSource {
  public nextInt(maxExclusive: number): number {
    return maxExclusive - 1;
  }
}

describe('rearrangeBoardToStablePlayable', () => {
  it('stabilizes an unstable horizontal match while preserving inventory', () => {
    const unstable = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'sapphire', 'emerald'],
      ['pearl', 'amethyst', 'topaz'],
    ]);
    expect(findMatchRuns(unstable).runs.length).toBeGreaterThan(0);

    const result = rearrangeBoardToStablePlayable({
      board: unstable,
      seed: 42,
    });

    expect(findMatchRuns(result.reshuffledBoard).runs).toHaveLength(0);
    expect(findPlayableSwaps(result.reshuffledBoard).length).toBeGreaterThan(0);
    expect(result.reshuffledInventory).toEqual(createPieceInventory(unstable));
    expect(unstable.toGridSnapshot()).toEqual(
      standardBoard([
        ['ruby', 'ruby', 'ruby'],
        ['topaz', 'sapphire', 'emerald'],
        ['pearl', 'amethyst', 'topaz'],
      ]).toGridSnapshot(),
    );
  });

  it('stabilizes an unstable vertical match', () => {
    const unstable = standardBoard([
      ['ruby', 'topaz', 'sapphire'],
      ['ruby', 'emerald', 'pearl'],
      ['ruby', 'amethyst', 'topaz'],
    ]);
    expect(findMatchRuns(unstable).runs.length).toBeGreaterThan(0);

    const result = rearrangeBoardToStablePlayable({
      board: unstable,
      seed: 11,
    });

    expect(findMatchRuns(result.reshuffledBoard).runs).toHaveLength(0);
    expect(findPlayableSwaps(result.reshuffledBoard).length).toBeGreaterThan(0);
  });

  it('stabilizes matches exposed only when an unavailable cell becomes available', () => {
    const board = standardBoard([
      ['topaz', 'emerald', 'sapphire', 'pearl'],
      ['sapphire', 'ruby', 'ruby', 'ruby'],
      ['pearl', 'topaz', 'emerald', 'sapphire'],
      ['emerald', 'sapphire', 'pearl', 'topaz'],
    ]);
    const temporaryMask = [
      { row: 0, column: 0 },
      { row: 1, column: 2 },
    ];
    const returnedMask = [{ row: 0, column: 0 }];

    expect(findMatchRuns(board, temporaryMask).runs).toHaveLength(0);
    expect(findMatchRuns(board, returnedMask).runs.length).toBeGreaterThan(0);

    const result = rearrangeBoardToStablePlayable({
      board,
      seed: 77,
      unavailableCoordinates: returnedMask,
    });

    expect(findMatchRuns(result.reshuffledBoard, returnedMask).runs).toHaveLength(0);
    expect(findPlayableSwaps(result.reshuffledBoard, returnedMask).length).toBeGreaterThan(0);
    expect(result.reshuffledInventory).toEqual(createPieceInventory(board));
  });

  it('handles rectangular boards and preserves special identities/orientations', () => {
    const unstable = boardFromPieces([
      [standardPiece('ruby'), standardPiece('ruby'), standardPiece('ruby')],
      [
        wildcardPiece('topaz'),
        crossClearPiece('amethyst'),
        lineClearPiece('sapphire', 'horizontal'),
      ],
      [standardPiece('emerald'), standardPiece('pearl'), lineClearPiece('pearl', 'vertical')],
      [standardPiece('sapphire'), standardPiece('topaz'), standardPiece('amethyst')],
    ]);

    const result = rearrangeBoardToStablePlayable({
      board: unstable,
      seed: 19,
    });

    expect(result.reshuffledBoard.getDimensions()).toEqual({ rows: 4, columns: 3 });
    expect(findMatchRuns(result.reshuffledBoard).runs).toHaveLength(0);
    expect(findPlayableSwaps(result.reshuffledBoard).length).toBeGreaterThan(0);
    expect(result.reshuffledInventory).toEqual(createPieceInventory(unstable));
    expect(result.reshuffledInventory['line-clear:sapphire:horizontal']).toBe(1);
    expect(result.reshuffledInventory['line-clear:pearl:vertical']).toBe(1);
    expect(result.reshuffledInventory['cross-clear:amethyst']).toBe(1);
    expect(result.reshuffledInventory['wildcard:topaz']).toBe(1);
  });

  it('handles stable dead boards and remains compatible with reshuffleDeadBoard', () => {
    const deadBoard = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);
    expect(isDeadBoard(deadBoard)).toBe(true);

    const shared = rearrangeBoardToStablePlayable({
      board: deadBoard,
      seed: 12345,
      maxRandomAttempts: 100,
      maxSearchNodes: 50000,
    });
    const wrapped = reshuffleDeadBoard({
      board: deadBoard,
      seed: 12345,
      maxRandomAttempts: 100,
      maxSearchNodes: 50000,
    });

    expect(shared.reshuffledBoard.toGridSnapshot()).toEqual(
      wrapped.reshuffledBoard.toGridSnapshot(),
    );
    expect(shared.randomAttempts).toBe(wrapped.randomAttempts);
    expect(shared.fallbackSearchUsed).toBe(wrapped.fallbackSearchUsed);
    expect(shared.searchNodesVisited).toBe(wrapped.searchNodesVisited);
    expect(shared.validPlayableSwaps).toEqual(wrapped.validPlayableSwaps);
  });

  it('is deterministic across ten identical runs including fallback metadata', () => {
    const unstable = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'sapphire', 'emerald'],
      ['pearl', 'amethyst', 'topaz'],
      ['sapphire', 'emerald', 'pearl'],
    ]);

    const runs = Array.from({ length: 10 }, () =>
      rearrangeBoardToStablePlayable({
        board: unstable,
        seed: 909,
        maxRandomAttempts: 1,
        maxSearchNodes: 50000,
        randomSource: new MaxIndexRandom(),
      }),
    );

    for (let index = 1; index < runs.length; index += 1) {
      expect(runs[index]!.reshuffledBoard.toGridSnapshot()).toEqual(
        runs[0]!.reshuffledBoard.toGridSnapshot(),
      );
      expect(runs[index]!.randomAttempts).toBe(runs[0]!.randomAttempts);
      expect(runs[index]!.fallbackSearchUsed).toBe(runs[0]!.fallbackSearchUsed);
      expect(runs[index]!.searchNodesVisited).toBe(runs[0]!.searchNodesVisited);
      expect(runs[index]!.validPlayableSwaps).toEqual(runs[0]!.validPlayableSwaps);
      expect(runs[index]!.validScoringSwaps).toEqual(runs[0]!.validScoringSwaps);
    }
  });

  it('rejects invalid seed, limits, and unavailable coordinates', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    expect(() =>
      rearrangeBoardToStablePlayable({
        board,
        seed: Number.NaN,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      rearrangeBoardToStablePlayable({
        board,
        seed: 1,
        maxRandomAttempts: 0,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      rearrangeBoardToStablePlayable({
        board,
        seed: 1,
        unavailableCoordinates: [{ row: -1, column: 0 }],
      }),
    ).toThrowError(BoardDomainError);
  });
});
