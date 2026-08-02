import { describe, expect, it } from 'vitest';
import { resolveCascade } from '../../../src/game/board/resolveCascade';
import { createPieceCollectionEvents } from '../../../src/game/level';
import {
  crossClearPiece,
  boardFromPieces,
  lineClearPiece,
  standardBoard,
  standardPiece,
  wildcardPiece,
} from '../board/boardTestHelpers';

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

function validResolution(input: Parameters<typeof resolveCascade>[0]) {
  const result = resolveCascade(input);
  expect(result.isValid).toBe(true);
  if (!result.isValid) {
    throw new Error('Expected valid resolution');
  }

  return result;
}

describe('createPieceCollectionEvents', () => {
  it('emits one event per actual removed coordinate in deterministic order', () => {
    const resolution = validResolution({
      board: standardBoard([
        ['ruby', 'sapphire', 'ruby'],
        ['topaz', 'ruby', 'emerald'],
        ['amethyst', 'pearl', 'topaz'],
      ]),
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2]),
    });

    const events = createPieceCollectionEvents({ resolution });

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.coordinate)).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
  });

  it('uses underlying piece type for special pieces and excludes protected creation coordinates', () => {
    const resolution = validResolution({
      board: boardFromPieces([
        [wildcardPiece('ruby'), lineClearPiece('sapphire', 'vertical')],
        [crossClearPiece('sapphire'), standardPiece('topaz')],
      ]),
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2, 3]),
    });

    const events = createPieceCollectionEvents({ resolution });

    expect(events.some((event) => event.piece.kind !== 'standard')).toBe(true);
    expect(events.every((event) => event.pieceType === event.piece.pieceType)).toBe(true);

    const creationKeys = new Set(
      resolution.steps.flatMap((step) =>
        step.createdSpecialPieces.map(
          (entry) => `${entry.coordinate.row},${entry.coordinate.column}`,
        ),
      ),
    );
    const removedKeys = new Set(
      events.map((event) => `${event.coordinate.row},${event.coordinate.column}`),
    );

    for (const key of creationKeys) {
      expect(removedKeys.has(key)).toBe(false);
    }
  });

  it('returns serializable events and does not include refill placements', () => {
    const resolution = validResolution({
      board: standardBoard([['ruby', 'sapphire', 'ruby', 'ruby']]),
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['sapphire', 'ruby'],
      randomSource: new ScriptedRandom([0, 0, 0, 1, 0, 1, 0]),
    });

    const events = createPieceCollectionEvents({ resolution });
    const serialized = JSON.parse(JSON.stringify(events));

    expect(serialized).toEqual(events);

    const removedTotal = resolution.steps.reduce(
      (sum, step) => sum + step.actualRemovedCoordinates.length,
      0,
    );
    expect(events.length).toBe(removedTotal);
  });
});
