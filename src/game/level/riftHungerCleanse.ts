import {
  BoardCoordinate,
  CascadeResolutionResult,
  SpecialActivationEvent,
  SpecialBoardPiece,
  WildcardActivationTarget,
} from '../board/boardTypes';
import {
  RIFT_HUNGER_CLEANSE_CAUSE_ORDER,
  RiftHungerCleanseCause,
  RiftHungerCleanseEvent,
  RiftHungerCleanseEvidence,
  RiftHungerSpecialCleanseCause,
  RiftHungerState,
} from './riftHungerTypes';
import { cloneCoordinate, compareCoordinates, coordinateKey } from './riftHungerValidation';

function isOrthogonallyAdjacent(a: BoardCoordinate, b: BoardCoordinate): boolean {
  const rowDistance = Math.abs(a.row - b.row);
  const columnDistance = Math.abs(a.column - b.column);
  return (rowDistance === 1 && columnDistance === 0) || (rowDistance === 0 && columnDistance === 1);
}

function specialCauseForPiece(piece: SpecialBoardPiece): RiftHungerSpecialCleanseCause | null {
  switch (piece.kind) {
    case 'line-clear':
      return 'line-clear';
    case 'cross-clear':
      return 'cross-clear';
    case 'wildcard':
      return 'wildcard';
    default:
      return null;
  }
}

function cloneWildcardTarget(
  target: WildcardActivationTarget | undefined,
): WildcardActivationTarget | undefined {
  if (!target) {
    return undefined;
  }
  return target.mode === 'piece-type'
    ? { mode: 'piece-type', pieceType: target.pieceType }
    : { mode: 'entire-board' };
}

function compareCause(a: RiftHungerCleanseCause, b: RiftHungerCleanseCause): number {
  return RIFT_HUNGER_CLEANSE_CAUSE_ORDER.indexOf(a) - RIFT_HUNGER_CLEANSE_CAUSE_ORDER.indexOf(b);
}

function compareEvidence(a: RiftHungerCleanseEvidence, b: RiftHungerCleanseEvidence): number {
  if (a.kind !== b.kind) {
    return a.kind === 'adjacent-match' ? -1 : 1;
  }
  if (a.kind === 'adjacent-match' && b.kind === 'adjacent-match') {
    if (a.stepIndex !== b.stepIndex) {
      return a.stepIndex - b.stepIndex;
    }
    const left = a.matchedCoordinates[0];
    const right = b.matchedCoordinates[0];
    if (!left || !right) {
      return a.matchedCoordinates.length - b.matchedCoordinates.length;
    }
    return compareCoordinates(left, right);
  }
  if (a.kind === 'special-activation' && b.kind === 'special-activation') {
    if (a.stepIndex !== b.stepIndex) {
      return a.stepIndex - b.stepIndex;
    }
    if (a.activationIndex !== b.activationIndex) {
      return a.activationIndex - b.activationIndex;
    }
    const coordinateOrder = compareCoordinates(a.activationCoordinate, b.activationCoordinate);
    if (coordinateOrder !== 0) {
      return coordinateOrder;
    }
    return compareCause(a.cause, b.cause);
  }
  return 0;
}

export function cloneRiftHungerCleanseEvidence(
  evidence: RiftHungerCleanseEvidence,
): RiftHungerCleanseEvidence {
  if (evidence.kind === 'adjacent-match') {
    return {
      kind: 'adjacent-match',
      stepIndex: evidence.stepIndex,
      matchedCoordinates: evidence.matchedCoordinates.map(cloneCoordinate),
    };
  }
  return {
    kind: 'special-activation',
    cause: evidence.cause,
    stepIndex: evidence.stepIndex,
    activationIndex: evidence.activationIndex,
    activationCoordinate: cloneCoordinate(evidence.activationCoordinate),
    activationReason: evidence.activationReason,
    wildcardTarget: cloneWildcardTarget(evidence.wildcardTarget),
  };
}

export function cloneRiftHungerCleanseEvent(event: RiftHungerCleanseEvent): RiftHungerCleanseEvent {
  return {
    coordinate: cloneCoordinate(event.coordinate),
    causes: [...event.causes],
    evidence: event.evidence.map(cloneRiftHungerCleanseEvidence),
  };
}

type Accumulator = {
  coordinate: BoardCoordinate;
  causes: Set<RiftHungerCleanseCause>;
  evidence: RiftHungerCleanseEvidence[];
  adjacentByStep: Map<number, Map<string, BoardCoordinate>>;
  specialKeys: Set<string>;
};

function ensureAccumulator(
  byKey: Map<string, Accumulator>,
  corrupted: BoardCoordinate,
): Accumulator {
  const key = coordinateKey(corrupted);
  let entry = byKey.get(key);
  if (!entry) {
    entry = {
      coordinate: cloneCoordinate(corrupted),
      causes: new Set<RiftHungerCleanseCause>(),
      evidence: [],
      adjacentByStep: new Map(),
      specialKeys: new Set(),
    };
    byKey.set(key, entry);
  }
  return entry;
}

function collectAdjacentEvidence(
  byKey: Map<string, Accumulator>,
  candidates: readonly BoardCoordinate[],
  resolution: Extract<CascadeResolutionResult, { isValid: true }>,
): void {
  for (const step of resolution.steps) {
    for (const matched of step.matches.matchedCoordinates) {
      for (const corrupted of candidates) {
        if (!isOrthogonallyAdjacent(matched, corrupted)) {
          continue;
        }
        const entry = ensureAccumulator(byKey, corrupted);
        entry.causes.add('adjacent-match');
        let matchedByKey = entry.adjacentByStep.get(step.index);
        if (!matchedByKey) {
          matchedByKey = new Map();
          entry.adjacentByStep.set(step.index, matchedByKey);
        }
        matchedByKey.set(coordinateKey(matched), cloneCoordinate(matched));
      }
    }
  }
}

function activationTouchesCoordinate(
  activation: SpecialActivationEvent,
  corrupted: BoardCoordinate,
): boolean {
  const key = coordinateKey(corrupted);
  return activation.affectedCoordinates.some((coordinate) => coordinateKey(coordinate) === key);
}

function collectSpecialEvidence(
  byKey: Map<string, Accumulator>,
  candidates: readonly BoardCoordinate[],
  resolution: Extract<CascadeResolutionResult, { isValid: true }>,
): void {
  for (const step of resolution.steps) {
    for (const activation of step.activationEvents) {
      const cause = specialCauseForPiece(activation.piece);
      if (!cause) {
        continue;
      }
      for (const corrupted of candidates) {
        if (!activationTouchesCoordinate(activation, corrupted)) {
          continue;
        }
        const entry = ensureAccumulator(byKey, corrupted);
        entry.causes.add(cause);
        const specialKey = `${step.index}:${activation.index}:${cause}:${coordinateKey(activation.coordinate)}`;
        if (entry.specialKeys.has(specialKey)) {
          continue;
        }
        entry.specialKeys.add(specialKey);
        entry.evidence.push({
          kind: 'special-activation',
          cause,
          stepIndex: step.index,
          activationIndex: activation.index,
          activationCoordinate: cloneCoordinate(activation.coordinate),
          activationReason: activation.reason,
          wildcardTarget: cloneWildcardTarget(activation.wildcardTarget),
        });
      }
    }
  }
}

function finalizeEvents(byKey: Map<string, Accumulator>): RiftHungerCleanseEvent[] {
  return [...byKey.values()]
    .sort((a, b) => compareCoordinates(a.coordinate, b.coordinate))
    .map((entry) => {
      const adjacentEvidence: RiftHungerCleanseEvidence[] = [...entry.adjacentByStep.entries()]
        .sort(([left], [right]) => left - right)
        .map(([stepIndex, matched]) => ({
          kind: 'adjacent-match' as const,
          stepIndex,
          matchedCoordinates: [...matched.values()].sort(compareCoordinates).map(cloneCoordinate),
        }));
      const evidence = [...adjacentEvidence, ...entry.evidence]
        .map(cloneRiftHungerCleanseEvidence)
        .sort(compareEvidence);
      const causes = [...entry.causes].sort(compareCause);
      return {
        coordinate: cloneCoordinate(entry.coordinate),
        causes,
        evidence,
      };
    });
}

/**
 * Canonical pure planner for RH-1 adjacent-match and RH-2 special cleansing.
 * Reads only pre-move corruption; never mutates inputs.
 * Exactly one event per cleansed coordinate with complete deterministic evidence.
 */
export function planRiftHungerCleanses(input: {
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

  const byKey = new Map<string, Accumulator>();
  collectAdjacentEvidence(byKey, candidates, input.resolution);
  collectSpecialEvidence(byKey, candidates, input.resolution);
  return finalizeEvents(byKey);
}

/**
 * RH-1-compatible alias for the canonical planner.
 * Prefer `planRiftHungerCleanses` for new call sites.
 */
export function planAdjacentMatchCleanses(input: {
  previousState: RiftHungerState;
  resolution: Extract<CascadeResolutionResult, { isValid: true }>;
  newlySpreadCoordinate?: BoardCoordinate | null;
}): RiftHungerCleanseEvent[] {
  return planRiftHungerCleanses(input);
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
