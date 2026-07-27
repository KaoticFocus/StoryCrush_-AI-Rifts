import { Board } from './Board';
import { BoardDomainError } from './errors';
import { findMatchRuns } from './matchDetection';
import { hasPlayableSwap } from './validMoves';

export function assertStableBoard(board: Board): void {
  const matchResult = findMatchRuns(board);
  if (matchResult.runs.length > 0) {
    throw new BoardDomainError(
      'board-not-stable',
      `board contains ${matchResult.runs.length} active match runs and must be resolved before dead-board analysis`,
    );
  }
}

export function isDeadBoard(board: Board): boolean {
  assertStableBoard(board);
  return !hasPlayableSwap(board);
}
