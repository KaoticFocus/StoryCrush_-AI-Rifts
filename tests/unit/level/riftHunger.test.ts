import { describe, expect, it } from 'vitest';
import { BoardDomainError } from '../../../src/game/board/errors';
import {
  addOrRefreshRiftHungerProtection,
  advanceRiftHungerForAcceptedMove,
  applyLevelMove,
  cloneRiftHungerState,
  createInitialRiftHungerState,
  createLevelSession,
  DEFAULT_SCORING_RULES,
  type LevelDefinition,
  type RiftHungerDefinition,
  validateLevelDefinition,
  validateRiftHungerDefinition,
} from '../../../src/game/level';
import { PuzzleSessionController } from '../../../src/game/presentation/PuzzleSessionController';
import { standardBoard } from '../board/boardTestHelpers';

function threatDefinition(overrides?: Partial<RiftHungerDefinition>): RiftHungerDefinition {
  return {
    kind: 'rift-hunger',
    sourceCells: [{ row: 0, column: 0 }],
    spreadInterval: 3,
    hungerMaximum: 4,
    spreadPriority: 'orthogonal-stable-coordinate',
    ...overrides,
  };
}

function makeDefinition(overrides?: Partial<LevelDefinition>): LevelDefinition {
  return {
    id: 'rift-hunger-test',
    moveLimit: 10,
    allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
    objectives: [{ id: 'score-main', kind: 'score', targetScore: 10_000 }],
    scoring: { ...DEFAULT_SCORING_RULES },
    seed: 42,
    ...overrides,
  };
}

/** Stable 3x3 board with one horizontal match-3 available via swap. */
function matchReadyBoard() {
  return standardBoard([
    ['ruby', 'sapphire', 'ruby'],
    ['topaz', 'ruby', 'emerald'],
    ['amethyst', 'pearl', 'topaz'],
  ]);
}

describe('rift hunger definition validation', () => {
  it('accepts a valid single-source definition', () => {
    const validated = validateRiftHungerDefinition(threatDefinition(), {
      rows: 8,
      columns: 8,
    });
    expect(validated.sourceCells).toEqual([{ row: 0, column: 0 }]);
    expect(validated.spreadInterval).toBe(3);
  });

  it('normalizes multiple source coordinates deterministically', () => {
    const validated = validateRiftHungerDefinition(
      threatDefinition({
        sourceCells: [
          { row: 2, column: 1 },
          { row: 0, column: 3 },
          { row: 1, column: 0 },
        ],
      }),
      { rows: 8, columns: 8 },
    );
    expect(validated.sourceCells).toEqual([
      { row: 0, column: 3 },
      { row: 1, column: 0 },
      { row: 2, column: 1 },
    ]);
  });

  it('rejects empty source list', () => {
    expect(() => validateRiftHungerDefinition(threatDefinition({ sourceCells: [] }))).toThrowError(
      BoardDomainError,
    );
  });

  it('rejects duplicate source cells', () => {
    expect(() =>
      validateRiftHungerDefinition(
        threatDefinition({
          sourceCells: [
            { row: 1, column: 1 },
            { row: 1, column: 1 },
          ],
        }),
      ),
    ).toThrowError(/duplicate/);
  });

  it('rejects invalid coordinates and intervals', () => {
    expect(() =>
      validateRiftHungerDefinition(threatDefinition({ sourceCells: [{ row: -1, column: 0 }] })),
    ).toThrowError(BoardDomainError);
    expect(() =>
      validateRiftHungerDefinition(threatDefinition({ spreadInterval: 0 })),
    ).toThrowError(BoardDomainError);
    expect(() => validateRiftHungerDefinition(threatDefinition({ hungerMaximum: 0 }))).toThrowError(
      BoardDomainError,
    );
  });

  it('rejects unknown kind and spread priority', () => {
    expect(() =>
      validateRiftHungerDefinition({
        ...threatDefinition(),
        kind: 'other' as 'rift-hunger',
      }),
    ).toThrowError(/unsupported threat kind/);
    expect(() =>
      validateRiftHungerDefinition({
        ...threatDefinition(),
        spreadPriority: 'smart' as 'orthogonal-stable-coordinate',
      }),
    ).toThrowError(/spreadPriority/);
  });

  it('keeps existing normal definitions valid without threat', () => {
    const validated = validateLevelDefinition(makeDefinition());
    expect(validated.threat).toBeUndefined();
  });
});

describe('rift hunger initialization', () => {
  it('starts sources corrupted without hunger and selects stable frontier telegraph', () => {
    const state = createInitialRiftHungerState({
      definition: threatDefinition({ sourceCells: [{ row: 1, column: 1 }] }),
      boardDimensions: { rows: 3, columns: 3 },
    });

    expect(state.corruptedCells).toEqual([{ row: 1, column: 1 }]);
    expect(state.hungerCurrent).toBe(0);
    expect(state.spreadGeneration).toBe(0);
    expect(state.acceptedMovesUntilSpread).toBe(3);
    expect(state.status).toBe('active');
    // Orthogonal neighbors in row-major order: (0,1), (1,0), (1,2), (2,1)
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });
  });

  it('handles corner and edge sources', () => {
    const corner = createInitialRiftHungerState({
      definition: threatDefinition({ sourceCells: [{ row: 0, column: 0 }] }),
      boardDimensions: { rows: 3, columns: 3 },
    });
    expect(corner.threatenedCell).toEqual({ row: 0, column: 1 });

    const edge = createInitialRiftHungerState({
      definition: threatDefinition({ sourceCells: [{ row: 0, column: 1 }] }),
      boardDimensions: { rows: 3, columns: 3 },
    });
    expect(edge.threatenedCell).toEqual({ row: 0, column: 0 });
  });

  it('dedupes multi-source frontiers and becomes contained when enclosed', () => {
    const multi = createInitialRiftHungerState({
      definition: threatDefinition({
        sourceCells: [
          { row: 0, column: 0 },
          { row: 0, column: 1 },
        ],
      }),
      boardDimensions: { rows: 2, columns: 2 },
    });
    expect(multi.corruptedCells).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
    ]);
    expect(multi.threatenedCell).toEqual({ row: 1, column: 0 });

    const full = createInitialRiftHungerState({
      definition: threatDefinition({
        sourceCells: [
          { row: 0, column: 0 },
          { row: 0, column: 1 },
          { row: 1, column: 0 },
          { row: 1, column: 1 },
        ],
      }),
      boardDimensions: { rows: 2, columns: 2 },
    });
    expect(full.status).toBe('contained');
    expect(full.threatenedCell).toBeNull();
  });

  it('does not mutate input arrays and returns defensive clones', () => {
    const sourceCells = [{ row: 0, column: 0 }];
    const definition = threatDefinition({ sourceCells });
    const state = createInitialRiftHungerState({
      definition,
      boardDimensions: { rows: 3, columns: 3 },
    });
    sourceCells[0].row = 9;
    state.corruptedCells[0].row = 8;
    const again = cloneRiftHungerState(state);
    again.corruptedCells[0].row = 7;
    expect(definition.sourceCells[0]).toEqual({ row: 9, column: 0 });
    expect(state.corruptedCells[0]).toEqual({ row: 8, column: 0 });
  });
});

describe('rift hunger accepted-move countdown and spread', () => {
  const dimensions = { rows: 3, columns: 3 };
  const definition = threatDefinition({
    sourceCells: [{ row: 0, column: 0 }],
    spreadInterval: 3,
    hungerMaximum: 2,
  });

  it('decrements once per accepted advance and spreads on the third', () => {
    let state = createInitialRiftHungerState({ definition, boardDimensions: dimensions });
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });

    const first = advanceRiftHungerForAcceptedMove({
      definition,
      state,
      boardDimensions: dimensions,
    });
    expect(first.countdownBefore).toBe(3);
    expect(first.countdownAfter).toBe(2);
    expect(first.spreadEvent).toBeNull();
    expect(first.nextState.threatenedCell).toEqual({ row: 0, column: 1 });

    const second = advanceRiftHungerForAcceptedMove({
      definition,
      state: first.nextState,
      boardDimensions: dimensions,
    });
    expect(second.countdownAfter).toBe(1);
    expect(second.spreadEvent).toBeNull();

    const third = advanceRiftHungerForAcceptedMove({
      definition,
      state: second.nextState,
      boardDimensions: dimensions,
    });
    expect(third.spreadEvent).not.toBeNull();
    expect(third.spreadEvent?.coordinate).toEqual({ row: 0, column: 1 });
    expect(third.spreadEvent?.hungerBefore).toBe(0);
    expect(third.spreadEvent?.hungerAfter).toBe(1);
    expect(third.spreadEvent?.generation).toBe(1);
    expect(third.nextState.corruptedCells).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
    ]);
    expect(third.nextState.acceptedMovesUntilSpread).toBe(3);
    // Frontier after corrupting (0,0)+(0,1): (0,2), (1,0), (1,1) in row-major order.
    expect(third.nextState.threatenedCell).toEqual({ row: 0, column: 2 });
  });

  it('overwhelms exactly at hungerMaximum and contains when frontier ends', () => {
    let state = createInitialRiftHungerState({
      definition: threatDefinition({
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 1,
        hungerMaximum: 1,
      }),
      boardDimensions: { rows: 1, columns: 2 },
    });
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });

    const transition = advanceRiftHungerForAcceptedMove({
      definition: threatDefinition({
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 1,
        hungerMaximum: 1,
      }),
      state,
      boardDimensions: { rows: 1, columns: 2 },
    });
    expect(transition.nextState.status).toBe('overwhelmed');
    expect(transition.nextState.hungerCurrent).toBe(1);
    expect(transition.nextState.threatenedCell).toBeNull();
  });

  it('excludes protected cells from targeting and expires after accepted moves', () => {
    let state = createInitialRiftHungerState({
      definition: threatDefinition({
        sourceCells: [{ row: 1, column: 1 }],
        spreadInterval: 3,
      }),
      boardDimensions: dimensions,
    });
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });

    state = addOrRefreshRiftHungerProtection({
      state,
      coordinate: { row: 0, column: 1 },
      remainingAcceptedMoves: 1,
    });
    // Locked telegraph becomes ineligible → retarget to next frontier cell.
    const advanced = advanceRiftHungerForAcceptedMove({
      definition: threatDefinition({
        sourceCells: [{ row: 1, column: 1 }],
        spreadInterval: 3,
      }),
      state,
      boardDimensions: dimensions,
    });
    expect(advanced.nextState.threatenedCell).toEqual({ row: 1, column: 0 });
    expect(advanced.nextState.protectedCells).toEqual([]);
  });
});

describe('rift hunger level lifecycle integration', () => {
  it('does not advance threat on rejected or terminal moves', () => {
    const definition = makeDefinition({
      threat: threatDefinition({ sourceCells: [{ row: 0, column: 0 }], spreadInterval: 3 }),
    });
    const board = matchReadyBoard();
    const session = createLevelSession({ definition, initialBoard: board });
    expect(session.state.threatState?.acceptedMovesUntilSpread).toBe(3);

    const rejected = applyLevelMove({
      definition,
      state: session.state,
      from: { row: 0, column: 0 },
      to: { row: 2, column: 2 },
    });
    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted) {
      expect(rejected.state.threatState?.acceptedMovesUntilSpread).toBe(3);
    }
  });

  it('advances threat once per accepted move and wins before pending spread', () => {
    const definition = makeDefinition({
      moveLimit: 5,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 10 }],
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 3,
        hungerMaximum: 5,
      }),
    });

    const board = matchReadyBoard();
    const created = createLevelSession({ definition, initialBoard: board });
    const before = created.state.threatState!;
    expect(before.acceptedMovesUntilSpread).toBe(3);

    const won = applyLevelMove({
      definition,
      state: created.state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(won.accepted).toBe(true);
    if (won.accepted) {
      expect(won.nextStatus).toBe('won');
      expect(won.threatTransition).toBeUndefined();
      expect(won.nextState.threatState?.acceptedMovesUntilSpread).toBe(3);
      expect(won.nextState.threatState?.corruptedCells).toEqual(before.corruptedCells);
    }
  });

  it('fails by overwhelm when objectives remain incomplete', () => {
    const definition = makeDefinition({
      moveLimit: 10,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
      threat: threatDefinition({
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 1,
        hungerMaximum: 1,
      }),
    });
    const board = matchReadyBoard();
    const created = createLevelSession({ definition, initialBoard: board });
    const result = applyLevelMove({
      definition,
      state: created.state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.nextStatus).toBe('failed');
      expect(result.threatTransition?.statusAfter).toBe('overwhelmed');
      expect(result.threatTransition?.spreadEvent).not.toBeNull();
    }
  });

  it('leaves no-threat levels without threatTransition metadata', () => {
    const definition = makeDefinition();
    const board = matchReadyBoard();
    const created = createLevelSession({ definition, initialBoard: board });
    expect(created.state.threatState).toBeUndefined();
    const result = applyLevelMove({
      definition,
      state: created.state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.threatTransition).toBeUndefined();
      expect(result.nextState.threatState).toBeUndefined();
    }
  });

  it('clones threat state from PuzzleSessionController.getState and recreates on restart', () => {
    const definition = makeDefinition({
      threat: threatDefinition({ sourceCells: [{ row: 0, column: 0 }] }),
    });
    const board = matchReadyBoard();
    const controller = new PuzzleSessionController(
      definition,
      () => createLevelSession({ definition, initialBoard: board }).state,
    );

    const viewed = controller.getState();
    viewed.threatState!.acceptedMovesUntilSpread = 99;
    expect(controller.getState().threatState?.acceptedMovesUntilSpread).toBe(3);

    const move = controller.requestSwap({ row: 0, column: 1 }, { row: 1, column: 1 });
    expect(move.accepted).toBe(true);
    expect(controller.getState().threatState?.acceptedMovesUntilSpread).toBe(2);

    const restarted = controller.restart();
    expect(restarted.threatState?.acceptedMovesUntilSpread).toBe(3);
    expect(restarted.threatState?.spreadGeneration).toBe(0);
    expect(controller.getLastMoveResult()).toBeNull();
  });
});
