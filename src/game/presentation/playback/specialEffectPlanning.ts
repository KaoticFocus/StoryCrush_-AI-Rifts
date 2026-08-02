import { BoardDomainError, type BoardCoordinate, type BoardDimensions } from '../../board';
import { type SpecialActivationEvent } from '../../board/boardTypes';

export type SpecialEffectKind =
  | 'line-clear-horizontal'
  | 'line-clear-vertical'
  | 'cross-clear'
  | 'wildcard-target'
  | 'wildcard-full-board';

export interface SpecialEffectBasePlan {
  kind: SpecialEffectKind;
  source: BoardCoordinate;
  affectedCoordinates: BoardCoordinate[];
  newlyTriggeredCoordinates: BoardCoordinate[];
  activationIndex: number;
  activationReason: SpecialActivationEvent['reason'];
}

export interface LineClearEffectPlan extends SpecialEffectBasePlan {
  kind: 'line-clear-horizontal' | 'line-clear-vertical';
  orientation: 'horizontal' | 'vertical';
  backwardBranch: BoardCoordinate[];
  forwardBranch: BoardCoordinate[];
}

export interface CrossClearEffectPlan extends SpecialEffectBasePlan {
  kind: 'cross-clear';
  /** Distance-ordered batches for timed flash (source-centered). */
  rings: BoardCoordinate[][];
  rowBranch: BoardCoordinate[];
  columnBranch: BoardCoordinate[];
}

export interface WildcardTargetEffectPlan extends SpecialEffectBasePlan {
  kind: 'wildcard-target';
  targetPieceType: NonNullable<SpecialActivationEvent['wildcardTarget']>['pieceType'];
  targetBatches: BoardCoordinate[][];
}

export interface WildcardFullBoardEffectPlan extends SpecialEffectBasePlan {
  kind: 'wildcard-full-board';
  waveBatches: BoardCoordinate[][];
}

export type SpecialEffectPresentationPlan =
  | LineClearEffectPlan
  | CrossClearEffectPlan
  | WildcardTargetEffectPlan
  | WildcardFullBoardEffectPlan;

function cloneCoordinate(coordinate: BoardCoordinate): BoardCoordinate {
  return { row: coordinate.row, column: coordinate.column };
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.column - right.column;
}

function dedupeAndSortCoordinates(coordinates: readonly BoardCoordinate[]): BoardCoordinate[] {
  const unique = new Map<string, BoardCoordinate>();

  for (const coordinate of coordinates) {
    unique.set(`${coordinate.row},${coordinate.column}`, cloneCoordinate(coordinate));
  }

  return [...unique.values()].sort(compareCoordinates);
}

function validateCoordinatesWithinBoard(
  coordinates: readonly BoardCoordinate[],
  dimensions: BoardDimensions,
  label: string,
): void {
  for (const coordinate of coordinates) {
    if (
      coordinate.row < 0 ||
      coordinate.column < 0 ||
      coordinate.row >= dimensions.rows ||
      coordinate.column >= dimensions.columns
    ) {
      throw new BoardDomainError(
        'coordinate-out-of-bounds',
        `${label} coordinate out of bounds: (${coordinate.row}, ${coordinate.column})`,
      );
    }
  }
}

function sortByDistanceFromSource(
  coordinates: readonly BoardCoordinate[],
  source: BoardCoordinate,
): BoardCoordinate[] {
  return [...coordinates].map(cloneCoordinate).sort((left, right) => {
    const leftDistance = Math.max(
      Math.abs(left.row - source.row),
      Math.abs(left.column - source.column),
    );
    const rightDistance = Math.max(
      Math.abs(right.row - source.row),
      Math.abs(right.column - source.column),
    );

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return compareCoordinates(left, right);
  });
}

function createDistanceBatches(
  coordinates: readonly BoardCoordinate[],
  source: BoardCoordinate,
): BoardCoordinate[][] {
  const batches = new Map<number, BoardCoordinate[]>();

  for (const coordinate of sortByDistanceFromSource(coordinates, source)) {
    const distance = Math.max(
      Math.abs(coordinate.row - source.row),
      Math.abs(coordinate.column - source.column),
    );
    const batch = batches.get(distance) ?? [];
    batch.push(coordinate);
    batches.set(distance, batch);
  }

  return [...batches.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, batch]) => batch.map(cloneCoordinate));
}

export function buildSpecialEffectPresentation(input: {
  event: SpecialActivationEvent;
  dimensions: BoardDimensions;
}): SpecialEffectPresentationPlan {
  const source = cloneCoordinate(input.event.coordinate);
  const affectedCoordinates = dedupeAndSortCoordinates(input.event.affectedCoordinates);
  const newlyTriggeredCoordinates = dedupeAndSortCoordinates(
    input.event.newlyTriggeredSpecialCoordinates,
  );

  validateCoordinatesWithinBoard([source], input.dimensions, 'source');
  validateCoordinatesWithinBoard(affectedCoordinates, input.dimensions, 'affected');
  validateCoordinatesWithinBoard(newlyTriggeredCoordinates, input.dimensions, 'newly-triggered');

  if (input.event.piece.kind === 'line-clear') {
    const orientation = input.event.piece.orientation;
    const backwardBranch = affectedCoordinates
      .filter((coordinate) =>
        orientation === 'horizontal'
          ? coordinate.column < source.column
          : coordinate.row < source.row,
      )
      .sort((left, right) =>
        orientation === 'horizontal' ? right.column - left.column : right.row - left.row,
      )
      .map(cloneCoordinate);
    const forwardBranch = affectedCoordinates
      .filter((coordinate) =>
        orientation === 'horizontal'
          ? coordinate.column > source.column
          : coordinate.row > source.row,
      )
      .sort((left, right) =>
        orientation === 'horizontal' ? left.column - right.column : left.row - right.row,
      )
      .map(cloneCoordinate);

    return {
      kind: orientation === 'horizontal' ? 'line-clear-horizontal' : 'line-clear-vertical',
      orientation,
      source,
      affectedCoordinates,
      newlyTriggeredCoordinates,
      activationIndex: input.event.index,
      activationReason: input.event.reason,
      backwardBranch,
      forwardBranch,
    };
  }

  if (input.event.piece.kind === 'cross-clear') {
    const rowBranch = affectedCoordinates
      .filter((coordinate) => coordinate.row === source.row)
      .map(cloneCoordinate);
    const columnBranch = affectedCoordinates
      .filter((coordinate) => coordinate.column === source.column && coordinate.row !== source.row)
      .map(cloneCoordinate);
    return {
      kind: 'cross-clear',
      source,
      affectedCoordinates,
      newlyTriggeredCoordinates,
      activationIndex: input.event.index,
      activationReason: input.event.reason,
      rings: createDistanceBatches(affectedCoordinates, source),
      rowBranch,
      columnBranch,
    };
  }

  if (!input.event.wildcardTarget) {
    throw new BoardDomainError(
      'invalid-level-state',
      'wildcard presentation requires wildcard target metadata',
    );
  }

  if (input.event.wildcardTarget.mode === 'entire-board') {
    return {
      kind: 'wildcard-full-board',
      source,
      affectedCoordinates,
      newlyTriggeredCoordinates,
      activationIndex: input.event.index,
      activationReason: input.event.reason,
      waveBatches: createDistanceBatches(affectedCoordinates, source),
    };
  }

  return {
    kind: 'wildcard-target',
    source,
    affectedCoordinates,
    newlyTriggeredCoordinates,
    activationIndex: input.event.index,
    activationReason: input.event.reason,
    targetPieceType: input.event.wildcardTarget.pieceType,
    targetBatches: createDistanceBatches(affectedCoordinates, source),
  };
}
