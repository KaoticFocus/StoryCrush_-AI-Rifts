import { CascadeStep } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import { ScoreCalculationResult, ScoreEvent, ScoringRules } from './levelTypes';

function safeMultiply(values: number[], label: string): number {
  let result = 1;
  for (const value of values) {
    result *= value;
    if (!Number.isSafeInteger(result)) {
      throw new BoardDomainError('score-overflow', `${label} overflowed safe integer range`);
    }
  }

  return result;
}

function safeAdd(a: number, b: number, label: string): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new BoardDomainError('score-overflow', `${label} overflowed safe integer range`);
  }

  return sum;
}

function getActivationBonus(
  kind: 'line-clear' | 'area-clear' | 'wildcard',
  rules: ScoringRules,
): number {
  switch (kind) {
    case 'line-clear':
      return rules.lineClearActivationBonus;
    case 'area-clear':
      return rules.areaClearActivationBonus;
    case 'wildcard':
      return rules.wildcardActivationBonus;
  }
}

function multiplierForStep(step: CascadeStep, rules: ScoringRules): number {
  const multiplier = 1 + step.index * rules.cascadeMultiplierIncrement;
  if (!Number.isSafeInteger(multiplier) || multiplier <= 0) {
    throw new BoardDomainError(
      'score-overflow',
      `invalid multiplier computed for step ${step.index}: ${String(multiplier)}`,
    );
  }

  return multiplier;
}

export function calculateResolutionScore(input: {
  resolution: { isValid: true; steps: CascadeStep[] };
  rules: ScoringRules;
}): ScoreCalculationResult {
  const events: ScoreEvent[] = [];
  const stepTotals: Array<{ stepIndex: number; awardedPoints: number }> = [];

  let pieceClearSubtotal = 0;
  let specialActivationSubtotal = 0;
  let totalAwardedPoints = 0;

  for (const step of input.resolution.steps) {
    const multiplier = multiplierForStep(step, input.rules);
    let stepTotal = 0;

    const removedCount = step.actualRemovedCoordinates.length;
    if (removedCount > 0) {
      const awardedPoints = safeMultiply(
        [removedCount, input.rules.pointsPerRemovedPiece, multiplier],
        `piece-clear score at step ${step.index}`,
      );

      events.push({
        kind: 'piece-clear',
        stepIndex: step.index,
        removedCount,
        pointsPerPiece: input.rules.pointsPerRemovedPiece,
        multiplier,
        awardedPoints,
      });

      pieceClearSubtotal = safeAdd(
        pieceClearSubtotal,
        awardedPoints,
        `piece-clear subtotal at step ${step.index}`,
      );
      stepTotal = safeAdd(stepTotal, awardedPoints, `step total at step ${step.index}`);
    }

    for (const activationEvent of step.activationEvents) {
      const baseBonus = getActivationBonus(activationEvent.piece.kind, input.rules);
      const awardedPoints = safeMultiply(
        [baseBonus, multiplier],
        `activation score at step ${step.index} activation ${activationEvent.index}`,
      );

      events.push({
        kind: 'special-activation',
        stepIndex: step.index,
        activationIndex: activationEvent.index,
        specialKind: activationEvent.piece.kind,
        activationReason: activationEvent.reason,
        baseBonus,
        multiplier,
        awardedPoints,
      });

      specialActivationSubtotal = safeAdd(
        specialActivationSubtotal,
        awardedPoints,
        `special subtotal at step ${step.index}`,
      );
      stepTotal = safeAdd(stepTotal, awardedPoints, `step total at step ${step.index}`);
    }

    stepTotals.push({
      stepIndex: step.index,
      awardedPoints: stepTotal,
    });
    totalAwardedPoints = safeAdd(
      totalAwardedPoints,
      stepTotal,
      `total score at step ${step.index}`,
    );
  }

  return {
    events,
    stepTotals,
    pieceClearSubtotal,
    specialActivationSubtotal,
    totalAwardedPoints,
  };
}
