import {
  Board,
  createCrossClearPiece,
  createLineClearPiece,
  createWildcardPiece,
  type BoardPiece,
  type PieceType,
} from '../board';
import {
  DEFAULT_SCORING_RULES,
  createLevelSession,
  type CreateLevelSessionResult,
  type LevelDefinition,
} from '../level';

const prototypeGrid: BoardPiece[][] = [
  [
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
  ],
  [
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'emerald' },
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    createLineClearPiece('emerald', 'vertical'),
  ],
  [
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'emerald' },
    { kind: 'standard', pieceType: 'topaz' },
  ],
  [
    createLineClearPiece('topaz', 'vertical'),
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'emerald' },
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'amethyst' },
  ],
  [
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    createWildcardPiece('emerald'),
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
  ],
  [
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'emerald' },
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
  ],
  [
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'emerald' },
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    createLineClearPiece('ruby', 'horizontal'),
    createCrossClearPiece('sapphire'),
  ],
  [
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'emerald' },
    { kind: 'standard', pieceType: 'topaz' },
    { kind: 'standard', pieceType: 'amethyst' },
    { kind: 'standard', pieceType: 'pearl' },
    { kind: 'standard', pieceType: 'ruby' },
    { kind: 'standard', pieceType: 'sapphire' },
    { kind: 'standard', pieceType: 'emerald' },
  ],
];

export const prototypeLevelDefinition: LevelDefinition = {
  id: 'prototype-puzzle',
  moveLimit: 15,
  allowedRefillPieceTypes: [
    'ruby',
    'sapphire',
    'emerald',
    'topaz',
    'amethyst',
    'pearl',
  ] satisfies readonly PieceType[],
  objectives: [
    { id: 'score-target', kind: 'score', targetScore: 600 },
    { id: 'collect-ruby', kind: 'collect-piece', pieceType: 'ruby', targetCount: 10 },
  ],
  scoring: DEFAULT_SCORING_RULES,
  seed: 1807,
};

export function createPrototypeBoard(): Board {
  return Board.fromGrid(prototypeGrid);
}

export function createPrototypeLevelSession(): CreateLevelSessionResult {
  return createLevelSession({
    definition: prototypeLevelDefinition,
    initialBoard: createPrototypeBoard(),
  });
}
