import { BoardCoordinate, BoardDimensions, BoardPiece, PieceType } from './boardTypes';
import { BoardDomainError } from './errors';
import { cloneBoardPiece, createStandardPiece, normalizeBoardPiece } from './boardPieces';
import { assertCoordinateInBounds, validateBoardDimensions } from './boardValidation';

function cloneGrid(grid: readonly (readonly BoardPiece[])[]): BoardPiece[][] {
  return grid.map((row) => row.map((piece) => cloneBoardPiece(piece)));
}

export class Board {
  private readonly grid: BoardPiece[][];
  private readonly dimensions: BoardDimensions;

  private constructor(grid: BoardPiece[][]) {
    this.grid = grid;
    this.dimensions = {
      rows: grid.length,
      columns: grid[0].length,
    };
  }

  public static fromGrid(grid: readonly (readonly unknown[])[]): Board {
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new BoardDomainError('malformed-grid', 'grid must contain at least one row');
    }

    const firstRow = grid[0];
    if (!Array.isArray(firstRow) || firstRow.length === 0) {
      throw new BoardDomainError('malformed-grid', 'grid must contain at least one column');
    }

    const rowCount = grid.length;
    const columnCount = firstRow.length;
    validateBoardDimensions({ rows: rowCount, columns: columnCount });

    const copiedGrid: BoardPiece[][] = [];
    for (let row = 0; row < rowCount; row += 1) {
      const currentRow = grid[row];
      if (!Array.isArray(currentRow) || currentRow.length !== columnCount) {
        throw new BoardDomainError(
          'malformed-grid',
          `row ${row} does not match expected column count ${columnCount}`,
        );
      }

      const copiedRow: BoardPiece[] = [];
      for (let column = 0; column < columnCount; column += 1) {
        copiedRow.push(normalizeBoardPiece(currentRow[column]));
      }

      copiedGrid.push(copiedRow);
    }

    return new Board(copiedGrid);
  }

  public static fromPieceTypes(grid: readonly (readonly PieceType[])[]): Board {
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new BoardDomainError('malformed-grid', 'grid must contain at least one row');
    }

    const firstRow = grid[0];
    if (!Array.isArray(firstRow) || firstRow.length === 0) {
      throw new BoardDomainError('malformed-grid', 'grid must contain at least one column');
    }

    const pieceGrid = grid.map((row: readonly PieceType[]) =>
      row.map((pieceType: PieceType) => createStandardPiece(pieceType)),
    );
    return Board.fromGrid(pieceGrid);
  }

  public getDimensions(): BoardDimensions {
    return { ...this.dimensions };
  }

  public isWithinBounds(coordinate: BoardCoordinate): boolean {
    const { row, column } = coordinate;
    return (
      Number.isInteger(row) &&
      Number.isInteger(column) &&
      row >= 0 &&
      row < this.dimensions.rows &&
      column >= 0 &&
      column < this.dimensions.columns
    );
  }

  public getPieceAt(coordinate: BoardCoordinate): BoardPiece {
    assertCoordinateInBounds(coordinate, this.dimensions, 'coordinate');
    return cloneBoardPiece(this.grid[coordinate.row][coordinate.column]);
  }

  public toGridSnapshot(): BoardPiece[][] {
    return cloneGrid(this.grid);
  }

  public swapPieces(first: BoardCoordinate, second: BoardCoordinate): Board {
    assertCoordinateInBounds(first, this.dimensions, 'first coordinate');
    assertCoordinateInBounds(second, this.dimensions, 'second coordinate');

    if (first.row === second.row && first.column === second.column) {
      throw new BoardDomainError('same-coordinate-swap', 'cannot swap a coordinate with itself');
    }

    const nextGrid = this.toGridSnapshot();
    const firstPiece = nextGrid[first.row][first.column];
    nextGrid[first.row][first.column] = nextGrid[second.row][second.column];
    nextGrid[second.row][second.column] = firstPiece;

    return Board.fromGrid(nextGrid);
  }
}
