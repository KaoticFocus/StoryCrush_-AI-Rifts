import { type BoardPiece, type MatchOrientation, type PieceType } from '../board';

export interface PieceAppearance {
  label: string;
  fillColor: number;
  strokeColor: number;
  symbolColor: number;
  shape: 'circle' | 'rounded-square' | 'hexagon' | 'diamond' | 'triangle';
  symbol: 'flame' | 'wave' | 'leaf' | 'sun' | 'spiral' | 'ring';
  overlay:
    | { kind: 'none' }
    | { kind: 'line-clear'; orientation: MatchOrientation }
    | { kind: 'area-clear' }
    | { kind: 'wildcard' };
}

const pieceTypeLabels: Record<PieceType, string> = {
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
  topaz: 'Topaz',
  amethyst: 'Amethyst',
  pearl: 'Pearl',
};

const standardAppearances: Record<PieceType, Omit<PieceAppearance, 'label' | 'overlay'>> = {
  ruby: {
    fillColor: 0xe65151,
    strokeColor: 0x4a1010,
    symbolColor: 0xffe3b3,
    shape: 'circle',
    symbol: 'flame',
  },
  sapphire: {
    fillColor: 0x3c78d8,
    strokeColor: 0x10274a,
    symbolColor: 0xe0f2fe,
    shape: 'rounded-square',
    symbol: 'wave',
  },
  emerald: {
    fillColor: 0x2ea95c,
    strokeColor: 0x133620,
    symbolColor: 0xe4ffe7,
    shape: 'hexagon',
    symbol: 'leaf',
  },
  topaz: {
    fillColor: 0xf3b54a,
    strokeColor: 0x4e3510,
    symbolColor: 0xfff5cf,
    shape: 'diamond',
    symbol: 'sun',
  },
  amethyst: {
    fillColor: 0x8f5fd5,
    strokeColor: 0x2d1b4f,
    symbolColor: 0xf6e8ff,
    shape: 'triangle',
    symbol: 'spiral',
  },
  pearl: {
    fillColor: 0xe6e8ef,
    strokeColor: 0x4f5565,
    symbolColor: 0x667085,
    shape: 'circle',
    symbol: 'ring',
  },
};

export function getPieceTypeLabel(pieceType: PieceType): string {
  return pieceTypeLabels[pieceType];
}

export function getPieceAppearance(piece: BoardPiece): PieceAppearance {
  const standardAppearance = standardAppearances[piece.pieceType];

  if (piece.kind === 'line-clear') {
    return {
      ...standardAppearance,
      label: `${pieceTypeLabels[piece.pieceType]} line clear`,
      overlay: { kind: 'line-clear', orientation: piece.orientation },
    };
  }

  if (piece.kind === 'area-clear') {
    return {
      ...standardAppearance,
      label: `${pieceTypeLabels[piece.pieceType]} area clear`,
      overlay: { kind: 'area-clear' },
    };
  }

  if (piece.kind === 'wildcard') {
    return {
      ...standardAppearance,
      label: `${pieceTypeLabels[piece.pieceType]} wildcard`,
      overlay: { kind: 'wildcard' },
    };
  }

  return {
    ...standardAppearance,
    label: pieceTypeLabels[piece.pieceType],
    overlay: { kind: 'none' },
  };
}
