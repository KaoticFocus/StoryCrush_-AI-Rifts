import { type AcceptedLevelMoveResult } from '../level/levelTypes';
import { type LevelSessionState } from '../level/levelTypes';

export interface PlaytestMetricsSnapshot {
  levelId: string;
  seed: number;
  outcome: 'active' | 'won' | 'failed';
  finalScore: number;
  movesUsed: number;
  movesRemaining: number;
  maximumHungerReached: number;
  finalHunger: number;
  spreads: number;
  uniqueCleanses: number;
  adjacentCleanses: number;
  lineCleanses: number;
  crossCleanses: number;
  wildcardCleanses: number;
  specialActivations: number;
  cascades: number;
  reshuffles: number;
  nearOverwhelmReached: boolean;
}

export interface PlaytestMetricsAccumulator {
  reset(input: { levelId: string; seed: number; moveLimit: number; hungerMaximum: number }): void;
  recordAccepted(result: AcceptedLevelMoveResult): void;
  finalize(state: LevelSessionState): PlaytestMetricsSnapshot;
  getSnapshot(): PlaytestMetricsSnapshot;
  formatPlainTextSummary(): string;
  cloneSnapshot(): PlaytestMetricsSnapshot;
}

function emptySnapshot(levelId: string, seed: number): PlaytestMetricsSnapshot {
  return {
    levelId,
    seed,
    outcome: 'active',
    finalScore: 0,
    movesUsed: 0,
    movesRemaining: 0,
    maximumHungerReached: 0,
    finalHunger: 0,
    spreads: 0,
    uniqueCleanses: 0,
    adjacentCleanses: 0,
    lineCleanses: 0,
    crossCleanses: 0,
    wildcardCleanses: 0,
    specialActivations: 0,
    cascades: 0,
    reshuffles: 0,
    nearOverwhelmReached: false,
  };
}

export function createPlaytestMetricsAccumulator(): PlaytestMetricsAccumulator {
  let moveLimit = 0;
  let hungerMaximum = 0;
  let snapshot = emptySnapshot('', 0);

  return {
    reset(input) {
      moveLimit = input.moveLimit;
      hungerMaximum = input.hungerMaximum;
      snapshot = emptySnapshot(input.levelId, input.seed);
      snapshot.movesRemaining = input.moveLimit;
    },
    recordAccepted(result) {
      snapshot.finalScore = result.scoreAfter;
      snapshot.movesUsed += 1;
      snapshot.movesRemaining = result.movesAfter;
      snapshot.spreads += result.threatTransition?.spreadEvent ? 1 : 0;
      const cleanses = result.threatTransition?.cleanseEvents ?? [];
      snapshot.uniqueCleanses += cleanses.length;
      for (const event of cleanses) {
        if (event.causes.includes('adjacent-match')) snapshot.adjacentCleanses += 1;
        if (event.causes.includes('line-clear')) snapshot.lineCleanses += 1;
        if (event.causes.includes('cross-clear')) snapshot.crossCleanses += 1;
        if (event.causes.includes('wildcard')) snapshot.wildcardCleanses += 1;
      }
      snapshot.specialActivations += result.resolution.steps.reduce(
        (sum, step) => sum + step.activationEvents.length,
        0,
      );
      snapshot.cascades += Math.max(0, result.resolution.steps.length - 1);
      if (result.reshuffle) snapshot.reshuffles += 1;
      const hunger = result.nextState.threatState?.hungerCurrent ?? 0;
      snapshot.finalHunger = hunger;
      snapshot.maximumHungerReached = Math.max(snapshot.maximumHungerReached, hunger);
      if (result.nextState.status === 'active' && hunger === hungerMaximum - 1) {
        snapshot.nearOverwhelmReached = true;
      }
      if (result.nextState.status !== 'active') {
        snapshot.outcome = result.nextState.status;
      }
    },
    finalize(state) {
      snapshot.finalScore = state.score;
      snapshot.movesRemaining = state.movesRemaining;
      snapshot.movesUsed = moveLimit - state.movesRemaining;
      snapshot.finalHunger = state.threatState?.hungerCurrent ?? 0;
      snapshot.maximumHungerReached = Math.max(snapshot.maximumHungerReached, snapshot.finalHunger);
      snapshot.outcome = state.status === 'active' ? 'active' : state.status;
      return this.cloneSnapshot();
    },
    getSnapshot() {
      return this.cloneSnapshot();
    },
    cloneSnapshot() {
      return { ...snapshot };
    },
    formatPlainTextSummary() {
      const near = snapshot.nearOverwhelmReached ? 'yes' : 'no';
      return [
        'RH-3 Playtest Summary',
        `Level: ${snapshot.levelId}`,
        `Seed: ${snapshot.seed}`,
        `Outcome: ${snapshot.outcome}`,
        `Score: ${snapshot.finalScore}`,
        `Moves used: ${snapshot.movesUsed}`,
        `Maximum hunger: ${snapshot.maximumHungerReached}`,
        `Final hunger: ${snapshot.finalHunger}`,
        `Spreads: ${snapshot.spreads}`,
        `Cleanses: ${snapshot.uniqueCleanses}`,
        `Adjacent / Line / Cross / Wildcard: ${snapshot.adjacentCleanses} / ${snapshot.lineCleanses} / ${snapshot.crossCleanses} / ${snapshot.wildcardCleanses}`,
        `Special activations: ${snapshot.specialActivations}`,
        `Cascades: ${snapshot.cascades}`,
        `Reshuffles: ${snapshot.reshuffles}`,
        `Near-overwhelm: ${near}`,
      ].join('\n');
    },
  };
}
