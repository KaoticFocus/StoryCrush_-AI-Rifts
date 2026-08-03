import { type AcceptedLevelMoveResult, type ScoreEvent } from '../../level';

export interface ScorePresentationEntry {
  index: number;
  event: ScoreEvent;
  cumulativeScoreAfter: number;
  label: string;
}

export interface ScorePresentationPlan {
  entries: ScorePresentationEntry[];
}

function formatScoreLabel(event: ScoreEvent): string {
  if (event.kind === 'piece-clear') {
    return event.multiplier > 1
      ? `+${event.awardedPoints} Match ×${event.multiplier}`
      : `+${event.awardedPoints} Match`;
  }

  const baseLabel =
    event.specialKind === 'line-clear'
      ? 'Line Clear'
      : event.specialKind === 'cross-clear'
        ? 'Sigil Cross'
        : 'Lightning Core';

  return event.multiplier > 1
    ? `+${event.awardedPoints} ${baseLabel} ×${event.multiplier}`
    : `+${event.awardedPoints} ${baseLabel}`;
}

export function buildScorePresentationPlan(result: AcceptedLevelMoveResult): ScorePresentationPlan {
  const entries: ScorePresentationEntry[] = [];
  let cumulativeScore = result.scoreBefore;

  result.scoreCalculation.events.forEach((event, index) => {
    cumulativeScore += event.awardedPoints;
    entries.push({
      index,
      event: { ...event },
      cumulativeScoreAfter: cumulativeScore,
      label: formatScoreLabel(event),
    });
  });

  return { entries };
}
