import { BoardCoordinate, CascadeResolutionResult } from '../board/boardTypes';
import { RiftHungerCleanseEvent, RiftHungerState } from './riftHungerTypes';
import { cloneCoordinate, compareCoordinates, coordinateKey } from './riftHungerValidation';

function isOrthogonallyAdjacent(a: BoardCoordinate, b: BoardCoordinate): boolean {
  const rowDistance = Math.abs(a.row - b.row);
  const columnDistance = Math.abs(a.column - b.column);
  return (rowDistance === 1 && columnDistance === 0) || (rowDistance === 0 && columnDistance === 1);
}

/**
 * Plan unique adjacent-match cleanses from pre-move corruption and ordinary matches.
 * Does not mutate state. Source cells are never cleansed.
 */
export function planAdjacentMatchCleanses(input: {
  previousState: RiftHungerState;
  resolution: Extract<CascadeResolutionResult, { isValid: true }>;
  /** Coordinate that will spread this move, if any — excluded from same-move cleanse. */
  newlySpreadCoordinate?: BoardCoordinate | null;
}): RiftHungerCleanseEvent[] {
  const sourceKeys = new Set(input.previousState.sourceCells.map(coordinateKey));
  const newlySpreadKey = input.newlySpreadCoordinate
    ? coordinateKey(input.newlySpreadCoordinate)
    : null;

  const candidates = input.previousState.corruptedCells.filter((coordinate) => {
    const key = coordinateKey(coordinate);
    return !sourceKeys.has(key) && key !== newlySpreadKey;
  });

  if (candidates.length === 0) {
    return [];
  }

  type Accumulator = {
    coordinate: BoardCoordinate;
    stepIndexes: Set<number>;
    matched: Map<string, BoardCoordinate>;
  };

  const byKey = new Map<string, Accumulator>();

  for (const step of input.resolution.steps) {
    for (const matched of step.matches.matchedCoordinates) {
      for (const corrupted of candidates) {
        if (!isOrthogonallyAdjacent(matched, corrupted)) {
          continue;
        }
        const key = coordinateKey(corrupted);
        let entry = byKey.get(key);
        if (!entry) {
          entry = {
            coordinate: cloneCoordinate(corrupted),
            stepIndexes: new Set<number>(),
            matched: new Map<string, BoardCoordinate>(),
          };
          byKey.set(key, entry);
        }
        entry.stepIndexes.add(step.index);
        entry.matched.set(coordinateKey(matched), cloneCoordinate(matched));
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => compareCoordinates(a.coordinate, b.coordinate))
    .map((entry) => ({
      coordinate: cloneCoordinate(entry.coordinate),
      cause: 'adjacent-match' as const,
      triggeringStepIndexes: [...entry.stepIndexes].sort((left, right) => left - right),
      adjacentMatchedCoordinates: [...entry.matched.values()]
        .sort(compareCoordinates)
        .map(cloneCoordinate),
    }));
}

export function applyRiftHungerCleanses(
  state: RiftHungerState,
  cleanseEvents: readonly RiftHungerCleanseEvent[],
): RiftHungerState {
  if (cleanseEvents.length === 0) {
    return {
      ...state,
      sourceCells: state.sourceCells.map(cloneCoordinate),
      corruptedCells: state.corruptedCells.map(cloneCoordinate),
      threatenedCell: state.threatenedCell ? cloneCoordinate(state.threatenedCell) : null,
      protectedCells: state.protectedCells.map((entry) => ({
        coordinate: cloneCoordinate(entry.coordinate),
        remainingAcceptedMoves: entry.remainingAcceptedMoves,
      })),
    };
  }

  const cleanseKeys = new Set(cleanseEvents.map((event) => coordinateKey(event.coordinate)));
  return {
    ...state,
    sourceCells: state.sourceCells.map(cloneCoordinate),
    corruptedCells: state.corruptedCells
      .filter((coordinate) => !cleanseKeys.has(coordinateKey(coordinate)))
      .map(cloneCoordinate),
    threatenedCell: state.threatenedCell ? cloneCoordinate(state.threatenedCell) : null,
    protectedCells: state.protectedCells.map((entry) => ({
      coordinate: cloneCoordinate(entry.coordinate),
      remainingAcceptedMoves: entry.remainingAcceptedMoves,
    })),
  };
}
