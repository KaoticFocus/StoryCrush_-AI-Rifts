import { type Board, type BoardCoordinate, type BoardPiece } from '../board';
import { getPieceAppearance, type PieceAppearance } from './pieceAppearance';

export interface BoardCellViewModel {
  key: string;
  coordinate: BoardCoordinate;
  piece: BoardPiece;
  appearance: PieceAppearance;
}

export interface BoardViewModel {
  rows: number;
  columns: number;
  cells: BoardCellViewModel[];
}

function clonePiece(piece: BoardPiece): BoardPiece {
  if (piece.kind === 'line-clear') {
    return { ...piece };
  }

  return { ...piece };
}

export function createBoardViewModel(board: Board): BoardViewModel {
  const dimensions = board.getDimensions();
  const grid = board.toGridSnapshot();
  const cells: BoardCellViewModel[] = [];

  for (let row = 0; row < dimensions.rows; row += 1) {
    for (let column = 0; column < dimensions.columns; column += 1) {
      const piece = clonePiece(grid[row][column]);
      cells.push({
        key: `${row}:${column}`,
        coordinate: { row, column },
        appearance: getPieceAppearance(piece),
        piece,
      });
    }
  }

  return {
    rows: dimensions.rows,
    columns: dimensions.columns,
    cells,
  };
}
