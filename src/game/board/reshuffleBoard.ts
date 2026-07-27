import { Board } from './Board';
import {
  BoardPiece,
  ExactPieceInventory,
  RandomSource,
  ReshuffleDeadBoardInput,
  ReshuffleResult,
} from './boardTypes';
import { assertStableBoard, isDeadBoard } from './deadBoard';
import { BoardDomainError } from './errors';
import { findMatchRuns } from './matchDetection';
import { createPieceInventory, parsePieceInventoryKey } from './pieceInventory';
import { SeededRandom } from './seededRandom';
import { findPlayableSwaps, findValidScoringSwaps, hasPlayableSwap } from './validMoves';

export const DEFAULT_RESHUFFLE_RANDOM_ATTEMPTS = 50;
export const DEFAULT_RESHUFFLE_SEARCH_NODES = 25000;

interface FallbackSearchResult {
  board?: Board;
  nodesVisited: number;
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new BoardDomainError(
      'invalid-reshuffle-limit',
      `${label} must be an integer greater than zero; received ${String(value)}`,
    );
  }

  return value;
}

function resolveRandomSource(input: ReshuffleDeadBoardInput): RandomSource {
  if (input.randomSource) {
    return input.randomSource;
  }

  if (input.seed === undefined) {
    throw new BoardDomainError(
      'invalid-seed',
      'reshuffleDeadBoard requires either randomSource or integer seed',
    );
  }

  return new SeededRandom(input.seed);
}

function hasImmediateMatches(board: Board): boolean {
  return findMatchRuns(board).runs.length > 0;
}

function isAcceptableCandidate(board: Board): boolean {
  return !hasImmediateMatches(board) && hasPlayableSwap(board);
}

function flattenBoard(board: Board): BoardPiece[] {
  return board.toGridSnapshot().flat();
}

function permuteInPlace<T>(values: T[], randomSource: RandomSource): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomSource.nextInt(index + 1);
    const temp = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = temp;
  }
}

function boardFromFlatPieces(pieces: readonly BoardPiece[], rows: number, columns: number): Board {
  const grid: BoardPiece[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const start = row * columns;
    grid.push(pieces.slice(start, start + columns).map((piece) => ({ ...piece })));
  }

  return Board.fromGrid(grid);
}

function localCreatesRun(
  grid: Array<Array<BoardPiece | null>>,
  row: number,
  column: number,
  piece: BoardPiece,
): boolean {
  const leftOne = column - 1 >= 0 ? grid[row][column - 1] : null;
  const leftTwo = column - 2 >= 0 ? grid[row][column - 2] : null;
  if (leftOne?.pieceType === piece.pieceType && leftTwo?.pieceType === piece.pieceType) {
    return true;
  }

  const upOne = row - 1 >= 0 ? grid[row - 1][column] : null;
  const upTwo = row - 2 >= 0 ? grid[row - 2][column] : null;
  if (upOne?.pieceType === piece.pieceType && upTwo?.pieceType === piece.pieceType) {
    return true;
  }

  return false;
}

function createTieBreakOrder(
  availableKeys: readonly string[],
  randomSource: RandomSource,
): string[] {
  const order = [...availableKeys];
  permuteInPlace(order, randomSource);
  return order;
}

function getCandidateKeys(
  remaining: ExactPieceInventory,
  tieBreakOrder: readonly string[],
): string[] {
  return [...tieBreakOrder]
    .filter((key) => (remaining[key] ?? 0) > 0)
    .sort((left, right) => {
      const delta = (remaining[right] ?? 0) - (remaining[left] ?? 0);
      if (delta !== 0) {
        return delta;
      }

      return tieBreakOrder.indexOf(left) - tieBreakOrder.indexOf(right);
    });
}

function fallbackSearch(
  rows: number,
  columns: number,
  inventory: ExactPieceInventory,
  tieBreakOrder: readonly string[],
  maxNodes: number,
): FallbackSearchResult {
  const grid: Array<Array<BoardPiece | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null),
  );

  let nodesVisited = 0;
  const totalCells = rows * columns;

  function search(index: number): Board | null {
    if (nodesVisited >= maxNodes) {
      return null;
    }

    nodesVisited += 1;

    if (index >= totalCells) {
      const candidate = Board.fromGrid(grid.map((row) => row.map((piece) => ({ ...piece! }))));
      return isAcceptableCandidate(candidate) ? candidate : null;
    }

    const row = Math.floor(index / columns);
    const column = index % columns;
    const candidateKeys = getCandidateKeys(inventory, tieBreakOrder);

    for (const key of candidateKeys) {
      const piece = parsePieceInventoryKey(key);
      if (localCreatesRun(grid, row, column, piece)) {
        continue;
      }

      grid[row][column] = piece;
      inventory[key] -= 1;

      const result = search(index + 1);
      if (result) {
        return result;
      }

      inventory[key] += 1;
      grid[row][column] = null;
    }

    return null;
  }

  return {
    board: search(0) ?? undefined,
    nodesVisited,
  };
}

function cloneInventoryRecord(source: ExactPieceInventory): ExactPieceInventory {
  const clone: ExactPieceInventory = {};
  for (const key of Object.keys(source).sort()) {
    clone[key] = source[key] ?? 0;
  }

  return clone;
}

export function reshuffleDeadBoard(input: ReshuffleDeadBoardInput): ReshuffleResult {
  const maxRandomAttempts = validatePositiveInteger(
    input.maxRandomAttempts ?? DEFAULT_RESHUFFLE_RANDOM_ATTEMPTS,
    'maxRandomAttempts',
  );
  const maxSearchNodes = validatePositiveInteger(
    input.maxSearchNodes ?? DEFAULT_RESHUFFLE_SEARCH_NODES,
    'maxSearchNodes',
  );

  const randomSource = resolveRandomSource(input);

  assertStableBoard(input.board);
  if (!isDeadBoard(input.board)) {
    throw new BoardDomainError(
      'board-not-dead',
      'reshuffleDeadBoard requires a stable dead board (zero activation-aware playable swaps)',
    );
  }

  const originalBoard = input.board;
  const originalInventory = createPieceInventory(originalBoard);
  const { rows, columns } = originalBoard.getDimensions();
  const flatPieces = flattenBoard(originalBoard);

  let attempts = 0;
  for (let attempt = 0; attempt < maxRandomAttempts; attempt += 1) {
    attempts += 1;
    const candidatePieces = [...flatPieces];
    permuteInPlace(candidatePieces, randomSource);

    const candidate = boardFromFlatPieces(candidatePieces, rows, columns);
    if (!isAcceptableCandidate(candidate)) {
      continue;
    }

    const reshuffledInventory = createPieceInventory(candidate);
    return {
      originalBoard,
      reshuffledBoard: candidate,
      originalInventory,
      reshuffledInventory,
      seed: input.seed,
      randomAttempts: attempts,
      fallbackSearchUsed: false,
      searchNodesVisited: 0,
      validScoringSwaps: findValidScoringSwaps(candidate),
      validPlayableSwaps: findPlayableSwaps(candidate),
    };
  }

  const remainingInventory = cloneInventoryRecord(originalInventory);
  const allKeys = Object.keys(remainingInventory).filter((key) => remainingInventory[key] > 0);
  const tieBreakOrder = createTieBreakOrder(allKeys, randomSource);
  const fallbackResult = fallbackSearch(
    rows,
    columns,
    remainingInventory,
    tieBreakOrder,
    maxSearchNodes,
  );

  if (!fallbackResult.board) {
    throw new BoardDomainError(
      'reshuffle-search-exhausted',
      `reshuffle search exhausted after randomAttempts=${attempts}, searchNodesVisited=${fallbackResult.nodesVisited}`,
    );
  }

  const reshuffledBoard = fallbackResult.board;
  const reshuffledInventory = createPieceInventory(reshuffledBoard);

  return {
    originalBoard,
    reshuffledBoard,
    originalInventory,
    reshuffledInventory,
    seed: input.seed,
    randomAttempts: attempts,
    fallbackSearchUsed: true,
    searchNodesVisited: fallbackResult.nodesVisited,
    validScoringSwaps: findValidScoringSwaps(reshuffledBoard),
    validPlayableSwaps: findPlayableSwaps(reshuffledBoard),
  };
}
