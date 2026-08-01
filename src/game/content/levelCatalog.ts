import { generateBoard } from '../board';
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

export function createDefaultSeedProvider(): SeedProvider {
  return {
    nextSeed() {
      if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        return values[0] % 1_000_000_000;
      }
      return Math.floor(Math.random() * 1_000_000_000);
    },
  };
}

function createLevelContent(definition: LevelDefinition, title: string, subtitle: string): PlayableLevelContent {
  const validDefinition = validateLevelDefinition(definition);
  return {
    id: validDefinition.id,
    title,
    subtitle,
    universeId: 'fantasy',
    chapterId: 'fantasy-chapter',
    definition: validDefinition,
    boardRows: 8,
    boardColumns: 8,
    allowedPieceTypes: [...validDefinition.allowedRefillPieceTypes],
  };
}

export const playableLevelCatalog: readonly PlayableLevelContent[] = [
  createLevelContent(
    {
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
    'Archive Stabilization',
    'Restore the archive with a balanced mix of gems.',
  ),
  createLevelContent(
    {
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
    'Moonwell Recovery',
    'Recover the moonwell with a tighter, more focused board.',
  ),
  createLevelContent(
    {
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
    'Rootbound Seal',
    'Break the seal with a compact, demanding board.',
  ),
];

export function getPlayableLevelIds(): string[] {
  return playableLevelCatalog.map((content) => content.id);
}

export function getPlayableLevelContent(levelId: string | null | undefined): PlayableLevelContent | null {
  if (!levelId) {
    return null;
  }
  return playableLevelCatalog.find((content) => content.id === levelId) ?? null;
}

function createGeneratedBoard(content: PlayableLevelContent, seed: number): ReturnType<typeof generateBoard> {
  return generateBoard({
    rows: content.boardRows,
    columns: content.boardColumns,
    pieceTypes: content.allowedPieceTypes,
    seed,
  });
}

export function createGeneratedLevelSession(input: CreateGeneratedLevelSessionInput): CreateLevelSessionResult {
  const seed = input.seed ?? input.seedProvider?.nextSeed() ?? 0;
  const board = createGeneratedBoard(input.content, seed);
  return createLevelSession({
    definition: input.content.definition,
    initialBoard: board,
  });
}

export function createLevelRunState(content: PlayableLevelContent, seed: number): LevelSessionState {
  return createGeneratedLevelSession({ content, seed }).state;
}
