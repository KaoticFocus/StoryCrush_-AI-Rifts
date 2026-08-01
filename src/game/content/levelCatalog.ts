import { generateBoard, validateBoardDimensions } from '../board';
import { BoardDomainError } from '../board/errors';
import { createLevelSession, DEFAULT_SCORING_RULES, type CreateLevelSessionResult } from '../level';
import { validateLevelDefinition } from '../level/levelValidation';
import { type LevelDefinition, type LevelSessionState } from '../level/levelTypes';
import { type PieceType } from '../board/boardTypes';

export interface PlayableLevelContent {
  id: string;
  title: string;
  subtitle: string;
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

export const playableLevelCatalog: readonly PlayableLevelContent[] = validatePlayableLevelCatalog([
  createPlayableLevelContent({
    definition: {
      id: 'archive-stabilization',
      moveLimit: 15,
      allowedRefillPieceTypes: ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 600 },
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
        { id: 'score-target', kind: 'score', targetScore: 700 },
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
      id: 'rootbound-seal',
      moveLimit: 10,
      allowedRefillPieceTypes: ['ruby', 'emerald', 'topaz', 'amethyst', 'pearl'],
      objectives: [
        { id: 'score-target', kind: 'score', targetScore: 900 },
        { id: 'collect-emerald', kind: 'collect-piece', pieceType: 'emerald', targetCount: 9 },
      ],
      scoring: DEFAULT_SCORING_RULES,
      seed: 1809,
    },
    title: 'Rootbound Seal',
    subtitle: 'Break the seal with a compact, demanding board.',
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
