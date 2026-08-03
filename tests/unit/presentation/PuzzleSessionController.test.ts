import { describe, expect, it } from 'vitest';
import { findMatchRuns, findPlayableSwaps } from '../../../src/game/board';
import {
  createPrototypeLevelSession,
  prototypeLevelDefinition,
} from '../../../src/game/content/prototypeLevel';
import { PuzzleSessionController } from '../../../src/game/presentation/PuzzleSessionController';

function createController() {
  return new PuzzleSessionController(
    prototypeLevelDefinition,
    () => createPrototypeLevelSession().state,
  );
}

describe('PuzzleSessionController', () => {
  it('exposes a stable active initial prototype session', () => {
    const controller = createController();
    const state = controller.getState();

    expect(state.status).toBe('active');
    expect(state.movesRemaining).toBe(15);
    expect(state.board.getDimensions()).toEqual({ rows: 8, columns: 8 });
    expect(findMatchRuns(state.board).runs).toHaveLength(0);
  });

  it('updates controller state after an accepted ordinary move', () => {
    const controller = createController();
    const before = controller.getState();

    const result = controller.requestSwap({ row: 0, column: 1 }, { row: 1, column: 1 });

    expect(result.accepted).toBe(true);
    if (!result.accepted) {
      return;
    }

    const after = controller.getState();

    expect(after.score).toBe(result.scoreAfter);
    expect(after.movesRemaining).toBe(before.movesRemaining - 1);
    expect(after.acceptedMoveCount).toBe(before.acceptedMoveCount + 1);
    expect(after.board.toGridSnapshot()).toEqual(result.nextState.board.toGridSnapshot());
  });

  it('preserves current state after a rejected move', () => {
    const controller = createController();
    const before = controller.getState();

    const result = controller.requestSwap({ row: 0, column: 0 }, { row: 0, column: 1 });

    expect(result.accepted).toBe(false);
    if (result.accepted) {
      return;
    }

    const after = controller.getState();
    expect(result.kind).toBe('rejected');
    expect(after.board.toGridSnapshot()).toEqual(before.board.toGridSnapshot());
    expect(after.score).toBe(before.score);
    expect(after.movesRemaining).toBe(before.movesRemaining);
  });

  it('preserves terminal state after further move requests', () => {
    const controller = createController();

    // Drive until win/fail. Phase 3B cross clears reshape the board, so fixed
    // swap sequences alone may reject before the session ends.
    for (let attempt = 0; attempt < 80 && controller.getState().status === 'active'; attempt += 1) {
      const swaps = findPlayableSwaps(controller.getState().board);
      if (swaps.length === 0) {
        break;
      }
      controller.requestSwap(swaps[0].from, swaps[0].to);
    }

    const terminalState = controller.getState();
    expect(terminalState.status).not.toBe('active');

    const result = controller.requestSwap({ row: 0, column: 0 }, { row: 0, column: 1 });

    expect(result.accepted).toBe(false);
    if (result.accepted) {
      return;
    }

    expect(result.kind).toBe('terminal');
    expect(controller.getState()).toEqual(terminalState);
  });

  it('restart recreates the deterministic initial state without mutating older snapshots', () => {
    const controller = createController();
    const initial = controller.getState();

    controller.requestSwap({ row: 0, column: 1 }, { row: 1, column: 1 });
    const mid = controller.getState();
    const restarted = controller.restart();

    expect(initial.board.toGridSnapshot()).not.toEqual(mid.board.toGridSnapshot());
    expect(restarted.board.toGridSnapshot()).toEqual(initial.board.toGridSnapshot());
    expect(restarted.score).toBe(initial.score);
    expect(restarted.movesRemaining).toBe(initial.movesRemaining);
    expect(controller.getState().board.toGridSnapshot()).toEqual(initial.board.toGridSnapshot());
  });
});
