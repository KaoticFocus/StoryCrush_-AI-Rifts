import { Board } from './Board';
import { BoardPiece, GenerateBoardInput, PieceType } from './boardTypes';
import { BoardDomainError } from './errors';
import { createStandardPiece } from './boardPieces';
import { validateAllowedPieceTypes, validateBoardDimensions } from './boardValidation';
import { SeededRandom } from './seededRandom';

function wouldCreateRun(
  grid: Array<Array<BoardPiece | null>>,
  row: number,
  column: number,
  pieceType: PieceType,
): boolean {
  const leftOne = column - 1 >= 0 ? grid[row][column - 1] : null;
  const leftTwo = column - 2 >= 0 ? grid[row][column - 2] : null;
  if (leftOne?.pieceType === pieceType && leftTwo?.pieceType === pieceType) {
    return true;
  }

  const upOne = row - 1 >= 0 ? grid[row - 1][column] : null;
  const upTwo = row - 2 >= 0 ? grid[row - 2][column] : null;
  if (upOne?.pieceType === pieceType && upTwo?.pieceType === pieceType) {
    return true;
  }

  return false;
}

function getCandidateOrder(rng: SeededRandom, values: readonly PieceType[]): PieceType[] {
  if (values.length <= 1) {
    return [...values];
  }

  const start = rng.nextInt(values.length);
  const ordered: PieceType[] = [];
  for (let index = 0; index < values.length; index += 1) {
    ordered.push(values[(start + index) % values.length]);
  }

  return ordered;
}

function ensureGenerationPossible(
  rows: number,
  columns: number,
  pieceTypes: readonly PieceType[],
): void {
  if (pieceTypes.length === 1 && (rows >= 3 || columns >= 3)) {
    throw new BoardDomainError(
      'generation-impossible',
      'at least two unique piece types are required when rows >= 3 or columns >= 3',
    );
  }
}

export function generateBoard(input: GenerateBoardInput): Board {
  const { rows, columns } = validateBoardDimensions({ rows: input.rows, columns: input.columns });
  const pieceTypes = validateAllowedPieceTypes(input.pieceTypes);
  ensureGenerationPossible(rows, columns, pieceTypes);

  const rng = new SeededRandom(input.seed);
  const grid: Array<Array<BoardPiece | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );

  const totalCells = rows * columns;

  function fillCell(index: number): boolean {
    if (index >= totalCells) {
      return true;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;

    const candidates = getCandidateOrder(rng, pieceTypes).filter(
      (pieceType) => !wouldCreateRun(grid, row, column, pieceType),
    );

    for (const pieceType of candidates) {
      grid[row][column] = createStandardPiece(pieceType);
      if (fillCell(index + 1)) {
        return true;
      }
      grid[row][column] = null;
    }

    return false;
  }

  if (!fillCell(0)) {
    throw new BoardDomainError(
      'generation-impossible',
      `unable to generate board without initial matches for ${rows}x${columns}`,
    );
  }

  const finalizedGrid = grid.map((row, rowIndex) =>
    row.map((piece, column) => {
      if (piece === null) {
        throw new BoardDomainError(
          'generation-impossible',
          `unexpected empty piece at finalized board row=${rowIndex}, column=${column}`,
        );
      }
      return createStandardPiece(piece.pieceType);
    }),
  );

  return Board.fromGrid(finalizedGrid);
}
