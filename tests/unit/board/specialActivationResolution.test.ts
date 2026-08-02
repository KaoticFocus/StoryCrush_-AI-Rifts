import { describe, expect, it } from 'vitest';
import { resolveCascade } from '../../../src/game/board/resolveCascade';
import {
  crossClearPiece,
  boardFromPieces,
  lineClearPiece,
  standardPiece,
  wildcardPiece,
} from './boardTestHelpers';

class ScriptedRandom {
  private index = 0;

  public constructor(private readonly values: number[]) {}

  public nextInt(maxExclusive: number): number {
    const value = this.values[this.index] ?? 0;
    this.index += 1;
    return value % maxExclusive;
  }
}

describe('resolveCascade Phase 1F activation integration', () => {
  it('resolves a direct wildcard swap with no ordinary match', () => {
    const board = boardFromPieces([
      [wildcardPiece('ruby'), standardPiece('sapphire'), standardPiece('ruby')],
      [standardPiece('ruby'), standardPiece('emerald'), standardPiece('topaz')],
      [standardPiece('amethyst'), standardPiece('pearl'), standardPiece('ruby')],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2, 3]),
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].cause).toBe('direct-special-swap');
    expect(result.steps[0].matches.runs).toHaveLength(0);
    expect(result.steps[0].activationEvents).toHaveLength(1);
    expect(result.steps[0].activationEvents[0].piece.kind).toBe('wildcard');
  });

  it('activates special pieces included in ordinary matches', () => {
    const board = boardFromPieces([
      [
        standardPiece('ruby'),
        standardPiece('sapphire'),
        standardPiece('ruby'),
        standardPiece('topaz'),
      ],
      [
        standardPiece('topaz'),
        lineClearPiece('ruby', 'horizontal'),
        standardPiece('emerald'),
        standardPiece('pearl'),
      ],
      [
        standardPiece('amethyst'),
        standardPiece('ruby'),
        standardPiece('topaz'),
        standardPiece('emerald'),
      ],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2, 3]),
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    expect(result.steps[0].cause).toBe('ordinary-match');
    expect(result.steps[0].activationEvents.map((event) => event.piece.kind)).toContain(
      'line-clear',
    );
    expect(result.steps[0].totalAffectedCoordinates.length).toBeGreaterThan(
      result.steps[0].matches.matchedCoordinates.length,
    );
  });

  it('supports wildcard plus non-wildcard special direct combination and chain trigger discovery', () => {
    const board = boardFromPieces([
      [wildcardPiece('ruby'), lineClearPiece('sapphire', 'vertical')],
      [crossClearPiece('sapphire'), standardPiece('topaz')],
    ]);

    const result = resolveCascade({
      board,
      first: { row: 0, column: 0 },
      second: { row: 0, column: 1 },
      pieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      randomSource: new ScriptedRandom([0, 1, 2, 3]),
    });

    expect(result.isValid).toBe(true);
    if (!result.isValid) {
      return;
    }

    expect(result.steps[0].initialActivationTriggers.map((trigger) => trigger.coordinate)).toEqual([
      { row: 0, column: 1 },
      { row: 0, column: 0 },
    ]);
    expect(result.steps[0].activationEvents.length).toBeGreaterThanOrEqual(2);
  });
});
