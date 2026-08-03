import { findPlayableSwaps } from '../../../../src/game/board';
import {
  createGeneratedLevelSession,
  getPlayableLevelContent,
  playableLevelCatalog,
  type PlayableLevelContent,
} from '../../../../src/game/content/levelCatalog';
import { applyLevelMove } from '../../../../src/game/level';
import { type LevelSessionState } from '../../../../src/game/level/levelTypes';

/** Catalog seed plus 20 fixed additional seeds, shared across levels. */
export const BALANCE_PROBE_SEEDS: readonly number[] = [
  1807, 1808, 1809, 1810, 1901, 1907, 2001, 2107, 2203, 2309, 2401, 2503, 2609, 2707, 2801, 2903,
  3001, 3109, 3203, 3307, 3401,
];

export interface BalanceProbeSpecialCounts {
  lineClear: number;
  crossClear: number;
  wildcard: number;
}

export interface BalanceProbeRunResult {
  levelId: string;
  seed: number;
  moveLimit: number;
  status: 'won' | 'failed' | 'active';
  finalScore: number;
  movesUsed: number;
  movesRemaining: number;
  collectionComplete: boolean;
  scoreComplete: boolean;
  specialsCreated: number;
  specialsActivated: number;
  specialsCreatedByKind: BalanceProbeSpecialCounts;
  specialsActivatedByKind: BalanceProbeSpecialCounts;
  cascadeSteps: number;
}

export interface BalanceProbeLevelSummary {
  levelId: string;
  moveLimit: number;
  targetScore: number;
  seedCount: number;
  wins: number;
  failures: number;
  unfinished: number;
  scores: number[];
  movesUsed: number[];
  movesRemainingOnWin: number[];
  collectionCompleteCount: number;
  specialsCreated: number;
  specialsActivated: number;
  specialsCreatedByKind: BalanceProbeSpecialCounts;
  specialsActivatedByKind: BalanceProbeSpecialCounts;
  cascadeSteps: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  medianMovesUsed: number;
  medianMovesRemainingOnWin: number | null;
}

function emptySpecialCounts(): BalanceProbeSpecialCounts {
  return { lineClear: 0, crossClear: 0, wildcard: 0 };
}

function addSpecialCounts(
  target: BalanceProbeSpecialCounts,
  addition: BalanceProbeSpecialCounts,
): BalanceProbeSpecialCounts {
  return {
    lineClear: target.lineClear + addition.lineClear,
    crossClear: target.crossClear + addition.crossClear,
    wildcard: target.wildcard + addition.wildcard,
  };
}

function countCreatedKind(kind: string, counts: BalanceProbeSpecialCounts): void {
  if (kind === 'line-clear') counts.lineClear += 1;
  else if (kind === 'cross-clear') counts.crossClear += 1;
  else if (kind === 'wildcard') counts.wildcard += 1;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function compareCoordinates(
  left: { row: number; column: number },
  right: { row: number; column: number },
): number {
  return left.row - right.row || left.column - right.column;
}

/**
 * Deterministic greedy heuristic for balance evidence only.
 * Prefer objective completion, then score, then collection delta, then special
 * creation/activation, then coordinate order.
 */
function definitionForRun(content: PlayableLevelContent, state: LevelSessionState) {
  return { ...content.definition, seed: state.baseSeed };
}

export function chooseBalanceProbeMove(input: {
  content: PlayableLevelContent;
  state: LevelSessionState;
}): { from: { row: number; column: number }; to: { row: number; column: number } } | null {
  const swaps = findPlayableSwaps(input.state.board);
  if (swaps.length === 0) return null;
  const definition = definitionForRun(input.content, input.state);

  let best:
    | {
        from: { row: number; column: number };
        to: { row: number; column: number };
        completesObjectives: number;
        scoreDelta: number;
        collectionDelta: number;
        specialCreated: number;
        specialActivated: number;
      }
    | undefined;

  for (const swap of swaps) {
    const result = applyLevelMove({
      definition,
      state: input.state,
      from: swap.from,
      to: swap.to,
    });
    if (!result.accepted) continue;

    const collectionDelta = result.objectiveUpdates
      .filter((update) => update.next.kind === 'collect-piece')
      .reduce((sum, update) => sum + update.delta, 0);
    const specialCreated = result.resolution.steps.reduce(
      (sum, step) => sum + step.createdSpecialPieces.length,
      0,
    );
    const specialActivated = result.resolution.steps.reduce(
      (sum, step) => sum + step.activationEvents.length,
      0,
    );
    const completesObjectives = result.nextStatus === 'won' ? 1 : 0;
    const candidate = {
      from: swap.from,
      to: swap.to,
      completesObjectives,
      scoreDelta: result.scoreAfter - result.scoreBefore,
      collectionDelta,
      specialCreated,
      specialActivated,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    const better =
      candidate.completesObjectives !== best.completesObjectives
        ? candidate.completesObjectives > best.completesObjectives
        : candidate.scoreDelta !== best.scoreDelta
          ? candidate.scoreDelta > best.scoreDelta
          : candidate.collectionDelta !== best.collectionDelta
            ? candidate.collectionDelta > best.collectionDelta
            : candidate.specialCreated + candidate.specialActivated !==
                best.specialCreated + best.specialActivated
              ? candidate.specialCreated + candidate.specialActivated >
                best.specialCreated + best.specialActivated
              : compareCoordinates(candidate.from, best.from) < 0 ||
                (compareCoordinates(candidate.from, best.from) === 0 &&
                  compareCoordinates(candidate.to, best.to) < 0);

    if (better) best = candidate;
  }

  return best ? { from: best.from, to: best.to } : null;
}

export function runBalanceProbeForSeed(
  content: PlayableLevelContent,
  seed: number,
): BalanceProbeRunResult {
  let state = createGeneratedLevelSession({ content, seed }).state;
  let specialsCreated = 0;
  let specialsActivated = 0;
  let cascadeSteps = 0;
  const specialsCreatedByKind = emptySpecialCounts();
  const specialsActivatedByKind = emptySpecialCounts();

  while (state.status === 'active' && state.movesRemaining > 0) {
    const choice = chooseBalanceProbeMove({ content, state });
    if (!choice) break;
    const result = applyLevelMove({
      definition: definitionForRun(content, state),
      state,
      from: choice.from,
      to: choice.to,
    });
    if (!result.accepted) break;
    specialsCreated += result.resolution.steps.reduce(
      (sum, step) => sum + step.createdSpecialPieces.length,
      0,
    );
    specialsActivated += result.resolution.steps.reduce(
      (sum, step) => sum + step.activationEvents.length,
      0,
    );
    for (const step of result.resolution.steps) {
      for (const created of step.createdSpecialPieces) {
        countCreatedKind(created.piece.kind, specialsCreatedByKind);
      }
      for (const event of step.activationEvents) {
        countCreatedKind(event.piece.kind, specialsActivatedByKind);
      }
    }
    cascadeSteps += result.resolution.steps.length;
    state = result.nextState;
  }

  const scoreObjective = state.objectiveProgress.find((entry) => entry.kind === 'score');
  const collectionObjective = state.objectiveProgress.find(
    (entry) => entry.kind === 'collect-piece',
  );

  return {
    levelId: content.id,
    seed,
    moveLimit: content.definition.moveLimit,
    status: state.status,
    finalScore: state.score,
    movesUsed: content.definition.moveLimit - state.movesRemaining,
    movesRemaining: state.movesRemaining,
    collectionComplete: Boolean(collectionObjective?.complete),
    scoreComplete: Boolean(scoreObjective?.complete),
    specialsCreated,
    specialsActivated,
    specialsCreatedByKind,
    specialsActivatedByKind,
    cascadeSteps,
  };
}

export function summarizeBalanceProbeRuns(
  content: PlayableLevelContent,
  runs: readonly BalanceProbeRunResult[],
): BalanceProbeLevelSummary {
  const targetScore =
    content.definition.objectives.find((objective) => objective.kind === 'score')?.targetScore ?? 0;
  const wins = runs.filter((run) => run.status === 'won');
  const scores = runs.map((run) => run.finalScore);
  const movesUsed = runs.map((run) => run.movesUsed);
  const movesRemainingOnWin = wins.map((run) => run.movesRemaining);

  return {
    levelId: content.id,
    moveLimit: content.definition.moveLimit,
    targetScore,
    seedCount: runs.length,
    wins: wins.length,
    failures: runs.filter((run) => run.status === 'failed').length,
    unfinished: runs.filter((run) => run.status === 'active').length,
    scores,
    movesUsed,
    movesRemainingOnWin,
    collectionCompleteCount: runs.filter((run) => run.collectionComplete).length,
    specialsCreated: runs.reduce((sum, run) => sum + run.specialsCreated, 0),
    specialsActivated: runs.reduce((sum, run) => sum + run.specialsActivated, 0),
    specialsCreatedByKind: runs.reduce(
      (sum, run) => addSpecialCounts(sum, run.specialsCreatedByKind),
      emptySpecialCounts(),
    ),
    specialsActivatedByKind: runs.reduce(
      (sum, run) => addSpecialCounts(sum, run.specialsActivatedByKind),
      emptySpecialCounts(),
    ),
    cascadeSteps: runs.reduce((sum, run) => sum + run.cascadeSteps, 0),
    medianScore: median(scores),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    medianMovesUsed: median(movesUsed),
    medianMovesRemainingOnWin:
      movesRemainingOnWin.length === 0 ? null : median(movesRemainingOnWin),
  };
}

export function runBalanceProbeMatrix(
  seeds: readonly number[] = BALANCE_PROBE_SEEDS,
  catalog: readonly PlayableLevelContent[] = playableLevelCatalog,
): {
  runs: BalanceProbeRunResult[];
  summaries: BalanceProbeLevelSummary[];
} {
  const runs: BalanceProbeRunResult[] = [];
  for (const content of catalog) {
    for (const seed of seeds) {
      runs.push(runBalanceProbeForSeed(content, seed));
    }
  }
  const summaries = catalog.map((content) =>
    summarizeBalanceProbeRuns(
      content,
      runs.filter((run) => run.levelId === content.id),
    ),
  );
  return { runs, summaries };
}

export function getCatalogContentOrThrow(levelId: string): PlayableLevelContent {
  const content = getPlayableLevelContent(levelId);
  if (!content) throw new Error(`Missing level ${levelId}`);
  return content;
}
