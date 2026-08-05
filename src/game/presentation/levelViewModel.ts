import {
  type LevelDefinition,
  type LevelMoveResult,
  type LevelSessionState,
  type LevelStatus,
  type RiftHungerState,
} from '../level';
import { type BoardCoordinate } from '../board';
import { getPieceTypeLabel } from './pieceAppearance';

export interface ObjectiveViewModel {
  id: string;
  label: string;
  progressText: string;
  complete: boolean;
}

export interface LevelViewModel {
  titleText: string;
  scoreText: string;
  movesText: string;
  statusText: string;
  objectives: ObjectiveViewModel[];
  threat?: ThreatViewModel;
  isTerminal: boolean;
}

export interface ThreatViewModel {
  hungerText: string;
  hungerCurrent: number;
  hungerMaximum: number;
  countdownText: string;
  statusText: string;
  corruptedCoordinates: BoardCoordinate[];
  sourceCoordinates: BoardCoordinate[];
  threatenedCoordinate: BoardCoordinate | null;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function getLevelStatusLabel(status: LevelStatus, threatState?: RiftHungerState): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'won':
      return 'Level Complete';
    case 'failed':
      return threatState?.status === 'overwhelmed' ? 'Rift Overwhelmed' : 'Out of Moves';
  }
}

export function createThreatViewModel(
  definition: LevelDefinition,
  state: LevelSessionState,
): ThreatViewModel | undefined {
  if (!definition.threat || !state.threatState) {
    return undefined;
  }
  const threat = state.threatState;
  const countdown = threat.acceptedMovesUntilSpread;
  const statusText =
    threat.status === 'contained'
      ? 'Rift Contained'
      : threat.status === 'overwhelmed'
        ? 'Rift Overwhelmed'
        : 'Rift Active';
  return {
    hungerText: `Hunger ${threat.hungerCurrent} / ${definition.threat.hungerMaximum}`,
    hungerCurrent: threat.hungerCurrent,
    hungerMaximum: definition.threat.hungerMaximum,
    countdownText:
      threat.status === 'active'
        ? `Spread in ${countdown} ${pluralize(countdown, 'move', 'moves')}`
        : statusText,
    statusText,
    corruptedCoordinates: threat.corruptedCells.map((coordinate) => ({ ...coordinate })),
    sourceCoordinates: threat.sourceCells.map((coordinate) => ({ ...coordinate })),
    threatenedCoordinate: threat.threatenedCell ? { ...threat.threatenedCell } : null,
  };
}

export function formatObjectiveLabel(
  definition: LevelDefinition['objectives'][number],
  current: number,
): string {
  if (definition.kind === 'score') {
    return `Score: ${current} / ${definition.targetScore}`;
  }

  return `Collect ${getPieceTypeLabel(definition.pieceType)}: ${current} / ${definition.targetCount}`;
}

export function formatMoveSummary(result: LevelMoveResult): string {
  if (!result.accepted) {
    if (result.kind === 'terminal') {
      return result.terminalStatus === 'won'
        ? 'Level already complete.'
        : 'No moves remain in this level.';
    }

    if (result.reason === 'no-match-created') {
      return 'Rejected move. That swap does not create a playable result.';
    }
    if (result.reason === 'cell-unavailable') {
      return 'That cell is corrupted. Match beside it, or clear it with a special, to cleanse it.';
    }

    return 'Rejected move. Choose orthogonally adjacent cells on the board.';
  }

  const activationCount = result.resolution.steps.reduce(
    (total, step) => total + step.activationEvents.length,
    0,
  );
  const segments = [
    `+${result.scoreCalculation.totalAwardedPoints} points`,
    `${result.resolution.cascadeCount} ${pluralize(result.resolution.cascadeCount, 'cascade', 'cascades')}`,
  ];

  segments.push(
    activationCount === 0
      ? 'no specials activated'
      : `${activationCount} ${pluralize(activationCount, 'special activated', 'specials activated')}`,
  );

  if (result.reshuffle) {
    segments.push('reshuffled');
  }

  return segments.join(' · ');
}

export function createLevelViewModel(
  definition: LevelDefinition,
  state: LevelSessionState,
): LevelViewModel {
  const objectives = definition.objectives.map((objective, index) => {
    const progress = state.objectiveProgress[index];
    return {
      id: objective.id,
      label: formatObjectiveLabel(objective, progress.current),
      progressText: `${progress.current} / ${progress.target}`,
      complete: progress.complete,
    };
  });

  return {
    titleText: definition.id.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    scoreText: `Score ${state.score}`,
    movesText: `Moves ${state.movesRemaining}`,
    statusText: getLevelStatusLabel(state.status, state.threatState),
    objectives,
    threat: createThreatViewModel(definition, state),
    isTerminal: state.status !== 'active',
  };
}
