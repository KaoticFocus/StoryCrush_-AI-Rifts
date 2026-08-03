import { BoardCoordinate } from '../board/boardTypes';

/**
 * Deterministic Rift Hunger / Rift Erosion threat (RH-0 domain foundation).
 *
 * Corruption is a cell-state overlay; underlying board pieces are unchanged.
 * Presentation, cleansing, and special-creation protection wiring are deferred.
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
 * Special-creation integration that grants protection is deferred to RH-1/RH-2.
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

export interface RiftHungerTransition {
  previousState: RiftHungerState;
  nextState: RiftHungerState;
  countdownBefore: number;
  countdownAfter: number;
  spreadEvent: RiftHungerSpreadEvent | null;
  statusBefore: RiftHungerStatus;
  statusAfter: RiftHungerStatus;
}
