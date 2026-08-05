import { generateBoard, validateBoardDimensions } from '../board';
import { BoardDomainError } from '../board/errors';
import { createLevelSession, DEFAULT_SCORING_RULES, type CreateLevelSessionResult } from '../level';
import { validateLevelDefinition } from '../level/levelValidation';
import { type LevelDefinition, type LevelSessionState } from '../level/levelTypes';
import { type PieceType } from '../board/boardTypes';

export type PlayableExperienceKind = 'calm' | 'rift-pressure' | 'rift-erosion-lab';

export interface PlayableLevelContent {
  id: string;
  title: string;
  subtitle: string;
  experienceKind: PlayableExperienceKind;
  universeId: 'fantasy';
  chapterId: string;
  definition: LevelDefinition;
  boardRows: number;
  boardColumns: number;
  allowedPieceTypes: readonly PieceType[];
}

export interface SeedProvider {
  nextSeed(): number;
}

export interface CreateGeneratedLevelSessionInput {
  content: PlayableLevelContent;
  seed?: number;
  seedProvider?: SeedProvider;
}

export function createPlayableLevelContent(input: {
  definition: LevelDefinition;
  title: string;
  subtitle: string;
  experienceKind?: PlayableLevelContent['experienceKind'];
  boardRows?: number;
  boardColumns?: number;
}): PlayableLevelContent {
  const validDefinition = validateLevelDefinition(input.definition);
  const dimensions = validateBoardDimensions({
    rows: input.boardRows ?? 8,
    columns: input.boardColumns ?? 8,
  });
  return {
    id: validDefinition.id,
    title: input.title,
    subtitle: input.subtitle,
    experienceKind: input.experienceKind ?? 'calm',
    universeId: 'fantasy',
    chapterId: 'fantasy-chapter',
    definition: validDefinition,
    boardRows: dimensions.rows,
    boardColumns: dimensions.columns,
    allowedPieceTypes: [...validDefinition.allowedRefillPieceTypes],
  };
}

export function validatePlayableLevelCatalog(
  catalog: readonly PlayableLevelContent[],
): readonly PlayableLevelContent[] {
  const ids = new Set<string>();
  for (const content of catalog) {
    if (ids.has(content.id)) {
      throw new BoardDomainError('invalid-level-definition', `duplicate level id ${content.id}`);
    }
    ids.add(content.id);
  }
  return catalog;
}

export function isThreatLevel(content: PlayableLevelContent): boolean {
  return content.definition.threat !== undefined;
}

export function getThreatSummary(content: PlayableLevelContent): string | null {
  const threat = content.definition.threat;
  if (!threat || threat.kind !== 'rift-hunger') {
    return null;
  }
  return `Rift every ${threat.spreadInterval} moves · Hunger ${threat.hungerMaximum}`;
}

export function getExperienceLabel(content: PlayableLevelContent): string | null {
  if (content.experienceKind === 'rift-pressure') {
    return 'Fantasy Pressure';
  }
  if (content.experienceKind === 'rift-erosion-lab') {
    return 'Experimental Rift Hunger';
  }
  return null;
}

export const playableLevelCatalog: readonly PlayableLevelContent[] = validatePlayableLevelCatalog([
  createPlayableLevelContent({
    definition: {
      id: 'archive-stabilization',
      moveLimit: 15,
      allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 2500 },
        { id: 'collect-ruby', kind: 'collect-piece', pieceType: 'ruby', targetCount: 10 },
      ],
      scoring: DEFAULT_SCORING_RULES,
      seed: 1807,
    },
    title: 'Archive Stabilization',
    subtitle: 'Restore the archive with a balanced mix of gems.',
  }),
  createPlayableLevelContent({
    definition: {
      id: 'moonwell-recovery',
      moveLimit: 12,
      allowedRefillPieceTypes: ['sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 3500 },
        { id: 'collect-sapphire', kind: 'collect-piece', pieceType: 'sapphire', targetCount: 8 },
      ],
      scoring: DEFAULT_SCORING_RULES,
      seed: 1808,
    },
    title: 'Moonwell Recovery',
    subtitle: 'Recover the moonwell with a tighter, more focused board.',
  }),
  createPlayableLevelContent({
    definition: {
      id: 'thornwake-containment',
      moveLimit: 18,
      allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 3000 },
        { id: 'collect-topaz', kind: 'collect-piece', pieceType: 'topaz', targetCount: 9 },
      ],
      scoring: DEFAULT_SCORING_RULES,
      seed: 1831,
      threat: {
        kind: 'rift-hunger',
        sourceCells: [{ row: 7, column: 3 }],
        spreadInterval: 3,
        hungerMaximum: 5,
        spreadPriority: 'orthogonal-stable-coordinate',
      },
    },
    title: 'Thornwake Containment',
    subtitle: 'Contain the hungry thorns before the Rift chokes the grove.',
    experienceKind: 'rift-pressure',
    boardRows: 8,
    boardColumns: 8,
  }),
  createPlayableLevelContent({
    definition: {
      id: 'rootbound-seal',
      moveLimit: 10,
      allowedRefillPieceTypes: ['ruby', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 5000 },
        { id: 'collect-emerald', kind: 'collect-piece', pieceType: 'emerald', targetCount: 9 },
      ],
      scoring: DEFAULT_SCORING_RULES,
      seed: 1809,
    },
    title: 'Rootbound Seal',
    subtitle: 'Break the seal with a compact, demanding board.',
  }),
  createPlayableLevelContent({
    definition: {
      id: 'rift-erosion-lab',
      moveLimit: 15,
      allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 2200 },
        { id: 'collect-amethyst', kind: 'collect-piece', pieceType: 'amethyst', targetCount: 8 },
      ],
      scoring: DEFAULT_SCORING_RULES,
      seed: 1810,
      threat: {
        kind: 'rift-hunger',
        sourceCells: [{ row: 0, column: 0 }],
        spreadInterval: 3,
        hungerMaximum: 5,
        spreadPriority: 'orthogonal-stable-coordinate',
      },
    },
    title: 'Rift Erosion Lab',
    subtitle:
      'Experimental Rift Hunger. Match beside corrupted cells to cleanse them. Spread every 3 accepted moves.',
    experienceKind: 'rift-erosion-lab',
    boardRows: 8,
    boardColumns: 8,
  }),
]);

export function getPlayableLevelIds(): string[] {
  return playableLevelCatalog.map((content) => content.id);
}

export function getObjectiveSummary(content: PlayableLevelContent): string {
  return content.definition.objectives
    .map((objective) =>
      objective.kind === 'score'
        ? `Score ${objective.targetScore}`
        : `Collect ${objective.targetCount} ${objective.pieceType}`,
    )
    .join(' · ');
}

/** Compact one-line summary for dense Puzzle Lab cards. */
export function getCompactObjectiveSummary(content: PlayableLevelContent): string {
  return content.definition.objectives
    .map((objective) =>
      objective.kind === 'score'
        ? `${objective.targetScore} pts`
        : `${objective.targetCount} ${objective.pieceType}`,
    )
    .join(' · ');
}

export function getPlayableLevelContent(
  levelId: string | null | undefined,
): PlayableLevelContent | null {
  if (!levelId) {
    return null;
  }
  return playableLevelCatalog.find((content) => content.id === levelId) ?? null;
}

function createGeneratedBoard(
  content: PlayableLevelContent,
  seed: number,
): ReturnType<typeof generateBoard> {
  return generateBoard({
    rows: content.boardRows,
    columns: content.boardColumns,
    pieceTypes: content.allowedPieceTypes,
    seed,
  });
}

export function createGeneratedLevelSession(
  input: CreateGeneratedLevelSessionInput,
): CreateLevelSessionResult {
  const seed = input.seed ?? input.seedProvider?.nextSeed();
  if (seed === undefined || !Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('A non-negative safe integer seed is required to generate a level run.');
  }
  const board = createGeneratedBoard(input.content, seed);
  return createLevelSession({
    definition: { ...input.content.definition, seed },
    initialBoard: board,
  });
}

export function createLevelRunState(
  content: PlayableLevelContent,
  seed: number,
): LevelSessionState {
  return createGeneratedLevelSession({ content, seed }).state;
}
