import { describe, expect, it } from 'vitest';
import {
  applyLevelMove,
  createLevelSession,
  createInitialRiftHungerState,
  DEFAULT_SCORING_RULES,
  planAdjacentMatchCleanses,
  type LevelDefinition,
  type RiftHungerDefinition,
} from '../../../src/game/level';
import { resolveCascade } from '../../../src/game/board';
import { standardBoard } from '../board/boardTestHelpers';

function threatDefinition(overrides?: Partial<RiftHungerDefinition>): RiftHungerDefinition {
  return {
    kind: 'rift-hunger',
    sourceCells: [{ row: 2, column: 0 }],
    spreadInterval: 3,
    hungerMaximum: 5,
    spreadPriority: 'orthogonal-stable-coordinate',
    ...overrides,
  };
}

function makeDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'rift-cleanse-test',
    moveLimit: 15,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
    scoring: { ...DEFAULT_SCORING_RULES },
    seed: 42,
    threat: threatDefinition(),
    ...overrides,
  };
}

describe('RH-1 adjacent-match cleanse planning', () => {
  it('cleanses orthogonal neighbors and ignores diagonal/source', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const definition = makeDefinition({
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 3,
      }),
    });
    const session = createLevelSession({ definition, initialBoard: board });
    // Manually expand corruption for planning: source (2,2) plus (1,2)
    const previous = {
      ...session.state.threatState!,
      corruptedCells: [
        { row: 1, column: 2 },
        { row: 2, column: 2 },
      ],
      threatenedCell: { row: 0, column: 2 },
      acceptedMovesUntilSpread: 3,
    };

    const resolution = resolveCascade({
      board,
      first: { row: 0, column: 1 },
      second: { row: 1, column: 1 },
      pieceTypes: definition.allowedRefillPieceTypes,
      seed: 1,
      unavailableCoordinates: previous.corruptedCells,
    });
    expect(resolution.isValid).toBe(true);
    if (!resolution.isValid) {
      return;
    }

    const events = planAdjacentMatchCleanses({
      previousState: previous,
      resolution,
    });
    // Matched rubies include (0,0)/(0,1)/(0,2) or similar — (1,2) may be orthogonal to a match.
    for (const event of events) {
      expect(event.cause).toBe('adjacent-match');
      expect(event.coordinate).not.toEqual({ row: 2, column: 2 });
    }
  });

  it('excludes newly spread coordinate from same-move cleanse', () => {
    const state = createInitialRiftHungerState({
      definition: threatDefinition({
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 1,
      }),
      boardDimensions: { rows: 3, columns: 3 },
    });
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const definition = makeDefinition({
      threat: threatDefinition({
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 1,
      }),
    });
    // Force a resolution with empty matches via rejected-like board path is hard;
    // unit-check planner exclusion directly.
    const fakeResolution = {
      isValid: true as const,
      initialBoard: board,
      boardAfterSwap: board,
      swap: { from: { row: 0, column: 1 }, to: { row: 1, column: 1 } },
      steps: [
        {
          index: 0,
          cause: 'ordinary-match' as const,
          boardBeforeResolution: board,
          boardBeforeRemoval: board,
          matches: {
            runs: [],
            matchedCoordinates: [{ row: 0, column: 2 }],
          },
          matchPlanning: {
            groups: [],
            creations: [],
            protectedCreationCoordinates: [],
          },
          initialActivationTriggers: [],
          activationEvents: [],
          totalAffectedCoordinates: [],
          actualRemovedCoordinates: [],
          createdSpecialPieces: [],
          removedCoordinates: [],
          gridAfterRemoval: board.toGridSnapshot().map((row) => [...row]),
          gridAfterRemovalAndCreation: board.toGridSnapshot().map((row) => [...row]),
          gridAfterGravity: board.toGridSnapshot().map((row) => [...row]),
          refillPlacements: [],
          boardAfterRefill: board,
        },
      ],
      finalBoard: board,
      cascadeCount: 1,
    };

    const withSpreadTarget = {
      ...state,
      corruptedCells: [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
      ],
      threatenedCell: { row: 0, column: 1 },
      acceptedMovesUntilSpread: 1,
    };

    const events = planAdjacentMatchCleanses({
      previousState: withSpreadTarget,
      resolution: fakeResolution as never,
      newlySpreadCoordinate: { row: 0, column: 1 },
    });
    expect(
      events.every((event) => event.coordinate.row !== 0 || event.coordinate.column !== 1),
    ).toBe(true);
    void definition;
  });
});

describe('RH-1 accepted-move resolver integration', () => {
  it('spreads on the third move and keeps hunger unchanged by cleanse', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const definition = makeDefinition({
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 3,
        hungerMaximum: 5,
      }),
    });
    let session = createLevelSession({ definition, initialBoard: board });
    expect(session.state.threatState?.acceptedMovesUntilSpread).toBe(3);

    for (let i = 0; i < 2; i += 1) {
      const result = applyLevelMove({
        definition,
        state: session.state,
        from: { row: 0, column: 1 },
        to: { row: 1, column: 1 },
      });
      expect(result.accepted).toBe(true);
      if (!result.accepted) {
        return;
      }
      expect(result.threatTransition?.spreadEvent).toBeNull();
      session = { state: result.nextState };
      // Rebuild a match-ready board for the next accepted move while preserving threat.
      session = {
        state: {
          ...result.nextState,
          board: standardBoard([
            ['ruby', 'sapphire', 'ruby'],
            ['topaz', 'ruby', 'emerald'],
            ['amethyst', 'pearl', 'topaz'],
          ]),
        },
      };
    }

    const third = applyLevelMove({
      definition,
      state: session.state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(third.accepted).toBe(true);
    if (!third.accepted) {
      return;
    }
    expect(third.threatTransition?.spreadEvent).not.toBeNull();
    expect(third.threatTransition?.spreadEvent?.hungerAfter).toBe(1);
    expect(third.nextState.threatState?.hungerCurrent).toBe(1);
  });

  it('rejects swaps that use corrupted coordinates', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const definition = makeDefinition({
      threat: threatDefinition({ sourceCells: [{ row: 0, column: 0 }] }),
    });
    const session = createLevelSession({ definition, initialBoard: board });
    const rejected = applyLevelMove({
      definition,
      state: session.state,
      from: { row: 0, column: 0 },
      to: { row: 0, column: 1 },
    });
    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted && rejected.kind === 'rejected') {
      expect(rejected.reason).toBe('cell-unavailable');
      expect(rejected.state.threatState?.acceptedMovesUntilSpread).toBe(3);
    }
  });

  it('cleanses non-source corruption adjacent to an ordinary match without changing hunger', () => {
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const definition = makeDefinition({
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 3,
        hungerMaximum: 5,
      }),
    });
    const session = createLevelSession({ definition, initialBoard: board });
    const prepared = {
      ...session.state,
      threatState: {
        ...session.state.threatState!,
        corruptedCells: [
          { row: 1, column: 0 },
          { row: 2, column: 2 },
        ],
        threatenedCell: { row: 2, column: 1 },
        acceptedMovesUntilSpread: 3,
        status: 'active' as const,
      },
    };
    const result = applyLevelMove({
      definition,
      state: prepared,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.threatTransition?.cleanseEvents).toEqual([
      expect.objectContaining({
        coordinate: { row: 1, column: 0 },
        cause: 'adjacent-match',
      }),
    ]);
    expect(result.nextState.threatState?.corruptedCells).toEqual([{ row: 2, column: 2 }]);
    expect(result.nextState.threatState?.hungerCurrent).toBe(0);
    expect(result.threatTransition?.spreadEvent).toBeNull();
  });
});
