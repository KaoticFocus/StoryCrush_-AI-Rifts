import { BoardDomainError } from '../../board';
import { type EffectIntensity, type PlaybackMode } from './playbackTypes';
import { type SpecialEffectKind } from './specialEffectPlanning';

export interface PlaybackDurations {
  swap: number;
  rejectedSwapHalf: number;
  matchHighlight: number;
  specialActivationPulse: number;
  specialActivationPause: number;
  lineClearBeamBase: number;
  lineClearBeamPerCell: number;
  areaShockwave: number;
  wildcardMark: number;
  wildcardFullBoardWave: number;
  chainTriggerPulse: number;
  removal: number;
  specialCreation: number;
  gravityBase: number;
  gravityPerRow: number;
  gravityMax: number;
  refillBase: number;
  refillPerRow: number;
  refillMax: number;
  reshuffleMoveBase: number;
  reshuffleMovePerCell: number;
  reshuffleMoveMax: number;
  scoreCountBase: number;
  scoreCountPerEvent: number;
  scoreCountMax: number;
  scoreLabel: number;
  collectionFeedback: number;
  objectiveComplete: number;
  cascadeLabel: number;
  cascadePause: number;
  summaryVisible: number;
}

export interface PlaybackTimingSettings {
  mode: PlaybackMode;
  reducedMotion: boolean;
}

const NORMAL_DURATIONS: PlaybackDurations = {
  swap: 180,
  rejectedSwapHalf: 90,
  matchHighlight: 120,
  specialActivationPulse: 110,
  specialActivationPause: 40,
  lineClearBeamBase: 120,
  lineClearBeamPerCell: 35,
  areaShockwave: 160,
  wildcardMark: 180,
  wildcardFullBoardWave: 220,
  chainTriggerPulse: 70,
  removal: 180,
  specialCreation: 140,
  gravityBase: 100,
  gravityPerRow: 45,
  gravityMax: 320,
  refillBase: 110,
  refillPerRow: 40,
  refillMax: 300,
  reshuffleMoveBase: 160,
  reshuffleMovePerCell: 28,
  reshuffleMoveMax: 360,
  scoreCountBase: 110,
  scoreCountPerEvent: 40,
  scoreCountMax: 260,
  scoreLabel: 650,
  collectionFeedback: 180,
  objectiveComplete: 320,
  cascadeLabel: 140,
  cascadePause: 100,
  summaryVisible: 1800,
};

function scaleDurations(durations: PlaybackDurations, factor: number): PlaybackDurations {
  return {
    swap: Math.max(0, Math.round(durations.swap * factor)),
    rejectedSwapHalf: Math.max(0, Math.round(durations.rejectedSwapHalf * factor)),
    matchHighlight: Math.max(0, Math.round(durations.matchHighlight * factor)),
    specialActivationPulse: Math.max(0, Math.round(durations.specialActivationPulse * factor)),
    specialActivationPause: Math.max(0, Math.round(durations.specialActivationPause * factor)),
    lineClearBeamBase: Math.max(0, Math.round(durations.lineClearBeamBase * factor)),
    lineClearBeamPerCell: Math.max(0, Math.round(durations.lineClearBeamPerCell * factor)),
    areaShockwave: Math.max(0, Math.round(durations.areaShockwave * factor)),
    wildcardMark: Math.max(0, Math.round(durations.wildcardMark * factor)),
    wildcardFullBoardWave: Math.max(0, Math.round(durations.wildcardFullBoardWave * factor)),
    chainTriggerPulse: Math.max(0, Math.round(durations.chainTriggerPulse * factor)),
    removal: Math.max(0, Math.round(durations.removal * factor)),
    specialCreation: Math.max(0, Math.round(durations.specialCreation * factor)),
    gravityBase: Math.max(0, Math.round(durations.gravityBase * factor)),
    gravityPerRow: Math.max(0, Math.round(durations.gravityPerRow * factor)),
    gravityMax: Math.max(0, Math.round(durations.gravityMax * factor)),
    refillBase: Math.max(0, Math.round(durations.refillBase * factor)),
    refillPerRow: Math.max(0, Math.round(durations.refillPerRow * factor)),
    refillMax: Math.max(0, Math.round(durations.refillMax * factor)),
    reshuffleMoveBase: Math.max(0, Math.round(durations.reshuffleMoveBase * factor)),
    reshuffleMovePerCell: Math.max(0, Math.round(durations.reshuffleMovePerCell * factor)),
    reshuffleMoveMax: Math.max(0, Math.round(durations.reshuffleMoveMax * factor)),
    scoreCountBase: Math.max(0, Math.round(durations.scoreCountBase * factor)),
    scoreCountPerEvent: Math.max(0, Math.round(durations.scoreCountPerEvent * factor)),
    scoreCountMax: Math.max(0, Math.round(durations.scoreCountMax * factor)),
    scoreLabel: Math.max(0, Math.round(durations.scoreLabel * factor)),
    collectionFeedback: Math.max(0, Math.round(durations.collectionFeedback * factor)),
    objectiveComplete: Math.max(0, Math.round(durations.objectiveComplete * factor)),
    cascadeLabel: Math.max(0, Math.round(durations.cascadeLabel * factor)),
    cascadePause: Math.max(0, Math.round(durations.cascadePause * factor)),
    summaryVisible: Math.max(0, Math.round(durations.summaryVisible * factor)),
  };
}

function applyReducedMotion(durations: PlaybackDurations): PlaybackDurations {
  return {
    ...durations,
    swap: Math.min(durations.swap, 90),
    rejectedSwapHalf: Math.min(durations.rejectedSwapHalf, 70),
    matchHighlight: Math.min(durations.matchHighlight, 70),
    specialActivationPulse: Math.min(durations.specialActivationPulse, 80),
    specialActivationPause: Math.min(durations.specialActivationPause, 20),
    lineClearBeamBase: 0,
    lineClearBeamPerCell: 0,
    areaShockwave: 0,
    wildcardMark: Math.min(durations.wildcardMark, 90),
    wildcardFullBoardWave: Math.min(durations.wildcardFullBoardWave, 100),
    chainTriggerPulse: Math.min(durations.chainTriggerPulse, 45),
    removal: Math.min(durations.removal, 90),
    specialCreation: Math.min(durations.specialCreation, 90),
    reshuffleMoveBase: Math.min(durations.reshuffleMoveBase, 110),
    reshuffleMovePerCell: Math.min(durations.reshuffleMovePerCell, 12),
    reshuffleMoveMax: Math.min(durations.reshuffleMoveMax, 180),
    scoreCountBase: Math.min(durations.scoreCountBase, 90),
    scoreCountPerEvent: Math.min(durations.scoreCountPerEvent, 25),
    scoreCountMax: Math.min(durations.scoreCountMax, 140),
    scoreLabel: Math.min(durations.scoreLabel, 320),
    collectionFeedback: Math.min(durations.collectionFeedback, 120),
    objectiveComplete: Math.min(durations.objectiveComplete, 180),
    cascadeLabel: Math.min(durations.cascadeLabel, 80),
    cascadePause: 0,
  };
}

export function getPlaybackDurations(settings: PlaybackTimingSettings): PlaybackDurations {
  if (settings.mode === 'instant') {
    return scaleDurations(NORMAL_DURATIONS, 0);
  }

  if (settings.mode !== 'normal' && settings.mode !== 'fast') {
    throw new BoardDomainError(
      'invalid-level-state',
      `unsupported playback mode: ${settings.mode}`,
    );
  }

  const scaled =
    settings.mode === 'fast' ? scaleDurations(NORMAL_DURATIONS, 0.5) : NORMAL_DURATIONS;
  return settings.reducedMotion ? applyReducedMotion(scaled) : scaled;
}

export function getGravityDuration(distance: number, settings: PlaybackTimingSettings): number {
  const durations = getPlaybackDurations(settings);
  return Math.min(
    durations.gravityMax,
    Math.max(0, durations.gravityBase + distance * durations.gravityPerRow),
  );
}

export function getRefillDuration(distance: number, settings: PlaybackTimingSettings): number {
  const durations = getPlaybackDurations(settings);
  return Math.min(
    durations.refillMax,
    Math.max(0, durations.refillBase + distance * durations.refillPerRow),
  );
}

export function getReshuffleDuration(distance: number, settings: PlaybackTimingSettings): number {
  const durations = getPlaybackDurations(settings);
  return Math.min(
    durations.reshuffleMoveMax,
    Math.max(0, durations.reshuffleMoveBase + distance * durations.reshuffleMovePerCell),
  );
}

export function getScoreCountDuration(
  eventCount: number,
  settings: PlaybackTimingSettings,
): number {
  const durations = getPlaybackDurations(settings);
  return Math.min(
    durations.scoreCountMax,
    Math.max(
      0,
      durations.scoreCountBase + Math.max(0, eventCount - 1) * durations.scoreCountPerEvent,
    ),
  );
}

export function getSpecialEffectDuration(input: {
  kind: SpecialEffectKind;
  affectedCount: number;
  activationIndex: number;
  settings: PlaybackTimingSettings;
}): number {
  const durations = getPlaybackDurations(input.settings);
  const activationScale =
    input.activationIndex <= 3 ? 1 : Math.max(0.55, 1 - (input.activationIndex - 3) * 0.12);
  const baseDuration =
    input.kind === 'line-clear-horizontal' || input.kind === 'line-clear-vertical'
      ? durations.lineClearBeamBase +
        Math.max(0, input.affectedCount - 1) * durations.lineClearBeamPerCell
      : input.kind === 'area-clear'
        ? durations.areaShockwave
        : input.kind === 'wildcard-full-board'
          ? durations.wildcardFullBoardWave
          : durations.wildcardMark;

  return Math.max(0, Math.round(baseDuration * activationScale));
}

export function getEffectIntensity(settings: PlaybackTimingSettings): EffectIntensity {
  return settings.reducedMotion ? 'reduced' : 'standard';
}
