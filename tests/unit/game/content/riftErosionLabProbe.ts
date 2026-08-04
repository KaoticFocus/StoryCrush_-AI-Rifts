import { findPlayableSwaps } from '../../../../src/game/board';
import {
  getPlayableLevelContent,
  type PlayableLevelContent,
} from '../../../../src/game/content/levelCatalog';
import { applyLevelMove, createLevelSession } from '../../../../src/game/level';
import { generateBoard } from '../../../../src/game/board';

export const RIFT_EROSION_LAB_PROBE_SEEDS: readonly number[] = [
  1810, 1811, 1812, 1813, 1814, 1815, 1816, 1817, 1818, 1819, 1820, 1821, 1822, 1823, 1824, 1825,
  1826, 1827, 1828, 1829, 1830,
];

export interface RiftErosionLabProbeRun {
  seed: number;
  outcome: 'won' | 'failed' | 'unfinished';
  score: number;
  movesUsed: number;
  hungerAtFinish: number;
  spreadCount: number;
  corruptedCellsCreated: number;
  corruptedCellsCleansed: number;
  threatFailure: boolean;
  reshuffleCount: number;
}

function getLabContent(): PlayableLevelContent {
  const content = getPlayableLevelContent('rift-erosion-lab');
  if (!content) {
    throw new Error('rift-erosion-lab catalog entry missing');
  }
  return content;
}

export function runRiftErosionLabProbeForSeed(seed: number): RiftErosionLabProbeRun {
  const content = getLabContent();
  const board = generateBoard({
    rows: content.boardRows,
    columns: content.boardColumns,
    pieceTypes: content.allowedPieceTypes,
    seed,
  });
  const definition = { ...content.definition, seed };
  let state = createLevelSession({ definition, initialBoard: board }).state;

  let spreadCount = 0;
  let corruptedCellsCleansed = 0;
  let reshuffleCount = 0;
  const initialCorrupted = state.threatState?.corruptedCells.length ?? 0;

  while (state.status === 'active' && state.movesRemaining > 0) {
    const unavailable = state.threatState?.corruptedCells ?? [];
    const moves = findPlayableSwaps(state.board, unavailable);
    if (moves.length === 0) {
      break;
    }
    const choice = moves[0]!;
    const result = applyLevelMove({
      definition,
      state,
      from: choice.from,
      to: choice.to,
    });
    if (!result.accepted) {
      break;
    }
    if (result.threatTransition?.spreadEvent) {
      spreadCount += 1;
    }
    corruptedCellsCleansed += result.threatTransition?.cleanseEvents.length ?? 0;
    if (result.reshuffle) {
      reshuffleCount += 1;
    }
    state = result.nextState;
  }

  const finalCorrupted = state.threatState?.corruptedCells.length ?? 0;
  return {
    seed,
    outcome: state.status === 'active' ? 'unfinished' : state.status,
    score: state.score,
    movesUsed: definition.moveLimit - state.movesRemaining,
    hungerAtFinish: state.threatState?.hungerCurrent ?? 0,
    spreadCount,
    corruptedCellsCreated: Math.max(0, finalCorrupted + corruptedCellsCleansed - initialCorrupted),
    corruptedCellsCleansed,
    threatFailure: state.status === 'failed' && state.threatState?.status === 'overwhelmed',
    reshuffleCount,
  };
}

export function runRiftErosionLabProbeMatrix(
  seeds: readonly number[] = RIFT_EROSION_LAB_PROBE_SEEDS,
): RiftErosionLabProbeRun[] {
  return seeds.map((seed) => runRiftErosionLabProbeForSeed(seed));
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function summarizeRiftErosionLabProbe(runs: readonly RiftErosionLabProbeRun[]) {
  const wins = runs.filter((run) => run.outcome === 'won').length;
  const failures = runs.filter((run) => run.outcome === 'failed').length;
  const unfinished = runs.filter((run) => run.outcome === 'unfinished').length;
  return {
    seedCount: runs.length,
    wins,
    failures,
    unfinished,
    winRate: wins / runs.length,
    medianScore: median(runs.map((run) => run.score)),
    medianHunger: median(runs.map((run) => run.hungerAtFinish)),
    medianCleanses: median(runs.map((run) => run.corruptedCellsCleansed)),
    threatFailures: runs.filter((run) => run.threatFailure).length,
    totalReshuffles: runs.reduce((sum, run) => sum + run.reshuffleCount, 0),
  };
}
