import { getPlayableLevelContent } from './levelCatalog';

export interface LevelRunDescriptor {
  levelId: string;
  seed: number;
}

export type PuzzleLaunchContext =
  | { mode: 'campaign'; run: LevelRunDescriptor }
  | { mode: 'puzzle-lab'; run: LevelRunDescriptor; playtest?: boolean }
  | { mode: 'browser-fixture'; fixtureId: string };

export function isPuzzleLaunchContext(value: unknown): value is PuzzleLaunchContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<PuzzleLaunchContext> & {
    run?: unknown;
    fixtureId?: unknown;
  };
  if (candidate.mode === 'browser-fixture') {
    return typeof candidate.fixtureId === 'string' && candidate.fixtureId.length > 0;
  }
  if (candidate.mode === 'campaign') {
    return isValidLevelRunDescriptor(candidate.run);
  }
  if (candidate.mode === 'puzzle-lab') {
    if (!isValidLevelRunDescriptor(candidate.run)) {
      return false;
    }
    return candidate.playtest === undefined || candidate.playtest === true;
  }
  return false;
}

export function isValidLevelRunDescriptor(value: unknown): value is LevelRunDescriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<LevelRunDescriptor>;
  return (
    typeof candidate.levelId === 'string' &&
    getPlayableLevelContent(candidate.levelId) !== null &&
    typeof candidate.seed === 'number' &&
    Number.isSafeInteger(candidate.seed) &&
    candidate.seed >= 0
  );
}
