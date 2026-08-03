import { describe, expect, it } from 'vitest';
import {
  areAllObjectivesComplete,
  createInitialObjectiveProgress,
  updateObjectiveProgress,
} from '../../../src/game/level';
import { createStandardPiece } from '../../../src/game/board/boardPieces';

const definition = {
  id: 'level-objectives',
  moveLimit: 10,
  allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald'] as const,
  objectives: [
    { id: 'score-main', kind: 'score' as const, targetScore: 100 },
    {
      id: 'collect-ruby-a',
      kind: 'collect-piece' as const,
      pieceType: 'ruby' as const,
      targetCount: 2,
    },
    {
      id: 'collect-ruby-b',
      kind: 'collect-piece' as const,
      pieceType: 'ruby' as const,
      targetCount: 3,
    },
    {
      id: 'collect-sapphire',
      kind: 'collect-piece' as const,
      pieceType: 'sapphire' as const,
      targetCount: 1,
    },
  ],
  scoring: {
    pointsPerRemovedPiece: 10,
    lineClearActivationBonus: 40,
    crossClearActivationBonus: 50,
    wildcardActivationBonus: 60,
    cascadeMultiplierIncrement: 1,
  },
  seed: 1,
};

const sampleCollectionEvents = [
  {
    stepIndex: 0,
    coordinate: { row: 0, column: 0 },
    piece: createStandardPiece('ruby'),
    pieceType: 'ruby' as const,
  },
  {
    stepIndex: 0,
    coordinate: { row: 0, column: 1 },
    piece: createStandardPiece('ruby'),
    pieceType: 'ruby' as const,
  },
  {
    stepIndex: 1,
    coordinate: { row: 0, column: 2 },
    piece: createStandardPiece('sapphire'),
    pieceType: 'sapphire' as const,
  },
];

describe('objective progress', () => {
  it('creates initial objective progress in definition order', () => {
    const progress = createInitialObjectiveProgress({ definition });

    expect(progress.map((entry) => entry.objectiveId)).toEqual([
      'score-main',
      'collect-ruby-a',
      'collect-ruby-b',
      'collect-sapphire',
    ]);
    expect(progress.every((entry) => entry.current === 0)).toBe(true);
  });

  it('updates score and collection objectives with non-decreasing progress', () => {
    const previous = createInitialObjectiveProgress({ definition });

    const updated = updateObjectiveProgress({
      definition,
      previousProgress: previous,
      nextScore: 120,
      scoreDelta: 120,
      collectionEvents: sampleCollectionEvents,
    });

    expect(updated.nextProgress[0]).toMatchObject({ current: 120, complete: true });
    expect(updated.nextProgress[1]).toMatchObject({ current: 2, complete: true });
    expect(updated.nextProgress[2]).toMatchObject({ current: 2, complete: false });
    expect(updated.nextProgress[3]).toMatchObject({ current: 1, complete: true });

    expect(updated.updates[0].delta).toBe(120);
    expect(updated.updates[1].delta).toBe(2);
    expect(updated.updates[2].delta).toBe(2);
    expect(updated.updates[3].delta).toBe(1);

    expect(updated.updates[0].completedThisMove).toBe(true);
    expect(updated.updates[1].completedThisMove).toBe(true);
    expect(updated.updates[2].completedThisMove).toBe(false);
  });

  it('keeps already completed objectives complete and supports same piece-type objectives', () => {
    const previous = [
      {
        objectiveId: 'score-main',
        kind: 'score' as const,
        current: 150,
        target: 100,
        complete: true,
      },
      {
        objectiveId: 'collect-ruby-a',
        kind: 'collect-piece' as const,
        current: 2,
        target: 2,
        complete: true,
      },
      {
        objectiveId: 'collect-ruby-b',
        kind: 'collect-piece' as const,
        current: 3,
        target: 3,
        complete: true,
      },
      {
        objectiveId: 'collect-sapphire',
        kind: 'collect-piece' as const,
        current: 1,
        target: 1,
        complete: true,
      },
    ];

    const updated = updateObjectiveProgress({
      definition,
      previousProgress: previous,
      nextScore: 160,
      scoreDelta: 10,
      collectionEvents: sampleCollectionEvents,
    });

    expect(updated.nextProgress.every((entry) => entry.complete)).toBe(true);
    expect(areAllObjectivesComplete(updated.nextProgress)).toBe(true);
    expect(updated.nextProgress[1].current).toBeGreaterThanOrEqual(previous[1].current);
  });
});
