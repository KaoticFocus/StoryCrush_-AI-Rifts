import {
  Board,
  BoardDomainError,
  createPieceInventory,
  getPieceInventoryKey,
  type BoardCoordinate,
  type BoardPiece,
} from '../../board';

export interface ReshuffleMovement {
  index: number;
  from: BoardCoordinate;
  to: BoardCoordinate;
  piece: BoardPiece;
}

export interface ReshuffleStationaryEntry {
  coordinate: BoardCoordinate;
  piece: BoardPiece;
}

export interface ReshuffleMovementPlan {
  movements: ReshuffleMovement[];
  stationary: ReshuffleStationaryEntry[];
}

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function clonePiece(piece: BoardPiece): BoardPiece {
  return { ...piece };
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function collectCoordinatesByPieceKey(board: Board): Map<string, BoardCoordinate[]> {
  const snapshot = board.toGridSnapshot();
  const coordinatesByKey = new Map<string, BoardCoordinate[]>();

  for (let row = 0; row < snapshot.length; row += 1) {
    for (let column = 0; column < snapshot[row].length; column += 1) {
      const piece = snapshot[row][column];
      const key = getPieceInventoryKey(piece);
      const coordinates = coordinatesByKey.get(key) ?? [];
      coordinates.push({ row, column });
      coordinatesByKey.set(key, coordinates);
    }
  }

  for (const coordinates of coordinatesByKey.values()) {
    coordinates.sort(compareCoordinates);
  }

  return coordinatesByKey;
}

export function planReshuffleMovements(input: {
  originalBoard: Board;
  reshuffledBoard: Board;
}): ReshuffleMovementPlan {
  const originalDimensions = input.originalBoard.getDimensions();
  const reshuffledDimensions = input.reshuffledBoard.getDimensions();

  if (
    originalDimensions.rows !== reshuffledDimensions.rows ||
    originalDimensions.columns !== reshuffledDimensions.columns
  ) {
    throw new BoardDomainError(
      'invalid-board-dimensions',
      'reshuffle movement planning requires matching board dimensions',
    );
  }

  const originalInventory = createPieceInventory(input.originalBoard);
  const reshuffledInventory = createPieceInventory(input.reshuffledBoard);
  if (JSON.stringify(originalInventory) !== JSON.stringify(reshuffledInventory)) {
    throw new BoardDomainError(
      'level-state-mismatch',
      'reshuffle movement planning requires identical exact piece inventories',
    );
  }

  const originalCoordinates = collectCoordinatesByPieceKey(input.originalBoard);
  const reshuffledCoordinates = collectCoordinatesByPieceKey(input.reshuffledBoard);
  const originalSnapshot = input.originalBoard.toGridSnapshot();
  const reshuffledSnapshot = input.reshuffledBoard.toGridSnapshot();

  const movements: ReshuffleMovement[] = [];
  const stationary: ReshuffleStationaryEntry[] = [];
  let movementIndex = 0;

  for (const pieceKey of [...originalCoordinates.keys()].sort()) {
    const sourceCoordinates = originalCoordinates.get(pieceKey) ?? [];
    const destinationCoordinates = reshuffledCoordinates.get(pieceKey) ?? [];

    if (sourceCoordinates.length !== destinationCoordinates.length) {
      throw new BoardDomainError(
        'level-state-mismatch',
        `reshuffle piece count mismatch for ${pieceKey}`,
      );
    }

    for (let index = 0; index < sourceCoordinates.length; index += 1) {
      const from = sourceCoordinates[index];
      const to = destinationCoordinates[index];
      const sourcePiece = originalSnapshot[from.row][from.column];
      const destinationPiece = reshuffledSnapshot[to.row][to.column];

      if (getPieceInventoryKey(sourcePiece) !== getPieceInventoryKey(destinationPiece)) {
        throw new BoardDomainError(
          'level-state-mismatch',
          `reshuffle piece identity mismatch for ${pieceKey}`,
        );
      }

      if (from.row === to.row && from.column === to.column) {
        stationary.push({ coordinate: cloneCoordinate(from), piece: clonePiece(sourcePiece) });
        continue;
      }

      movements.push({
        index: movementIndex,
        from: cloneCoordinate(from),
        to: cloneCoordinate(to),
        piece: clonePiece(sourcePiece),
      });
      movementIndex += 1;
    }
  }

  return { movements, stationary };
}
