import { describe, expect, it } from 'vitest';
import { planRefillPresentation } from '../../../src/game/presentation/playback/refillPresentationPlanning';
import { standardPiece } from '../board/boardTestHelpers';

describe('planRefillPresentation', () => {
  it('places refill start rows above the board and preserves input ordering', () => {
    const entries = planRefillPresentation({
      rows: 8,
      placements: [
        { coordinate: { row: 2, column: 0 }, piece: standardPiece('ruby') },
        { coordinate: { row: 1, column: 0 }, piece: standardPiece('sapphire') },
        { coordinate: { row: 0, column: 2 }, piece: standardPiece('emerald') },
      ],
    });

    expect(entries).toEqual([
      {
        index: 0,
        destination: { row: 2, column: 0 },
        piece: standardPiece('ruby'),
        startRow: -1,
        stackIndex: 1,
        stackSize: 2,
      },
      {
        index: 1,
        destination: { row: 1, column: 0 },
        piece: standardPiece('sapphire'),
        startRow: -2,
        stackIndex: 0,
        stackSize: 2,
      },
      {
        index: 2,
        destination: { row: 0, column: 2 },
        piece: standardPiece('emerald'),
        startRow: -1,
        stackIndex: 0,
        stackSize: 1,
      },
    ]);
  });

  it('preserves the supplied refill piece snapshots without fabricating new kinds', () => {
    const entries = planRefillPresentation({
      rows: 5,
      placements: [
        {
          coordinate: { row: 0, column: 1 },
          piece: standardPiece('topaz'),
        },
      ],
    });

    expect(entries[0].piece).toEqual(standardPiece('topaz'));
    expect(entries[0].piece.kind).toBe('standard');
    expect(entries[0].startRow).toBeLessThan(0);
    expect(entries[0].destination).toEqual({ row: 0, column: 1 });
  });
});
