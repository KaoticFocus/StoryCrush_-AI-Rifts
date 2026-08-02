import { PieceType } from '../board/boardTypes';
import { BoardDomainError } from '../board/errors';
import { isPieceType } from '../board/boardValidation';
import {
  CollectPieceObjectiveDefinition,
  LevelDefinition,
  LevelObjectiveDefinition,
  LevelSessionState,
  ScoringRules,
  ScoringRulesValidationInput,
  ScoreObjectiveDefinition,
} from './levelTypes';

export const DEFAULT_SCORING_RULES: ScoringRules = {
  pointsPerRemovedPiece: 10,
  lineClearActivationBonus: 40,
  crossClearActivationBonus: 50,
  wildcardActivationBonus: 60,
  cascadeMultiplierIncrement: 1,
};

function assertSafeNonNegativeInteger(
  value: number,
  label: string,
  code: 'invalid-level-definition' | 'invalid-objective-definition' | 'invalid-scoring-rules',
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BoardDomainError(
      code,
      `${label} must be a non-negative safe integer; received ${String(value)}`,
    );
  }
}

function assertSafePositiveInteger(
  value: number,
  label: string,
  code: 'invalid-level-definition' | 'invalid-objective-definition' | 'invalid-scoring-rules',
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BoardDomainError(
      code,
      `${label} must be a positive safe integer; received ${String(value)}`,
    );
  }
}

function cloneObjective(objective: LevelObjectiveDefinition): LevelObjectiveDefinition {
  if (objective.kind === 'score') {
    return {
      id: objective.id,
      kind: 'score',
      targetScore: objective.targetScore,
    };
  }

  return {
    id: objective.id,
    kind: 'collect-piece',
    pieceType: objective.pieceType,
    targetCount: objective.targetCount,
  };
}

function validateObjective(objective: LevelObjectiveDefinition, index: number): void {
  if (!objective.id.trim()) {
    throw new BoardDomainError(
      'invalid-objective-definition',
      `objective at index ${index} has an empty id`,
    );
  }

  if (objective.kind === 'score') {
    assertSafePositiveInteger(
      objective.targetScore,
      `score objective targetScore at index ${index}`,
      'invalid-objective-definition',
    );
    return;
  }

  if (objective.kind === 'collect-piece') {
    if (!isPieceType(objective.pieceType)) {
      throw new BoardDomainError(
        'invalid-objective-definition',
        `collect objective at index ${index} has invalid piece type ${JSON.stringify(objective.pieceType)}`,
      );
    }

    assertSafePositiveInteger(
      objective.targetCount,
      `collect objective targetCount at index ${index}`,
      'invalid-objective-definition',
    );
    return;
  }

  throw new BoardDomainError(
    'invalid-objective-definition',
    `objective at index ${index} has unsupported kind`,
  );
}

export function validateScoringRules(rules: ScoringRulesValidationInput): ScoringRules {
  assertSafePositiveInteger(
    rules.pointsPerRemovedPiece,
    'pointsPerRemovedPiece',
    'invalid-scoring-rules',
  );
  assertSafeNonNegativeInteger(
    rules.lineClearActivationBonus,
    'lineClearActivationBonus',
    'invalid-scoring-rules',
  );
  const canonical = rules.crossClearActivationBonus;
  const legacy = rules.areaClearActivationBonus;
  if (canonical !== undefined && legacy !== undefined && canonical !== legacy) {
    throw new BoardDomainError(
      'invalid-scoring-rules',
      `conflicting cross-clear activation bonuses: crossClearActivationBonus=${String(canonical)} and areaClearActivationBonus=${String(legacy)}`,
    );
  }
  const crossClearActivationBonus = canonical ?? legacy;
  if (crossClearActivationBonus === undefined) {
    throw new BoardDomainError(
      'invalid-scoring-rules',
      'crossClearActivationBonus (or legacy areaClearActivationBonus) is required',
    );
  }
  assertSafeNonNegativeInteger(
    crossClearActivationBonus,
    'crossClearActivationBonus',
    'invalid-scoring-rules',
  );
  assertSafeNonNegativeInteger(
    rules.wildcardActivationBonus,
    'wildcardActivationBonus',
    'invalid-scoring-rules',
  );
  assertSafeNonNegativeInteger(
    rules.cascadeMultiplierIncrement,
    'cascadeMultiplierIncrement',
    'invalid-scoring-rules',
  );

  return {
    pointsPerRemovedPiece: rules.pointsPerRemovedPiece,
    lineClearActivationBonus: rules.lineClearActivationBonus,
    crossClearActivationBonus,
    wildcardActivationBonus: rules.wildcardActivationBonus,
    cascadeMultiplierIncrement: rules.cascadeMultiplierIncrement,
  };
}

export function validateLevelDefinition(definition: LevelDefinition): LevelDefinition {
  if (!definition.id.trim()) {
    throw new BoardDomainError('invalid-level-definition', 'level id must be non-empty');
  }

  assertSafePositiveInteger(definition.moveLimit, 'moveLimit', 'invalid-level-definition');

  if (!Number.isInteger(definition.seed)) {
    throw new BoardDomainError('invalid-level-definition', 'seed must be an integer');
  }

  if (
    !Array.isArray(definition.allowedRefillPieceTypes) ||
    definition.allowedRefillPieceTypes.length === 0
  ) {
    throw new BoardDomainError(
      'invalid-level-definition',
      'allowedRefillPieceTypes must contain at least one piece type',
    );
  }

  const pieceTypes: PieceType[] = [];
  for (const pieceType of definition.allowedRefillPieceTypes) {
    if (!isPieceType(pieceType)) {
      throw new BoardDomainError(
        'invalid-level-definition',
        `invalid allowed refill piece type ${JSON.stringify(pieceType)}`,
      );
    }

    if (!pieceTypes.includes(pieceType)) {
      pieceTypes.push(pieceType);
    }
  }

  if (!Array.isArray(definition.objectives) || definition.objectives.length === 0) {
    throw new BoardDomainError(
      'invalid-level-definition',
      'level definition must include at least one objective',
    );
  }

  const objectiveIds = new Set<string>();
  const objectives = definition.objectives.map((objective, index) => {
    validateObjective(objective, index);
    if (objectiveIds.has(objective.id)) {
      throw new BoardDomainError(
        'duplicate-objective-id',
        `duplicate objective id ${JSON.stringify(objective.id)}`,
      );
    }
    objectiveIds.add(objective.id);
    return cloneObjective(objective);
  });

  const scoring = validateScoringRules(definition.scoring);

  if (definition.maxCascadeSteps !== undefined) {
    assertSafePositiveInteger(
      definition.maxCascadeSteps,
      'maxCascadeSteps',
      'invalid-level-definition',
    );
  }

  if (definition.maxSpecialActivations !== undefined) {
    assertSafePositiveInteger(
      definition.maxSpecialActivations,
      'maxSpecialActivations',
      'invalid-level-definition',
    );
  }

  if (definition.reshuffle?.maxRandomAttempts !== undefined) {
    assertSafePositiveInteger(
      definition.reshuffle.maxRandomAttempts,
      'reshuffle.maxRandomAttempts',
      'invalid-level-definition',
    );
  }

  if (definition.reshuffle?.maxSearchNodes !== undefined) {
    assertSafePositiveInteger(
      definition.reshuffle.maxSearchNodes,
      'reshuffle.maxSearchNodes',
      'invalid-level-definition',
    );
  }

  return {
    id: definition.id,
    moveLimit: definition.moveLimit,
    allowedRefillPieceTypes: [...pieceTypes],
    objectives,
    scoring,
    seed: definition.seed,
    maxCascadeSteps: definition.maxCascadeSteps,
    maxSpecialActivations: definition.maxSpecialActivations,
    reshuffle: definition.reshuffle
      ? {
          maxRandomAttempts: definition.reshuffle.maxRandomAttempts,
          maxSearchNodes: definition.reshuffle.maxSearchNodes,
        }
      : undefined,
  };
}

export function validateLevelStateRelationship(
  definition: LevelDefinition,
  state: LevelSessionState,
): void {
  if (state.levelId !== definition.id) {
    throw new BoardDomainError(
      'level-state-mismatch',
      `state levelId ${JSON.stringify(state.levelId)} does not match definition id ${JSON.stringify(definition.id)}`,
    );
  }

  if (state.baseSeed !== definition.seed) {
    throw new BoardDomainError(
      'level-state-mismatch',
      `state baseSeed ${String(state.baseSeed)} does not match definition seed ${String(definition.seed)}`,
    );
  }

  if (!Number.isSafeInteger(state.score) || state.score < 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      'state score must be a non-negative safe integer',
    );
  }

  if (!Number.isSafeInteger(state.movesRemaining) || state.movesRemaining < 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      'state movesRemaining must be a non-negative safe integer',
    );
  }

  if (!Number.isSafeInteger(state.acceptedMoveCount) || state.acceptedMoveCount < 0) {
    throw new BoardDomainError(
      'invalid-level-state',
      'state acceptedMoveCount must be a non-negative safe integer',
    );
  }

  if (state.objectiveProgress.length !== definition.objectives.length) {
    throw new BoardDomainError(
      'level-state-mismatch',
      'objective progress length does not match objective definition length',
    );
  }

  definition.objectives.forEach((objective, index) => {
    const progress = state.objectiveProgress[index];
    if (progress.objectiveId !== objective.id || progress.kind !== objective.kind) {
      throw new BoardDomainError(
        'level-state-mismatch',
        `objective progress mismatch at index ${index}`,
      );
    }
  });
}

export function isScoreObjective(
  objective: LevelObjectiveDefinition,
): objective is ScoreObjectiveDefinition {
  return objective.kind === 'score';
}

export function isCollectObjective(
  objective: LevelObjectiveDefinition,
): objective is CollectPieceObjectiveDefinition {
  return objective.kind === 'collect-piece';
}
