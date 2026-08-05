import {
  BoardCoordinate,
  SpecialActivationReason,
  WildcardActivationTarget,
} from '../board/boardTypes';

/**
 * Deterministic Rift Hunger / Rift Erosion threat.
 *
 * Corruption is a cell-state overlay; underlying board pieces are unchanged.
 * RH-1: adjacent-match cleansing for non-source corruption.
 * RH-2: authoritative special-activation cleansing (line/cross/wildcard).
 * Special-created protection wiring remains deferred.
 */

export type RiftHungerStatus = 'active' | 'contained' | 'overwhelmed';

/** First RH-0 policy: orthogonal frontier, stable row-major coordinate order. */
export type RiftHungerSpreadPriority = 'orthogonal-stable-coordinate';

export interface RiftHungerDefinition {
  kind: 'rift-hunger';
  sourceCells: readonly BoardCoordinate[];
  /** Accepted moves between spreads. Must be a positive safe integer. */
  spreadInterval: number;
  /** Hunger units that trigger overwhelmed. Must be a positive safe integer. */
  hungerMaximum: number;
  spreadPriority: RiftHungerSpreadPriority;
}

/**
 * Protection expires after accepted-move cycles, not wall-clock time.
 * Special-creation integration that grants protection remains deferred.
 */
export interface RiftHungerProtectedCell {
  coordinate: BoardCoordinate;
  remainingAcceptedMoves: number;
}

export interface RiftHungerState {
  status: RiftHungerStatus;
  sourceCells: BoardCoordinate[];
  corruptedCells: BoardCoordinate[];
  threatenedCell: BoardCoordinate | null;
  acceptedMovesUntilSpread: number;
  spreadGeneration: number;
  hungerCurrent: number;
  protectedCells: RiftHungerProtectedCell[];
}

export interface RiftHungerSpreadEvent {
  generation: number;
  coordinate: BoardCoordinate;
  hungerBefore: number;
  hungerAfter: number;
  nextThreatenedCell: BoardCoordinate | null;
}

/** Stable cause order for unique cleanse provenance. */
export const RIFT_HUNGER_CLEANSE_CAUSE_ORDER = [
  'adjacent-match',
  'line-clear',
  'cross-clear',
  'wildcard',
] as const;

export type RiftHungerCleanseCause = (typeof RIFT_HUNGER_CLEANSE_CAUSE_ORDER)[number];

export type RiftHungerSpecialCleanseCause = 'line-clear' | 'cross-clear' | 'wildcard';

export type RiftHungerCleanseEvidence =
  | {
      kind: 'adjacent-match';
      stepIndex: number;
      matchedCoordinates: BoardCoordinate[];
    }
  | {
      kind: 'special-activation';
      cause: RiftHungerSpecialCleanseCause;
      stepIndex: number;
      activationIndex: number;
      activationCoordinate: BoardCoordinate;
      activationReason: SpecialActivationReason;
      wildcardTarget?: WildcardActivationTarget;
    };

/**
 * Exactly one authoritative cleanse event per cleansed coordinate per accepted move.
 * All qualifying evidence is retained; presentation may simplify visuals.
 */
export interface RiftHungerCleanseEvent {
  coordinate: BoardCoordinate;
  causes: RiftHungerCleanseCause[];
  evidence: RiftHungerCleanseEvidence[];
}

export interface RiftHungerTransition {
  previousState: RiftHungerState;
  nextState: RiftHungerState;
  countdownBefore: number;
  countdownAfter: number;
  spreadEvent: RiftHungerSpreadEvent | null;
  cleanseEvents: RiftHungerCleanseEvent[];
  statusBefore: RiftHungerStatus;
  statusAfter: RiftHungerStatus;
}
