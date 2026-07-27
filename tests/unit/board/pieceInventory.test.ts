import { describe, expect, it } from 'vitest';
import { DEFAULT_PIECE_TYPES } from '../../../src/game/board/boardTypes';
import { createPieceInventory, inventoryTotal } from '../../../src/game/board/pieceInventory';
import { standardBoard } from './boardTestHelpers';

describe('createPieceInventory', () => {
  it('counts pieces correctly and totals all cells', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'sapphire'],
      ['emerald', 'topaz', 'amethyst'],
      ['pearl', 'ruby', 'sapphire'],
    ]);

    const inventory = createPieceInventory(board);

    expect(inventory['standard:ruby']).toBe(3);
    expect(inventory['standard:sapphire']).toBe(2);
    expect(inventory['standard:emerald']).toBe(1);
    expect(inventory['standard:topaz']).toBe(1);
    expect(inventory['standard:amethyst']).toBe(1);
    expect(inventory['standard:pearl']).toBe(1);
    expect(inventoryTotal(inventory)).toBe(9);
  });

  it('supports single-piece-type and rectangular boards', () => {
    const board = standardBoard([
      ['ruby', 'ruby', 'ruby', 'ruby'],
      ['ruby', 'ruby', 'ruby', 'ruby'],
    ]);

    const inventory = createPieceInventory(board);

    expect(inventory['standard:ruby']).toBe(8);
    for (const pieceType of DEFAULT_PIECE_TYPES) {
      if (pieceType !== 'ruby') {
        expect(inventory[`standard:${pieceType}`]).toBe(0);
      }
    }
  });

  it('returns deterministic serializable output and does not mutate board', () => {
    const board = standardBoard([
      ['ruby', 'sapphire'],
      ['emerald', 'topaz'],
    ]);
    const before = board.toGridSnapshot();

    const first = createPieceInventory(board);
    const second = createPieceInventory(board);

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(board.toGridSnapshot()).toEqual(before);
  });
});
