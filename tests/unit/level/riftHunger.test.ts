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
  type RiftHungerState,
  validateLevelDefinition,
  validateRiftHungerDefinition,
  validateRiftHungerState,
  validateRiftHungerStateRelationship,
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

function baseActiveState(overrides?: Partial<RiftHungerState>): RiftHungerState {
  return {
    status: 'active',
    sourceCells: [{ row: 0, column: 0 }],
    corruptedCells: [{ row: 0, column: 0 }],
    threatenedCell: { row: 0, column: 1 },
    acceptedMovesUntilSpread: 3,
    spreadGeneration: 0,
    hungerCurrent: 0,
    protectedCells: [],
    ...overrides,
  };
}

const dims3 = { rows: 3, columns: 3 };

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

  it('dedupes multi-source frontiers and becomes contained with countdown 0 when enclosed', () => {
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
    expect(full.acceptedMovesUntilSpread).toBe(0);
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

describe('rift hunger state relationship validation', () => {
  const definition = threatDefinition();

  it('accepts a valid active relationship', () => {
    const validated = validateRiftHungerStateRelationship({
      definition,
      state: baseActiveState(),
      boardDimensions: dims3,
    });
    expect(validated.threatenedCell).toEqual({ row: 0, column: 1 });
  });

  it('rejects OOB coordinates across all collections', () => {
    expect(() =>
      validateRiftHungerStateRelationship({
        definition: threatDefinition({ sourceCells: [{ row: 9, column: 0 }] }),
        state: baseActiveState({
          sourceCells: [{ row: 9, column: 0 }],
          corruptedCells: [{ row: 9, column: 0 }],
          threatenedCell: { row: 9, column: 1 },
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          corruptedCells: [
            { row: 0, column: 0 },
            { row: 99, column: 0 },
          ],
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ threatenedCell: { row: 99, column: 99 } }),
        boardDimensions: dims3,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          protectedCells: [{ coordinate: { row: 99, column: 0 }, remainingAcceptedMoves: 1 }],
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('rejects duplicate coordinates', () => {
    expect(() =>
      validateRiftHungerStateRelationship({
        definition: threatDefinition({
          sourceCells: [
            { row: 0, column: 0 },
            { row: 0, column: 1 },
          ],
        }),
        state: baseActiveState({
          sourceCells: [
            { row: 0, column: 0 },
            { row: 0, column: 0 },
          ],
          corruptedCells: [
            { row: 0, column: 0 },
            { row: 0, column: 1 },
          ],
          threatenedCell: { row: 1, column: 0 },
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/duplicate/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          corruptedCells: [
            { row: 0, column: 0 },
            { row: 0, column: 0 },
          ],
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/duplicate/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          protectedCells: [
            { coordinate: { row: 1, column: 1 }, remainingAcceptedMoves: 1 },
            { coordinate: { row: 1, column: 1 }, remainingAcceptedMoves: 2 },
          ],
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/duplicate/);
  });

  it('rejects source mismatch and source missing from corruption', () => {
    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          sourceCells: [{ row: 1, column: 1 }],
          corruptedCells: [{ row: 1, column: 1 }],
          threatenedCell: { row: 1, column: 0 },
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/source/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          corruptedCells: [{ row: 1, column: 1 }],
          threatenedCell: { row: 1, column: 0 },
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/corruptedCells/);
  });

  it('rejects protected overlap and invalid status combinations', () => {
    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          protectedCells: [{ coordinate: { row: 0, column: 0 }, remainingAcceptedMoves: 1 }],
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/overlaps corruption/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ threatenedCell: null }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/threatenedCell/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ acceptedMovesUntilSpread: 0 }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/acceptedMovesUntilSpread/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ acceptedMovesUntilSpread: 4 }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/acceptedMovesUntilSpread/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ hungerCurrent: 4 }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/hungerCurrent/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          status: 'contained',
          threatenedCell: { row: 0, column: 1 },
          acceptedMovesUntilSpread: 0,
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/contained/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          status: 'contained',
          threatenedCell: null,
          acceptedMovesUntilSpread: 2,
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/contained/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          status: 'contained',
          threatenedCell: null,
          acceptedMovesUntilSpread: 0,
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/uncorrupted/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          status: 'overwhelmed',
          hungerCurrent: 1,
          threatenedCell: null,
          acceptedMovesUntilSpread: 0,
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/overwhelmed/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          status: 'overwhelmed',
          hungerCurrent: 4,
          threatenedCell: { row: 0, column: 1 },
          acceptedMovesUntilSpread: 0,
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/overwhelmed/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          status: 'overwhelmed',
          hungerCurrent: 4,
          threatenedCell: null,
          acceptedMovesUntilSpread: 1,
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/overwhelmed/);
  });

  it('rejects non-frontier telegraphs', () => {
    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ threatenedCell: { row: 0, column: 0 } }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/eligible/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({
          protectedCells: [{ coordinate: { row: 0, column: 1 }, remainingAcceptedMoves: 1 }],
          threatenedCell: { row: 0, column: 1 },
        }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/eligible/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ threatenedCell: { row: 1, column: 1 } }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/eligible/);

    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: baseActiveState({ threatenedCell: { row: 2, column: 2 } }),
        boardDimensions: dims3,
      }),
    ).toThrowError(/eligible/);
  });

  it('structural validator alone still does not enforce board bounds', () => {
    const structural = validateRiftHungerState(
      baseActiveState({ threatenedCell: { row: 99, column: 99 } }),
    );
    expect(structural.threatenedCell).toEqual({ row: 99, column: 99 });
    expect(() =>
      validateRiftHungerStateRelationship({
        definition,
        state: structural,
        boardDimensions: dims3,
      }),
    ).toThrowError(BoardDomainError);
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
    expect(third.nextState.threatenedCell).toEqual({ row: 0, column: 2 });
  });

  it('overwhelms exactly at hungerMaximum and contains when frontier ends', () => {
    const transition = advanceRiftHungerForAcceptedMove({
      definition: threatDefinition({
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 1,
        hungerMaximum: 1,
      }),
      state: createInitialRiftHungerState({
        definition: threatDefinition({
          sourceCells: [{ row: 0, column: 0 }],
          spreadInterval: 1,
          hungerMaximum: 1,
        }),
        boardDimensions: { rows: 1, columns: 2 },
      }),
      boardDimensions: { rows: 1, columns: 2 },
    });
    expect(transition.nextState.status).toBe('overwhelmed');
    expect(transition.nextState.hungerCurrent).toBe(1);
    expect(transition.nextState.threatenedCell).toBeNull();
  });

  it('rejects malformed telegraphs and inconsistent states without mutating input', () => {
    const oob = baseActiveState({
      threatenedCell: { row: 99, column: 99 },
      acceptedMovesUntilSpread: 1,
    });
    const oobBefore = cloneRiftHungerState(oob);
    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition,
        state: oob,
        boardDimensions: dimensions,
      }),
    ).toThrowError(BoardDomainError);
    expect(oob).toEqual(oobBefore);

    const disconnected = baseActiveState({
      threatenedCell: { row: 2, column: 2 },
      acceptedMovesUntilSpread: 1,
    });
    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition,
        state: disconnected,
        boardDimensions: dimensions,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition,
        state: baseActiveState({
          sourceCells: [{ row: 1, column: 1 }],
          corruptedCells: [{ row: 1, column: 1 }],
          threatenedCell: { row: 1, column: 0 },
        }),
        boardDimensions: dimensions,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition,
        state: baseActiveState({
          corruptedCells: [{ row: 1, column: 1 }],
          threatenedCell: { row: 1, column: 0 },
        }),
        boardDimensions: dimensions,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition,
        state: baseActiveState({
          status: 'overwhelmed',
          hungerCurrent: 1,
          threatenedCell: null,
          acceptedMovesUntilSpread: 0,
        }),
        boardDimensions: dimensions,
      }),
    ).toThrowError(BoardDomainError);
  });

  it('rejects safe-integer overflow for hunger and generation', () => {
    const hungerOverflow = baseActiveState({
      acceptedMovesUntilSpread: 1,
      hungerCurrent: Number.MAX_SAFE_INTEGER,
    });
    // Bypass relationship for construction — inject after cloning a valid path by
    // forcing a near-max hunger that relationship accepts only below maximum.
    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition: threatDefinition({ hungerMaximum: Number.MAX_SAFE_INTEGER }),
        state: {
          ...hungerOverflow,
          hungerCurrent: Number.MAX_SAFE_INTEGER,
        },
        boardDimensions: dimensions,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      advanceRiftHungerForAcceptedMove({
        definition: threatDefinition({ hungerMaximum: 2 }),
        state: baseActiveState({
          acceptedMovesUntilSpread: 1,
          spreadGeneration: Number.MAX_SAFE_INTEGER,
        }),
        boardDimensions: dimensions,
      }),
    ).toThrowError(/spreadGeneration|safe integer/);
  });
});

describe('rift hunger protection helper', () => {
  const definition = threatDefinition({
    sourceCells: [{ row: 1, column: 1 }],
    spreadInterval: 3,
  });
  const dimensions = dims3;

  it('adds, refreshes, sorts, and retargets the current telegraph immediately', () => {
    let state = createInitialRiftHungerState({ definition, boardDimensions: dimensions });
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });
    expect(state.acceptedMovesUntilSpread).toBe(3);

    state = addOrRefreshRiftHungerProtection({
      definition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 2, column: 1 },
      remainingAcceptedMoves: 2,
    });
    state = addOrRefreshRiftHungerProtection({
      definition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 1, column: 0 },
      remainingAcceptedMoves: 2,
    });
    expect(state.protectedCells.map((entry) => entry.coordinate)).toEqual([
      { row: 1, column: 0 },
      { row: 2, column: 1 },
    ]);

    state = addOrRefreshRiftHungerProtection({
      definition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 1, column: 0 },
      remainingAcceptedMoves: 5,
    });
    expect(state.protectedCells[0]?.remainingAcceptedMoves).toBe(5);

    const retargeted = addOrRefreshRiftHungerProtection({
      definition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 0, column: 1 },
      remainingAcceptedMoves: 1,
    });
    expect(retargeted.threatenedCell).toEqual({ row: 1, column: 2 });
    expect(retargeted.acceptedMovesUntilSpread).toBe(3);
  });

  it('rejects bounds, corrupted protection, and final-frontier protection', () => {
    const state = createInitialRiftHungerState({ definition, boardDimensions: dimensions });

    expect(() =>
      addOrRefreshRiftHungerProtection({
        definition,
        state,
        boardDimensions: dimensions,
        coordinate: { row: 99, column: 0 },
        remainingAcceptedMoves: 1,
      }),
    ).toThrowError(BoardDomainError);

    expect(() =>
      addOrRefreshRiftHungerProtection({
        definition,
        state,
        boardDimensions: dimensions,
        coordinate: { row: 1, column: 1 },
        remainingAcceptedMoves: 1,
      }),
    ).toThrowError(/corrupted/);

    // Protect every frontier neighbor except leave one, then reject sealing the last.
    let working = state;
    for (const coordinate of [
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 2 },
    ]) {
      working = addOrRefreshRiftHungerProtection({
        definition,
        state: working,
        boardDimensions: dimensions,
        coordinate,
        remainingAcceptedMoves: 2,
      });
    }
    expect(working.threatenedCell).toEqual({ row: 2, column: 1 });
    expect(() =>
      addOrRefreshRiftHungerProtection({
        definition,
        state: working,
        boardDimensions: dimensions,
        coordinate: { row: 2, column: 1 },
        remainingAcceptedMoves: 1,
      }),
    ).toThrowError(/final eligible frontier/);
  });

  it('value 1 protects during the next advance and expires afterward; post-tick selects next telegraph', () => {
    const localDefinition = threatDefinition({
      sourceCells: [{ row: 1, column: 1 }],
      spreadInterval: 1,
      hungerMaximum: 5,
    });
    let state = createInitialRiftHungerState({
      definition: localDefinition,
      boardDimensions: dimensions,
    });
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });

    state = addOrRefreshRiftHungerProtection({
      definition: localDefinition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 0, column: 1 },
      remainingAcceptedMoves: 1,
    });
    expect(state.threatenedCell).toEqual({ row: 1, column: 0 });
    expect(state.acceptedMovesUntilSpread).toBe(1);

    // Also protect the would-be post-spread early frontier cell so next telegraph
    // must be chosen after the protection tick clears value-1 entries.
    state = addOrRefreshRiftHungerProtection({
      definition: localDefinition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 0, column: 0 },
      remainingAcceptedMoves: 1,
    });

    const spread = advanceRiftHungerForAcceptedMove({
      definition: localDefinition,
      state,
      boardDimensions: dimensions,
    });
    expect(spread.spreadEvent?.coordinate).toEqual({ row: 1, column: 0 });
    expect(spread.nextState.protectedCells).toEqual([]);
    // After corrupting (1,1)+(1,0), frontier includes (0,0) once protection expired.
    expect(spread.nextState.threatenedCell).toEqual({ row: 0, column: 0 });
  });

  it('non-spread expiry does not break telegraph lock', () => {
    const localDefinition = threatDefinition({
      sourceCells: [{ row: 1, column: 1 }],
      spreadInterval: 3,
    });
    let state = createInitialRiftHungerState({
      definition: localDefinition,
      boardDimensions: dimensions,
    });
    state = addOrRefreshRiftHungerProtection({
      definition: localDefinition,
      state,
      boardDimensions: dimensions,
      coordinate: { row: 2, column: 1 },
      remainingAcceptedMoves: 1,
    });
    expect(state.threatenedCell).toEqual({ row: 0, column: 1 });

    const advanced = advanceRiftHungerForAcceptedMove({
      definition: localDefinition,
      state,
      boardDimensions: dimensions,
    });
    expect(advanced.spreadEvent).toBeNull();
    expect(advanced.nextState.threatenedCell).toEqual({ row: 0, column: 1 });
    expect(advanced.nextState.protectedCells).toEqual([]);
    expect(advanced.nextState.acceptedMovesUntilSpread).toBe(2);
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

    const wonDefinition = makeDefinition({
      moveLimit: 5,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 10 }],
      threat: threatDefinition({ sourceCells: [{ row: 2, column: 2 }], spreadInterval: 3 }),
    });
    const wonSession = createLevelSession({ definition: wonDefinition, initialBoard: board });
    const won = applyLevelMove({
      definition: wonDefinition,
      state: wonSession.state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(won.accepted).toBe(true);
    if (won.accepted) {
      expect(won.nextStatus).toBe('won');
      const terminal = applyLevelMove({
        definition: wonDefinition,
        state: won.nextState,
        from: { row: 0, column: 0 },
        to: { row: 0, column: 1 },
      });
      expect(terminal.accepted).toBe(false);
      if (!terminal.accepted && 'kind' in terminal) {
        expect(terminal.kind).toBe('terminal');
      }
      expect(won.nextState.threatState?.acceptedMovesUntilSpread).toBe(3);
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

  it('rejects malformed threat state at the level boundary before resolution', () => {
    const definition = makeDefinition({
      threat: threatDefinition({ sourceCells: [{ row: 0, column: 0 }], spreadInterval: 3 }),
    });
    const board = matchReadyBoard();
    const created = createLevelSession({ definition, initialBoard: board });
    const snapshot = {
      score: created.state.score,
      movesRemaining: created.state.movesRemaining,
      acceptedMoveCount: created.state.acceptedMoveCount,
      grid: created.state.board.toGridSnapshot(),
    };

    const cases: RiftHungerState[] = [
      {
        ...created.state.threatState!,
        status: 'overwhelmed',
        hungerCurrent: 4,
        threatenedCell: null,
        acceptedMovesUntilSpread: 0,
      },
      {
        ...created.state.threatState!,
        sourceCells: [{ row: 1, column: 1 }],
        corruptedCells: [{ row: 1, column: 1 }],
        threatenedCell: { row: 1, column: 0 },
      },
      {
        ...created.state.threatState!,
        threatenedCell: { row: 99, column: 99 },
      },
      {
        ...created.state.threatState!,
        threatenedCell: { row: 2, column: 2 },
      },
      {
        ...created.state.threatState!,
        corruptedCells: [{ row: 1, column: 1 }],
        threatenedCell: { row: 1, column: 0 },
      },
    ];

    for (const threatState of cases) {
      expect(() =>
        applyLevelMove({
          definition,
          state: { ...created.state, threatState },
          from: { row: 0, column: 1 },
          to: { row: 1, column: 1 },
        }),
      ).toThrowError(BoardDomainError);
      expect(created.state.score).toBe(snapshot.score);
      expect(created.state.movesRemaining).toBe(snapshot.movesRemaining);
      expect(created.state.acceptedMoveCount).toBe(snapshot.acceptedMoveCount);
      expect(created.state.board.toGridSnapshot()).toEqual(snapshot.grid);
    }
  });

  it('fails by overwhelm when objectives remain incomplete', () => {
    const definition = makeDefinition({
      moveLimit: 10,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
      threat: threatDefinition({
        // Keep source off the matchReadyBoard ruby line so the accepted swap still scores.
        sourceCells: [{ row: 2, column: 2 }],
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

  it('fails by move exhaustion when threat does not overwhelm', () => {
    const definition = makeDefinition({
      moveLimit: 1,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 3,
        hungerMaximum: 5,
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
      expect(result.threatTransition?.statusAfter).toBe('active');
      expect(result.threatTransition?.spreadEvent).toBeNull();
      expect(result.nextState.threatState?.acceptedMovesUntilSpread).toBe(2);
    }
  });

  it('same move overwhelm and move exhaustion remains failed with overwhelmed transition', () => {
    const definition = makeDefinition({
      moveLimit: 1,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
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
    }
  });

  it('advances threat once even when the accepted move cascades', () => {
    const definition = makeDefinition({
      moveLimit: 10,
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 50_000 }],
      threat: threatDefinition({
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 3,
        hungerMaximum: 8,
      }),
    });
    const created = createLevelSession({ definition, initialBoard: matchReadyBoard() });
    const beforeCountdown = created.state.threatState!.acceptedMovesUntilSpread;
    const result = applyLevelMove({
      definition,
      state: created.state,
      from: { row: 0, column: 1 },
      to: { row: 1, column: 1 },
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.resolution.steps.length).toBeGreaterThanOrEqual(1);
      expect(result.nextState.threatState?.acceptedMovesUntilSpread).toBe(beforeCountdown - 1);
      expect(result.threatTransition?.countdownBefore).toBe(beforeCountdown);
      expect(result.threatTransition?.countdownAfter).toBe(beforeCountdown - 1);
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
      threat: threatDefinition({ sourceCells: [{ row: 2, column: 2 }] }),
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
