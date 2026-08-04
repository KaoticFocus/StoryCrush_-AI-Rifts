import { Board } from './Board';
import { BoardCoordinate, PlayableSwap, ValidScoringSwap } from './boardTypes';
import { validatePlayableSwap } from './playableSwapValidation';
import { validateScoringSwap } from './swapValidation';

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

export function findValidScoringSwaps(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): ValidScoringSwap[] {
  const { rows, columns } = board.getDimensions();
  const swaps: ValidScoringSwap[] = [];

  // Deterministic traversal: row-major, right neighbor then bottom neighbor.
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const from = { row, column };

      if (column + 1 < columns) {
        const right = { row, column: column + 1 };
        const rightResult = validateScoringSwap(board, from, right, unavailableCoordinates);
        if (rightResult.isValid) {
          swaps.push({ from: cloneCoordinate(from), to: cloneCoordinate(right) });
        }
      }

      if (row + 1 < rows) {
        const down = { row: row + 1, column };
        const downResult = validateScoringSwap(board, from, down, unavailableCoordinates);
        if (downResult.isValid) {
          swaps.push({ from: cloneCoordinate(from), to: cloneCoordinate(down) });
        }
      }
    }
  }

  return swaps;
}

export function hasValidScoringSwap(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): boolean {
  const { rows, columns } = board.getDimensions();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const from = { row, column };

      if (column + 1 < columns) {
        const right = { row, column: column + 1 };
        if (validateScoringSwap(board, from, right, unavailableCoordinates).isValid) {
          return true;
        }
      }

      if (row + 1 < rows) {
        const down = { row: row + 1, column };
        if (validateScoringSwap(board, from, down, unavailableCoordinates).isValid) {
          return true;
        }
      }
    }
  }

  return false;
}

export function countValidScoringSwaps(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): number {
  return findValidScoringSwaps(board, unavailableCoordinates).length;
}

export function findPlayableSwaps(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): PlayableSwap[] {
  const { rows, columns } = board.getDimensions();
  const swaps: PlayableSwap[] = [];

  // Deterministic traversal: row-major, right neighbor then bottom neighbor.
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const from = { row, column };

      if (column + 1 < columns) {
        const right = { row, column: column + 1 };
        const rightResult = validatePlayableSwap(board, from, right, unavailableCoordinates);
        if (rightResult.isValid && rightResult.kind) {
          swaps.push({
            from: cloneCoordinate(from),
            to: cloneCoordinate(right),
            kind: rightResult.kind,
          });
        }
      }

      if (row + 1 < rows) {
        const down = { row: row + 1, column };
        const downResult = validatePlayableSwap(board, from, down, unavailableCoordinates);
        if (downResult.isValid && downResult.kind) {
          swaps.push({
            from: cloneCoordinate(from),
            to: cloneCoordinate(down),
            kind: downResult.kind,
          });
        }
      }
    }
  }

  return swaps;
}

export function hasPlayableSwap(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): boolean {
  const { rows, columns } = board.getDimensions();

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const from = { row, column };

      if (column + 1 < columns) {
        const right = { row, column: column + 1 };
        if (validatePlayableSwap(board, from, right, unavailableCoordinates).isValid) {
          return true;
        }
      }

      if (row + 1 < rows) {
        const down = { row: row + 1, column };
        if (validatePlayableSwap(board, from, down, unavailableCoordinates).isValid) {
          return true;
        }
      }
    }
  }

  return false;
}

export function countPlayableSwaps(
  board: Board,
  unavailableCoordinates: readonly BoardCoordinate[] = [],
): number {
  return findPlayableSwaps(board, unavailableCoordinates).length;
}
