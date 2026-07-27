import {
  type LevelDefinition,
  type LevelMoveResult,
  type LevelSessionState,
  type LevelStatus,
} from '../level';
import { getPieceTypeLabel } from './pieceAppearance';

export interface ObjectiveViewModel {
  id: string;
  label: string;
  progressText: string;
  complete: boolean;
}

export interface LevelViewModel {
  scoreText: string;
  movesText: string;
  statusText: string;
  objectives: ObjectiveViewModel[];
  isTerminal: boolean;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function getLevelStatusLabel(status: LevelStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'won':
      return 'Level Complete';
    case 'failed':
      return 'Out of Moves';
  }
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
    scoreText: `Score ${state.score}`,
    movesText: `Moves ${state.movesRemaining}`,
    statusText: getLevelStatusLabel(state.status),
    objectives,
    isTerminal: state.status !== 'active',
  };
}
