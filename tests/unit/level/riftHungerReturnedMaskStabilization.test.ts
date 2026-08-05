import { describe, expect, it } from 'vitest';
import {
  createPieceInventory,
  findMatchRuns,
  findPlayableSwaps,
  generateBoard,
} from '../../../src/game/board';
import { getPlayableLevelContent } from '../../../src/game/content/levelCatalog';
import {
  applyLevelMove,
  createLevelSession,
  DEFAULT_SCORING_RULES,
  type AcceptedLevelMoveResult,
  type LevelDefinition,
  type LevelSessionState,
  type RiftHungerDefinition,
} from '../../../src/game/level';
import { selectHint } from '../../../src/game/presentation/hints/selectHint';
import { createPuzzlePresentationState } from '../../../src/game/presentation/state/presentationPermissions';
import { standardBoard } from '../board/boardTestHelpers';

const SEED_1812_PREFIX = [
  { from: { row: 0, column: 3 }, to: { row: 0, column: 4 } },
  { from: { row: 0, column: 4 }, to: { row: 1, column: 4 } },
  { from: { row: 0, column: 2 }, to: { row: 1, column: 2 } },
  { from: { row: 2, column: 1 }, to: { row: 3, column: 1 } },
  { from: { row: 1, column: 2 }, to: { row: 1, column: 3 } },
  { from: { row: 0, column: 4 }, to: { row: 1, column: 4 } },
  { from: { row: 1, column: 2 }, to: { row: 2, column: 2 } },
  { from: { row: 0, column: 3 }, to: { row: 0, column: 4 } },
  { from: { row: 0, column: 4 }, to: { row: 1, column: 4 } },
  { from: { row: 2, column: 4 }, to: { row: 2, column: 5 } },
] as const;

const SEED_1812_STABILIZING_SWAP = {
  from: { row: 5, column: 4 },
  to: { row: 6, column: 4 },
} as const;

function assertActiveReturnedStateInvariants(result: AcceptedLevelMoveResult): void {
  expect(result.accepted).toBe(true);
  expect(result.nextState.status).toBe('active');

  const returnedMask = result.nextState.threatState?.corruptedCells ?? [];
  expect(findMatchRuns(result.nextState.board, returnedMask).runs).toHaveLength(0);
  const playable = findPlayableSwaps(result.nextState.board, returnedMask);
  expect(playable.length).toBeGreaterThan(0);

  if (result.threatTransition) {
    expect(result.nextState.threatState).toEqual(result.threatTransition.nextState);
    expect(result.previousState.threatState).toEqual(result.threatTransition.previousState);
  }

  const hint = selectHint({
    board: result.nextState.board,
    levelIsActive: true,
    hintsEnabled: true,
    presentationState: createPuzzlePresentationState(),
    unavailableCoordinates: returnedMask,
  });
  expect(hint.kind).toBe('hint');
  if (hint.kind === 'hint') {
    expect(
      playable.some(
        (move) =>
          (move.from.row === hint.move.from.row &&
            move.from.column === hint.move.from.column &&
            move.to.row === hint.move.to.row &&
            move.to.column === hint.move.to.column) ||
          (move.from.row === hint.move.to.row &&
            move.from.column === hint.move.to.column &&
            move.to.row === hint.move.from.row &&
            move.to.column === hint.move.from.column),
      ),
    ).toBe(true);
  }
}

function applySequence(
  definition: LevelDefinition,
  state: LevelSessionState,
  sequence: readonly {
    from: { row: number; column: number };
    to: { row: number; column: number };
  }[],
): LevelSessionState {
  let current = state;
  for (const move of sequence) {
    const result = applyLevelMove({
      definition,
      state: current,
      from: move.from,
      to: move.to,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      throw new Error('expected accepted move');
    }
    current = result.nextState;
  }
  return current;
}

describe('RH-1 returned-mask resting-board stabilization', () => {
  it('stabilizes seed 1812 step-10 cleanse that previously exposed matches', () => {
    const content = getPlayableLevelContent('rift-erosion-lab')!;
    const seed = 1812;
    const board = generateBoard({
      rows: content.boardRows,
      columns: content.boardColumns,
      pieceTypes: content.allowedPieceTypes,
      seed,
    });
    const definition = { ...content.definition, seed };
    const started = createLevelSession({ definition, initialBoard: board }).state;
    const beforeStabilizing = applySequence(definition, started, SEED_1812_PREFIX);

    const scoreBefore = beforeStabilizing.score;
    const hungerBefore = beforeStabilizing.threatState!.hungerCurrent;
    const generationBefore = beforeStabilizing.threatState!.spreadGeneration;
    const countdownBefore = beforeStabilizing.threatState!.acceptedMovesUntilSpread;

    const result = applyLevelMove({
      definition,
      state: beforeStabilizing,
      from: SEED_1812_STABILIZING_SWAP.from,
      to: SEED_1812_STABILIZING_SWAP.to,
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    expect(result.nextState.status).toBe('active');
    expect(result.threatTransition?.cleanseEvents.length).toBeGreaterThan(0);
    const cleansed = result.threatTransition!.cleanseEvents.map((event) => event.coordinate);
    expect(cleansed).toEqual([{ row: 0, column: 2 }]);

    const returnedMask = result.nextState.threatState?.corruptedCells ?? [];
    for (const coordinate of cleansed) {
      expect(
        returnedMask.some(
          (entry) => entry.row === coordinate.row && entry.column === coordinate.column,
        ),
      ).toBe(false);
    }

    expect(result.reshuffle).toBeDefined();
    expect(findMatchRuns(result.nextState.board, returnedMask).runs).toHaveLength(0);
    expect(findPlayableSwaps(result.nextState.board, returnedMask).length).toBeGreaterThan(0);
    assertActiveReturnedStateInvariants(result);

    expect(result.reshuffle!.originalInventory).toEqual(result.reshuffle!.reshuffledInventory);
    expect(createPieceInventory(result.nextState.board)).toEqual(
      result.reshuffle!.reshuffledInventory,
    );

    // Stabilization must not resolve exposed matches as another cascade:
    // score/collection/objectives already finalized from the accepted resolution only.
    expect(result.scoreAfter).toBe(result.scoreBefore + result.scoreCalculation.totalAwardedPoints);
    expect(result.scoreAfter).toBeGreaterThanOrEqual(scoreBefore);
    expect(result.movesConsumed).toBe(1);
    expect(result.collectionEvents.every((event) => Number.isInteger(event.stepIndex))).toBe(true);

    expect(result.nextState.threatState).toEqual(result.threatTransition!.nextState);
    expect(result.threatTransition!.cleanseEvents).toHaveLength(cleansed.length);
    expect(result.nextState.threatState!.hungerCurrent).toBe(
      result.threatTransition!.nextState.hungerCurrent,
    );
    expect(result.nextState.threatState!.spreadGeneration).toBe(
      result.threatTransition!.nextState.spreadGeneration,
    );
    expect(result.nextState.threatState!.acceptedMovesUntilSpread).toBe(
      result.threatTransition!.nextState.acceptedMovesUntilSpread,
    );

    // Threat advances at most once for this accepted move (already encoded in transition).
    expect(result.nextState.threatState!.hungerCurrent - hungerBefore).toBeLessThanOrEqual(1);
    expect(result.nextState.threatState!.spreadGeneration).toBeGreaterThanOrEqual(generationBefore);
    expect(result.nextState.threatState!.spreadGeneration - generationBefore).toBeLessThanOrEqual(
      1,
    );
    void countdownBefore;

    const again = applyLevelMove({
      definition,
      state: beforeStabilizing,
      from: SEED_1812_STABILIZING_SWAP.from,
      to: SEED_1812_STABILIZING_SWAP.to,
    });
    expect(again.accepted).toBe(true);
    if (!again.accepted) {
      return;
    }
    expect(again.nextState.board.toGridSnapshot()).toEqual(result.nextState.board.toGridSnapshot());
    expect(again.reshuffle?.randomAttempts).toBe(result.reshuffle?.randomAttempts);
    expect(again.reshuffle?.fallbackSearchUsed).toBe(result.reshuffle?.fallbackSearchUsed);
    expect(again.threatTransition).toEqual(result.threatTransition);

    // Nested returns are cloned / not aliased to input state.
    again.nextState.threatState!.corruptedCells[0]!.row = 99;
    expect(beforeStabilizing.threatState!.corruptedCells[0]!.row).not.toBe(99);
    expect(result.nextState.threatState!.corruptedCells[0]!.row).not.toBe(99);
  });

  it('keeps win-before-threat and does not stabilize terminal boards', () => {
    const definition: LevelDefinition = {
      id: 'stabilize-win-priority',
      moveLimit: 5,
      allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [{ id: 'score-main', kind: 'score', targetScore: 1 }],
      scoring: { ...DEFAULT_SCORING_RULES },
      seed: 7,
      threat: {
        kind: 'rift-hunger',
        sourceCells: [{ row: 2, column: 2 }],
        spreadInterval: 1,
        hungerMaximum: 5,
        spreadPriority: 'orthogonal-stable-coordinate',
      } satisfies RiftHungerDefinition,
    };
    // Match the three rubies; score award exceeds targetScore 1 → win before threat.
    const board = standardBoard([
      ['ruby', 'sapphire', 'ruby'],
      ['topaz', 'ruby', 'emerald'],
      ['amethyst', 'pearl', 'topaz'],
    ]);
    const session = createLevelSession({ definition, initialBoard: board });
    const playable = findPlayableSwaps(
      session.state.board,
      session.state.threatState?.corruptedCells,
    );
    expect(playable.length).toBeGreaterThan(0);
    const choice = playable[0]!;
    const result = applyLevelMove({
      definition,
      state: session.state,
      from: choice.from,
      to: choice.to,
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }
    expect(result.nextStatus).toBe('won');
    expect(result.threatTransition).toBeUndefined();
    // Terminal boards are not rearranged for playability.
    expect(result.reshuffle).toBeUndefined();
  });

  it('asserts returned-state invariants across cleanse and calm paths', () => {
    const content = getPlayableLevelContent('rift-erosion-lab')!;
    const seed = 1812;
    const board = generateBoard({
      rows: content.boardRows,
      columns: content.boardColumns,
      pieceTypes: content.allowedPieceTypes,
      seed,
    });
    const definition = { ...content.definition, seed };
    let state = createLevelSession({ definition, initialBoard: board }).state;

    for (let step = 0; step < 6 && state.status === 'active'; step += 1) {
      const playable = findPlayableSwaps(state.board, state.threatState?.corruptedCells ?? []);
      expect(playable.length).toBeGreaterThan(0);
      const choice = playable[0]!;
      const result = applyLevelMove({
        definition,
        state,
        from: choice.from,
        to: choice.to,
      });
      expect(result.accepted).toBe(true);
      if (!result.accepted) {
        return;
      }
      if (result.nextState.status === 'active') {
        assertActiveReturnedStateInvariants(result);
      }
      state = result.nextState;
    }

    const calm = getPlayableLevelContent('archive-stabilization')!;
    const calmBoard = generateBoard({
      rows: calm.boardRows,
      columns: calm.boardColumns,
      pieceTypes: calm.allowedPieceTypes,
      seed: calm.definition.seed,
    });
    const calmDefinition = { ...calm.definition };
    let calmState = createLevelSession({
      definition: calmDefinition,
      initialBoard: calmBoard,
    }).state;
    const calmPlayable = findPlayableSwaps(calmState.board);
    const calmResult = applyLevelMove({
      definition: calmDefinition,
      state: calmState,
      from: calmPlayable[0]!.from,
      to: calmPlayable[0]!.to,
    });
    expect(calmResult.accepted).toBe(true);
    if (!calmResult.accepted) {
      return;
    }
    if (calmResult.nextState.status === 'active') {
      assertActiveReturnedStateInvariants(calmResult);
      expect(calmResult.nextState.threatState).toBeUndefined();
    }
  });
});
