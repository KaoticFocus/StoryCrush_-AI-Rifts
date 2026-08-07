import { findPlayableSwaps, generateBoard } from '../../../../src/game/board';
import {
  getPlayableLevelContent,
  type PlayableLevelContent,
} from '../../../../src/game/content/levelCatalog';
import { applyLevelMove, createLevelSession } from '../../../../src/game/level';
import { type AcceptedLevelMoveResult } from '../../../../src/game/level/levelTypes';
import { type LevelSessionState } from '../../../../src/game/level/levelTypes';
import { type BoardCoordinate } from '../../../../src/game/board/boardTypes';

export const RIFT_PRESSURE_PROBE_SEEDS: readonly number[] = Array.from(
  { length: 40 },
  (_, index) => 1831 + index,
);

export type RiftPressureProbePolicy = 'first-playable' | 'objective-first' | 'threat-aware';

export interface RiftPressureProbeTunables {
  moveLimit: number;
  scoreTarget: number;
  collectionTarget: number;
  spreadInterval: number;
  hungerMaximum: number;
}

export interface RiftPressureProbeRun {
  seed: number;
  policy: RiftPressureProbePolicy;
  outcome: 'won' | 'failed' | 'unfinished';
  score: number;
  movesUsed: number;
  movesRemaining: number;
  hungerAtFinish: number;
  maximumHungerReached: number;
  spreadCount: number;
  corruptedCellsCreated: number;
  corruptedCellsCleansed: number;
  adjacentCleanses: number;
  lineCleanses: number;
  crossCleanses: number;
  wildcardCleanses: number;
  specialOriginUniqueCleanses: number;
  specialActivations: number;
  cascades: number;
  reshuffles: number;
  nearOverwhelmReached: boolean;
  recoveredAfterNearOverwhelm: boolean;
  threatFailure: boolean;
  moveLimitFailure: boolean;
  unfinished: boolean;
  invalidRejectedSelection: boolean;
  returnedActiveWithoutPlayable: boolean;
}

export interface RiftPressureProbeSummary {
  policy: RiftPressureProbePolicy;
  seedCount: number;
  wins: number;
  failures: number;
  unfinished: number;
  winRate: number;
  threatFailures: number;
  moveLimitFailures: number;
  medianScore: number | null;
  medianMovesUsed: number | null;
  medianHunger: number | null;
  medianSpreads: number | null;
  medianCleanses: number | null;
  medianSpecialOriginCleanses: number | null;
  specialOriginCleanseRate: number;
  nearOverwhelmWins: number;
  totalReshuffles: number;
  invalidRejectedSelections: number;
  returnedActiveWithoutPlayable: number;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function compareCoordinates(left: BoardCoordinate, right: BoardCoordinate): number {
  return left.row - right.row || left.column - right.column;
}

function getPressureContent(): PlayableLevelContent {
  const content = getPlayableLevelContent('thornwake-containment');
  if (!content) {
    throw new Error('thornwake-containment catalog entry missing');
  }
  return content;
}

export function getEffectiveThreatDeadline(content: PlayableLevelContent): number {
  const threat = content.definition.threat;
  if (!threat || threat.kind !== 'rift-hunger') {
    return Number.POSITIVE_INFINITY;
  }
  return threat.spreadInterval * threat.hungerMaximum;
}

export function createPressureProbeContent(
  tunables?: Partial<RiftPressureProbeTunables>,
): PlayableLevelContent {
  const base = getPressureContent();
  const threat = base.definition.threat;
  if (!threat || threat.kind !== 'rift-hunger') {
    throw new Error('thornwake-containment missing rift-hunger threat');
  }
  const score =
    tunables?.scoreTarget ??
    base.definition.objectives.find((entry) => entry.kind === 'score')!.targetScore;
  const collection =
    tunables?.collectionTarget ??
    base.definition.objectives.find((entry) => entry.kind === 'collect-piece')!.targetCount;
  return {
    ...base,
    definition: {
      ...base.definition,
      moveLimit: tunables?.moveLimit ?? base.definition.moveLimit,
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: score },
        {
          id: 'collect-topaz',
          kind: 'collect-piece',
          pieceType: 'topaz',
          targetCount: collection,
        },
      ],
      threat: {
        ...threat,
        spreadInterval: tunables?.spreadInterval ?? threat.spreadInterval,
        hungerMaximum: tunables?.hungerMaximum ?? threat.hungerMaximum,
      },
    },
  };
}

function objectiveProgressTotal(state: LevelSessionState): number {
  return state.objectiveProgress.reduce((sum, entry) => sum + entry.current, 0);
}

function collectionCurrent(state: LevelSessionState): number {
  return state.objectiveProgress.find((entry) => entry.kind === 'collect-piece')?.current ?? 0;
}

function countCleanseCauses(result: AcceptedLevelMoveResult): {
  adjacent: number;
  line: number;
  cross: number;
  wildcard: number;
  specialOriginUnique: number;
} {
  let adjacent = 0;
  let line = 0;
  let cross = 0;
  let wildcard = 0;
  let specialOriginUnique = 0;
  for (const event of result.threatTransition?.cleanseEvents ?? []) {
    if (event.causes.includes('adjacent-match')) adjacent += 1;
    if (event.causes.includes('line-clear')) line += 1;
    if (event.causes.includes('cross-clear')) cross += 1;
    if (event.causes.includes('wildcard')) wildcard += 1;
    if (
      event.causes.includes('line-clear') ||
      event.causes.includes('cross-clear') ||
      event.causes.includes('wildcard')
    ) {
      specialOriginUnique += 1;
    }
  }
  return { adjacent, line, cross, wildcard, specialOriginUnique };
}

function chooseFirstPlayable(state: LevelSessionState): {
  from: BoardCoordinate;
  to: BoardCoordinate;
} | null {
  const moves = findPlayableSwaps(state.board, state.threatState?.corruptedCells ?? []);
  return moves[0] ?? null;
}

function chooseObjectiveFirst(input: {
  content: PlayableLevelContent;
  state: LevelSessionState;
}): { from: BoardCoordinate; to: BoardCoordinate } | null {
  const definition = { ...input.content.definition, seed: input.state.baseSeed };
  const moves = findPlayableSwaps(input.state.board, input.state.threatState?.corruptedCells ?? []);
  let best:
    | {
        from: BoardCoordinate;
        to: BoardCoordinate;
        win: number;
        objectiveDelta: number;
        scoreDelta: number;
        collectionDelta: number;
        cleanseCount: number;
      }
    | undefined;

  for (const move of moves) {
    const result = applyLevelMove({
      definition,
      state: input.state,
      from: move.from,
      to: move.to,
    });
    if (!result.accepted) continue;
    const candidate = {
      from: move.from,
      to: move.to,
      win: result.nextStatus === 'won' ? 1 : 0,
      objectiveDelta:
        objectiveProgressTotal(result.nextState) - objectiveProgressTotal(input.state),
      scoreDelta: result.scoreAfter - result.scoreBefore,
      collectionDelta: collectionCurrent(result.nextState) - collectionCurrent(input.state),
      cleanseCount: result.threatTransition?.cleanseEvents.length ?? 0,
    };
    if (!best) {
      best = candidate;
      continue;
    }
    const better =
      candidate.win !== best.win
        ? candidate.win > best.win
        : candidate.objectiveDelta !== best.objectiveDelta
          ? candidate.objectiveDelta > best.objectiveDelta
          : candidate.scoreDelta !== best.scoreDelta
            ? candidate.scoreDelta > best.scoreDelta
            : candidate.collectionDelta !== best.collectionDelta
              ? candidate.collectionDelta > best.collectionDelta
              : candidate.cleanseCount !== best.cleanseCount
                ? candidate.cleanseCount > best.cleanseCount
                : compareCoordinates(candidate.from, best.from) < 0 ||
                  (compareCoordinates(candidate.from, best.from) === 0 &&
                    compareCoordinates(candidate.to, best.to) < 0);
    if (better) best = candidate;
  }
  return best ? { from: best.from, to: best.to } : null;
}

function chooseThreatAware(input: {
  content: PlayableLevelContent;
  state: LevelSessionState;
}): { from: BoardCoordinate; to: BoardCoordinate } | null {
  const definition = { ...input.content.definition, seed: input.state.baseSeed };
  const moves = findPlayableSwaps(input.state.board, input.state.threatState?.corruptedCells ?? []);
  let best:
    | {
        from: BoardCoordinate;
        to: BoardCoordinate;
        win: number;
        avoidOverwhelm: number;
        cleanseCount: number;
        specialOriginCleanses: number;
        objectiveDelta: number;
        scoreDelta: number;
        playableAfter: number;
      }
    | undefined;

  for (const move of moves) {
    const result = applyLevelMove({
      definition,
      state: input.state,
      from: move.from,
      to: move.to,
    });
    if (!result.accepted) continue;
    const cleanses = countCleanseCauses(result);
    const playableAfter =
      result.nextStatus === 'active'
        ? findPlayableSwaps(
            result.nextState.board,
            result.nextState.threatState?.corruptedCells ?? [],
          ).length
        : 0;
    const candidate = {
      from: move.from,
      to: move.to,
      win: result.nextStatus === 'won' ? 1 : 0,
      avoidOverwhelm: result.nextState.threatState?.status === 'overwhelmed' ? 0 : 1,
      cleanseCount: result.threatTransition?.cleanseEvents.length ?? 0,
      specialOriginCleanses: cleanses.specialOriginUnique,
      objectiveDelta:
        objectiveProgressTotal(result.nextState) - objectiveProgressTotal(input.state),
      scoreDelta: result.scoreAfter - result.scoreBefore,
      playableAfter,
    };
    if (!best) {
      best = candidate;
      continue;
    }
    const better =
      candidate.win !== best.win
        ? candidate.win > best.win
        : candidate.avoidOverwhelm !== best.avoidOverwhelm
          ? candidate.avoidOverwhelm > best.avoidOverwhelm
          : candidate.cleanseCount !== best.cleanseCount
            ? candidate.cleanseCount > best.cleanseCount
            : candidate.specialOriginCleanses !== best.specialOriginCleanses
              ? candidate.specialOriginCleanses > best.specialOriginCleanses
              : candidate.objectiveDelta !== best.objectiveDelta
                ? candidate.objectiveDelta > best.objectiveDelta
                : candidate.scoreDelta !== best.scoreDelta
                  ? candidate.scoreDelta > best.scoreDelta
                  : candidate.playableAfter !== best.playableAfter
                    ? candidate.playableAfter > best.playableAfter
                    : compareCoordinates(candidate.from, best.from) < 0 ||
                      (compareCoordinates(candidate.from, best.from) === 0 &&
                        compareCoordinates(candidate.to, best.to) < 0);
    if (better) best = candidate;
  }
  return best ? { from: best.from, to: best.to } : null;
}

function chooseMove(
  policy: RiftPressureProbePolicy,
  content: PlayableLevelContent,
  state: LevelSessionState,
): { from: BoardCoordinate; to: BoardCoordinate } | null {
  if (policy === 'first-playable') return chooseFirstPlayable(state);
  if (policy === 'objective-first') return chooseObjectiveFirst({ content, state });
  return chooseThreatAware({ content, state });
}

export function runRiftPressureProbeForSeed(input: {
  seed: number;
  policy: RiftPressureProbePolicy;
  content?: PlayableLevelContent;
}): RiftPressureProbeRun {
  const content = input.content ?? getPressureContent();
  const board = generateBoard({
    rows: content.boardRows,
    columns: content.boardColumns,
    pieceTypes: content.allowedPieceTypes,
    seed: input.seed,
  });
  const definition = { ...content.definition, seed: input.seed };
  let state = createLevelSession({ definition, initialBoard: board }).state;
  const hungerMaximum =
    definition.threat?.kind === 'rift-hunger' ? definition.threat.hungerMaximum : 0;
  const initialCorrupted = state.threatState?.corruptedCells.length ?? 0;

  let spreadCount = 0;
  let adjacentCleanses = 0;
  let lineCleanses = 0;
  let crossCleanses = 0;
  let wildcardCleanses = 0;
  let specialOriginUniqueCleanses = 0;
  let corruptedCellsCleansed = 0;
  let specialActivations = 0;
  let cascades = 0;
  let reshuffles = 0;
  let maximumHungerReached = state.threatState?.hungerCurrent ?? 0;
  let nearOverwhelmReached = false;
  let invalidRejectedSelection = false;
  let returnedActiveWithoutPlayable = false;

  while (state.status === 'active') {
    const playable = findPlayableSwaps(state.board, state.threatState?.corruptedCells ?? []);
    if (playable.length === 0) {
      returnedActiveWithoutPlayable = true;
      break;
    }
    const choice = chooseMove(input.policy, content, state);
    if (!choice) {
      returnedActiveWithoutPlayable = true;
      break;
    }
    const result = applyLevelMove({
      definition,
      state,
      from: choice.from,
      to: choice.to,
    });
    if (!result.accepted) {
      invalidRejectedSelection = true;
      break;
    }
    if (result.threatTransition?.spreadEvent) spreadCount += 1;
    const causes = countCleanseCauses(result);
    adjacentCleanses += causes.adjacent;
    lineCleanses += causes.line;
    crossCleanses += causes.cross;
    wildcardCleanses += causes.wildcard;
    specialOriginUniqueCleanses += causes.specialOriginUnique;
    corruptedCellsCleansed += result.threatTransition?.cleanseEvents.length ?? 0;
    specialActivations += result.resolution.steps.reduce(
      (sum, step) => sum + step.activationEvents.length,
      0,
    );
    cascades += Math.max(0, result.resolution.steps.length - 1);
    if (result.reshuffle) reshuffles += 1;
    maximumHungerReached = Math.max(
      maximumHungerReached,
      result.nextState.threatState?.hungerCurrent ?? 0,
    );
    if (
      result.nextState.status === 'active' &&
      (result.nextState.threatState?.hungerCurrent ?? 0) === hungerMaximum - 1
    ) {
      nearOverwhelmReached = true;
    }
    state = result.nextState;
  }

  const finalCorrupted = state.threatState?.corruptedCells.length ?? 0;
  const threatFailure = state.status === 'failed' && state.threatState?.status === 'overwhelmed';
  const moveLimitFailure = state.status === 'failed' && !threatFailure;
  const unfinished = state.status === 'active';
  const outcome: RiftPressureProbeRun['outcome'] = unfinished
    ? 'unfinished'
    : state.status === 'won'
      ? 'won'
      : 'failed';
  return {
    seed: input.seed,
    policy: input.policy,
    outcome,
    score: state.score,
    movesUsed: definition.moveLimit - state.movesRemaining,
    movesRemaining: state.movesRemaining,
    hungerAtFinish: state.threatState?.hungerCurrent ?? 0,
    maximumHungerReached,
    spreadCount,
    corruptedCellsCreated: Math.max(0, finalCorrupted + corruptedCellsCleansed - initialCorrupted),
    corruptedCellsCleansed,
    adjacentCleanses,
    lineCleanses,
    crossCleanses,
    wildcardCleanses,
    specialOriginUniqueCleanses,
    specialActivations,
    cascades,
    reshuffles,
    nearOverwhelmReached,
    recoveredAfterNearOverwhelm: nearOverwhelmReached && outcome === 'won',
    threatFailure,
    moveLimitFailure,
    unfinished,
    invalidRejectedSelection,
    returnedActiveWithoutPlayable,
  };
}

export function runRiftPressureProbeMatrix(input?: {
  seeds?: readonly number[];
  policies?: readonly RiftPressureProbePolicy[];
  content?: PlayableLevelContent;
}): RiftPressureProbeRun[] {
  const seeds = input?.seeds ?? RIFT_PRESSURE_PROBE_SEEDS;
  const policies =
    input?.policies ?? (['first-playable', 'objective-first', 'threat-aware'] as const);
  const content = input?.content ?? getPressureContent();
  const runs: RiftPressureProbeRun[] = [];
  for (const policy of policies) {
    for (const seed of seeds) {
      runs.push(runRiftPressureProbeForSeed({ seed, policy, content }));
    }
  }
  return runs;
}

export function summarizeRiftPressureProbe(
  policy: RiftPressureProbePolicy,
  runs: readonly RiftPressureProbeRun[],
): RiftPressureProbeSummary {
  const scoped = runs.filter((run) => run.policy === policy);
  const wins = scoped.filter((run) => run.outcome === 'won').length;
  const failures = scoped.filter((run) => run.outcome === 'failed').length;
  const unfinished = scoped.filter((run) => run.outcome === 'unfinished').length;
  const withSpecialOrigin = scoped.filter((run) => run.specialOriginUniqueCleanses > 0).length;
  return {
    policy,
    seedCount: scoped.length,
    wins,
    failures,
    unfinished,
    winRate: scoped.length === 0 ? 0 : wins / scoped.length,
    threatFailures: scoped.filter((run) => run.threatFailure).length,
    moveLimitFailures: scoped.filter((run) => run.moveLimitFailure).length,
    medianScore: median(scoped.map((run) => run.score)),
    medianMovesUsed: median(scoped.map((run) => run.movesUsed)),
    medianHunger: median(scoped.map((run) => run.hungerAtFinish)),
    medianSpreads: median(scoped.map((run) => run.spreadCount)),
    medianCleanses: median(scoped.map((run) => run.corruptedCellsCleansed)),
    medianSpecialOriginCleanses: median(scoped.map((run) => run.specialOriginUniqueCleanses)),
    specialOriginCleanseRate: scoped.length === 0 ? 0 : withSpecialOrigin / scoped.length,
    nearOverwhelmWins: scoped.filter((run) => run.recoveredAfterNearOverwhelm).length,
    totalReshuffles: scoped.reduce((sum, run) => sum + run.reshuffles, 0),
    invalidRejectedSelections: scoped.filter((run) => run.invalidRejectedSelection).length,
    returnedActiveWithoutPlayable: scoped.filter((run) => run.returnedActiveWithoutPlayable).length,
  };
}

export function summarizeAllRiftPressurePolicies(runs: readonly RiftPressureProbeRun[]) {
  return {
    firstPlayable: summarizeRiftPressureProbe('first-playable', runs),
    objectiveFirst: summarizeRiftPressureProbe('objective-first', runs),
    threatAware: summarizeRiftPressureProbe('threat-aware', runs),
  };
}

export function evaluateHardGates(summary: RiftPressureProbeSummary): boolean {
  return (
    summary.unfinished === 0 &&
    summary.invalidRejectedSelections === 0 &&
    summary.returnedActiveWithoutPlayable === 0
  );
}
