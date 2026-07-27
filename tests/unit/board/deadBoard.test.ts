import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import { isDeadBoard } from '../../../src/game/board/deadBoard';
import {
  boardFromPieces,
  lineClearPiece,
  standardBoard,
  standardPiece,
  wildcardPiece,
} from './boardTestHelpers';

describe('dead board detection', () => {
  it('classifies stable no-move board as dead', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    expect(isDeadBoard(board)).toBe(true);
  });

  it('classifies stable board with one or more moves as not dead', () => {
    const oneMove = standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]);
    const manyMoves = standardBoard([
      ['ruby', 'sapphire', 'ruby', 'sapphire'],
      ['sapphire', 'ruby', 'sapphire', 'ruby'],
      ['ruby', 'sapphire', 'ruby', 'sapphire'],
      ['sapphire', 'ruby', 'sapphire', 'ruby'],
    ]);

    expect(isDeadBoard(oneMove)).toBe(false);
    expect(isDeadBoard(manyMoves)).toBe(false);
  });

  it('rejects unstable boards with active matches', () => {
    const horizontalMatch = standardBoard([
      ['ruby', 'ruby', 'ruby'],
      ['topaz', 'amethyst', 'pearl'],
      ['sapphire', 'emerald', 'topaz'],
    ]);

    const verticalMatch = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['ruby', 'amethyst', 'pearl'],
      ['ruby', 'emerald', 'topaz'],
    ]);

    expect(() => isDeadBoard(horizontalMatch)).toThrowError(BoardDomainError);
    expect(() => isDeadBoard(verticalMatch)).toThrowError(BoardDomainError);
  });

  it('does not mutate the source board', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'emerald'],
      ['emerald', 'ruby', 'sapphire'],
      ['sapphire', 'emerald', 'ruby'],
    ]);

    const before = board.toGridSnapshot();
    isDeadBoard(board);

    expect(board.toGridSnapshot()).toEqual(before);
  });

  it('treats wildcard adjacency as playable (not dead)', () => {
    const board = boardFromPieces([
      [wildcardPiece('ruby'), standardPiece('sapphire')],
      [standardPiece('emerald'), standardPiece('topaz')],
    ]);

    expect(isDeadBoard(board)).toBe(false);
  });

  it('treats adjacent specials as playable (not dead)', () => {
    const board = boardFromPieces([
      [lineClearPiece('ruby', 'horizontal'), lineClearPiece('emerald', 'vertical')],
      [standardPiece('sapphire'), standardPiece('topaz')],
    ]);

    expect(isDeadBoard(board)).toBe(false);
  });
});
