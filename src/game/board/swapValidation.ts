import { Board } from './Board';
import {
  BoardCoordinate,
  ScoringSwapValidationResult,
  StructuralSwapValidationResult,
} from './boardTypes';
import {
  coordinateKey,
  unavailableCoordinateKeySet,
  validateUnavailableCoordinates,
} from './boardAvailability';
import { findMatchRuns } from './matchDetection';

function isSameCoordinate(first: BoardCoordinate, second: BoardCoordinate): boolean {
  return first.row === second.row && first.column === second.column;
}

export function areCoordinatesOrthogonallyAdjacent(
  first: BoardCoordinate,
  second: BoardCoordinate,
): boolean {
  const rowDistance = Math.abs(first.row - second.row);
  const columnDistance = Math.abs(first.column - second.column);
  return (rowDistance === 1 && columnDistance === 0) || (rowDistance === 0 && columnDistance === 1);
}

export function validateStructuralSwap(
  board: Board,
  first: BoardCoordinate,
  second: BoardCoordinate,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): StructuralSwapValidationResult {
  if (!board.isWithinBounds(first)) {
    return { isValid: false, reason: 'first-coordinate-out-of-bounds' };
  }

  if (!board.isWithinBounds(second)) {
    return { isValid: false, reason: 'second-coordinate-out-of-bounds' };
  }

  const unavailableKeys = unavailableCoordinateKeySet(
    validateUnavailableCoordinates(unavailableCoordinates, board.getDimensions()),
  );
  if (unavailableKeys.has(coordinateKey(first))) {
    return { isValid: false, reason: 'first-coordinate-unavailable' };
  }

  if (unavailableKeys.has(coordinateKey(second))) {
    return { isValid: false, reason: 'second-coordinate-unavailable' };
  }

  if (isSameCoordinate(first, second)) {
    return { isValid: false, reason: 'same-coordinate' };
  }

  if (!areCoordinatesOrthogonallyAdjacent(first, second)) {
    return { isValid: false, reason: 'not-adjacent' };
  }

  return { isValid: true };
}

function coordinateInRun(
  runCoordinates: readonly BoardCoordinate[],
  coordinate: BoardCoordinate,
): boolean {
  return runCoordinates.some(
    (entry) => entry.row === coordinate.row && entry.column === coordinate.column,
  );
}

export function createsMatchAfterSwap(
  board: Board,
  first: BoardCoordinate,
  second: BoardCoordinate,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): boolean {
  const structural = validateStructuralSwap(board, first, second, unavailableCoordinates);
  if (!structural.isValid) {
    return false;
  }

  const swapped = board.swapPieces(first, second);
  const result = findMatchRuns(swapped, unavailableCoordinates);

  return result.runs.some(
    (run) => coordinateInRun(run.coordinates, first) || coordinateInRun(run.coordinates, second),
  );
}

export function validateScoringSwap(
  board: Board,
  first: BoardCoordinate,
  second: BoardCoordinate,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): ScoringSwapValidationResult {
  const structural = validateStructuralSwap(board, first, second, unavailableCoordinates);
  if (!structural.isValid) {
    const isUnavailable =
      structural.reason === 'first-coordinate-unavailable' ||
      structural.reason === 'second-coordinate-unavailable';
    return {
      isValid: false,
      reason: isUnavailable ? 'cell-unavailable' : 'structurally-invalid',
      structuralReason: structural.reason,
      board,
    };
  }

  const swappedBoard = board.swapPieces(first, second);
  const matchResult = findMatchRuns(swappedBoard, unavailableCoordinates);
  const hasRelevantMatch = matchResult.runs.some(
    (run) => coordinateInRun(run.coordinates, first) || coordinateInRun(run.coordinates, second),
  );

  if (!hasRelevantMatch) {
    return {
      isValid: false,
      reason: 'no-match-created',
      board,
      swappedBoard,
      matchResult,
    };
  }

  return {
    isValid: true,
    board: swappedBoard,
    swappedBoard,
    matchResult,
  };
}
