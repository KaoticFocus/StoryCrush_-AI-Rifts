import { Board } from './Board';
import {
  BoardPiece,
  PieceType,
  RandomSource,
  RefillBoardResult,
  RefillPlacement,
} from './boardTypes';
import { BoardDomainError } from './errors';
import { createStandardPiece } from './boardPieces';
import { validateAllowedPieceTypes } from './boardValidation';
import { cloneResolvableGrid, validateResolvableGrid } from './resolutionGrid';

function pickPieceType(randomSource: RandomSource, pieceTypes: readonly PieceType[]): PieceType {
  const index = randomSource.nextInt(pieceTypes.length);

  if (!Number.isInteger(index) || index < 0 || index >= pieceTypes.length) {
    throw new BoardDomainError(
      'invalid-seed',
      `random source produced invalid index ${String(index)} for piece count ${pieceTypes.length}`,
    );
  }

  return pieceTypes[index];
}

export function refillBoard(
  grid: readonly (readonly (BoardPiece | null)[])[],
  pieceTypesInput: readonly string[],
  randomSource: RandomSource,
): RefillBoardResult {
  const snapshot = cloneResolvableGrid(grid);
  const { rows, columns } = validateResolvableGrid(snapshot);
  const pieceTypes = validateAllowedPieceTypes(pieceTypesInput);

  const filledGrid = cloneResolvableGrid(snapshot);
  const placements: RefillPlacement[] = [];

  for (let column = 0; column < columns; column += 1) {
    for (let row = rows - 1; row >= 0; row -= 1) {
      if (filledGrid[row][column] !== null) {
        continue;
      }

      const pieceType = pickPieceType(randomSource, pieceTypes);
      const piece = createStandardPiece(pieceType);
      filledGrid[row][column] = piece;
      placements.push({
        coordinate: { row, column },
        piece,
      });
    }
  }

  const populatedGrid: BoardPiece[][] = filledGrid.map((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      if (cell === null) {
        throw new BoardDomainError(
          'invalid-resolvable-grid',
          `refill produced unexpected empty cell at row=${rowIndex}, column=${columnIndex}`,
        );
      }

      return cell;
    }),
  );

  const board = Board.fromGrid(populatedGrid);
  return {
    board,
    placements: placements.map((placement) => ({
      coordinate: { ...placement.coordinate },
      piece: { ...placement.piece },
    })),
  };
}
