import { type BoardPiece, type PieceType } from '../../board';

/**
 * FP-1 Fantasy board/piece presentation profile.
 * Presentation-only: never chooses cells, targets, scores, threat outcomes, or cascades.
 */
export const FANTASY_BOARD_THEME_ID = 'fantasy-board-v1' as const;

export type FantasyPieceVisualId =
  | 'fantasy-ruby-flame'
  | 'fantasy-sapphire-wave'
  | 'fantasy-emerald-leaf'
  | 'fantasy-topaz-sun'
  | 'fantasy-amethyst-crescent'
  | 'fantasy-pearl-moon';

export type FantasySpecialVisualId =
  | 'fantasy-special-line-horizontal'
  | 'fantasy-special-line-vertical'
  | 'fantasy-special-cross'
  | 'fantasy-special-type-target'
  | 'fantasy-special-none';

export type FantasyRiftVisualState =
  | 'fantasy-rift-source'
  | 'fantasy-rift-threatened'
  | 'fantasy-rift-corrupted'
  | 'fantasy-rift-none';

export type FantasyEffectProfileId =
  | 'fantasy-effect-spread'
  | 'fantasy-effect-cleanse'
  | 'fantasy-effect-spread-reduced'
  | 'fantasy-effect-cleanse-reduced'
  | 'fantasy-effect-hint'
  | 'fantasy-effect-hint-reduced'
  | 'fantasy-effect-reject'
  | 'fantasy-effect-reject-reduced';

export interface FantasyTextureKeySet {
  pieceByType: Record<PieceType, string>;
  specialLineHorizontal: string;
  specialCross: string;
  specialTypeTarget: string;
  overlaySelected: string;
  overlayHint: string;
  boardBackplate: string;
  boardCell: string;
  boardCorner: string;
  boardEdgeTop: string;
  boardEdgeBottom: string;
  boardEdgeSide: string;
  boardOrnamentGem: string;
  boardOrnamentCrest: string;
}

export interface FantasyPresentationProfile {
  themeId: typeof FANTASY_BOARD_THEME_ID;
  textureKeys: FantasyTextureKeySet;
  /** Public URL paths relative to site root (Vite `public/`). */
  textureUrls: Record<string, string>;
  pieceVisualIdByType: Record<PieceType, FantasyPieceVisualId>;
  /** Non-color silhouette/glyph identifiers for accessibility contracts. */
  pieceGlyphByType: Record<PieceType, string>;
  reducedMotionEffect: Record<
    'spread' | 'cleanse' | 'hint' | 'reject',
    { animated: FantasyEffectProfileId; reduced: FantasyEffectProfileId }
  >;
  rift: {
    source: FantasyRiftVisualState;
    threatened: FantasyRiftVisualState;
    corrupted: FantasyRiftVisualState;
  };
  fallbackThemeId: 'procedural-vector';
}

const PUBLIC_ROOT = '/assets/fantasy';

export const fantasyTextureKeys: FantasyTextureKeySet = {
  pieceByType: {
    ruby: 'fantasy:piece:ruby',
    sapphire: 'fantasy:piece:sapphire',
    emerald: 'fantasy:piece:emerald',
    topaz: 'fantasy:piece:topaz',
    amethyst: 'fantasy:piece:amethyst',
    pearl: 'fantasy:piece:pearl',
  },
  specialLineHorizontal: 'fantasy:special:line-horizontal',
  specialCross: 'fantasy:special:cross',
  specialTypeTarget: 'fantasy:special:type-target',
  overlaySelected: 'fantasy:overlay:selected',
  overlayHint: 'fantasy:overlay:hint',
  boardBackplate: 'fantasy:board:backplate',
  boardCell: 'fantasy:board:cell',
  boardCorner: 'fantasy:board:corner',
  boardEdgeTop: 'fantasy:board:edge-top',
  boardEdgeBottom: 'fantasy:board:edge-bottom',
  boardEdgeSide: 'fantasy:board:edge-side',
  boardOrnamentGem: 'fantasy:board:ornament-gem',
  boardOrnamentCrest: 'fantasy:board:ornament-crest',
};

function url(path: string): string {
  return `${PUBLIC_ROOT}/${path}`;
}

export const fantasyPresentationProfile: FantasyPresentationProfile = {
  themeId: FANTASY_BOARD_THEME_ID,
  textureKeys: fantasyTextureKeys,
  textureUrls: {
    [fantasyTextureKeys.pieceByType.ruby]: url('pieces/piece_fire_red.png'),
    [fantasyTextureKeys.pieceByType.sapphire]: url('pieces/piece_water_blue.png'),
    [fantasyTextureKeys.pieceByType.emerald]: url('pieces/piece_leaf_green.png'),
    [fantasyTextureKeys.pieceByType.topaz]: url('pieces/piece_sun_gold.png'),
    [fantasyTextureKeys.pieceByType.amethyst]: url('pieces/piece_moon_triangle_purple.png'),
    [fantasyTextureKeys.pieceByType.pearl]: url('pieces/piece_moon_silver.png'),
    [fantasyTextureKeys.specialLineHorizontal]: url('specials/special_fire_horizontal.png'),
    [fantasyTextureKeys.specialCross]: url('specials/special_starburst_green.png'),
    [fantasyTextureKeys.specialTypeTarget]: url('specials/special_vortex_blue.png'),
    [fantasyTextureKeys.overlaySelected]: url('specials/overlay_piece_selected.png'),
    [fantasyTextureKeys.overlayHint]: url('specials/overlay_valid_move.png'),
    [fantasyTextureKeys.boardBackplate]: url('board/board_backplate.png'),
    [fantasyTextureKeys.boardCell]: url('board/board_cell_empty.png'),
    [fantasyTextureKeys.boardCorner]: url('board/board_corner.png'),
    [fantasyTextureKeys.boardEdgeTop]: url('board/board_edge_top.png'),
    [fantasyTextureKeys.boardEdgeBottom]: url('board/board_edge_bottom.png'),
    [fantasyTextureKeys.boardEdgeSide]: url('board/board_edge_side.png'),
    [fantasyTextureKeys.boardOrnamentGem]: url('board/board_ornament_side_gem.png'),
    [fantasyTextureKeys.boardOrnamentCrest]: url('board/board_ornament_top_crest.png'),
  },
  pieceVisualIdByType: {
    ruby: 'fantasy-ruby-flame',
    sapphire: 'fantasy-sapphire-wave',
    emerald: 'fantasy-emerald-leaf',
    topaz: 'fantasy-topaz-sun',
    amethyst: 'fantasy-amethyst-crescent',
    pearl: 'fantasy-pearl-moon',
  },
  pieceGlyphByType: {
    ruby: 'flame-point',
    sapphire: 'wave-disc',
    emerald: 'leaf-hex',
    topaz: 'sun-burst',
    amethyst: 'crescent-triangle',
    pearl: 'double-crescent',
  },
  reducedMotionEffect: {
    spread: {
      animated: 'fantasy-effect-spread',
      reduced: 'fantasy-effect-spread-reduced',
    },
    cleanse: {
      animated: 'fantasy-effect-cleanse',
      reduced: 'fantasy-effect-cleanse-reduced',
    },
    hint: {
      animated: 'fantasy-effect-hint',
      reduced: 'fantasy-effect-hint-reduced',
    },
    reject: {
      animated: 'fantasy-effect-reject',
      reduced: 'fantasy-effect-reject-reduced',
    },
  },
  rift: {
    source: 'fantasy-rift-source',
    threatened: 'fantasy-rift-threatened',
    corrupted: 'fantasy-rift-corrupted',
  },
  fallbackThemeId: 'procedural-vector',
};

export function getFantasyPieceVisualId(pieceType: PieceType): FantasyPieceVisualId {
  return fantasyPresentationProfile.pieceVisualIdByType[pieceType];
}

export function getFantasySpecialVisualId(piece: BoardPiece): FantasySpecialVisualId {
  if (piece.kind === 'line-clear') {
    return piece.orientation === 'horizontal'
      ? 'fantasy-special-line-horizontal'
      : 'fantasy-special-line-vertical';
  }
  if (piece.kind === 'cross-clear') {
    return 'fantasy-special-cross';
  }
  if (piece.kind === 'wildcard') {
    return 'fantasy-special-type-target';
  }
  return 'fantasy-special-none';
}

export function getFantasyPieceTextureKey(pieceType: PieceType): string {
  return fantasyPresentationProfile.textureKeys.pieceByType[pieceType];
}

export function getFantasySpecialTextureKey(piece: BoardPiece): string | null {
  if (piece.kind === 'line-clear') {
    return fantasyPresentationProfile.textureKeys.specialLineHorizontal;
  }
  if (piece.kind === 'cross-clear') {
    return fantasyPresentationProfile.textureKeys.specialCross;
  }
  if (piece.kind === 'wildcard') {
    return fantasyPresentationProfile.textureKeys.specialTypeTarget;
  }
  return null;
}

export function resolveFantasyEffectProfile(
  kind: 'spread' | 'cleanse' | 'hint' | 'reject',
  reducedMotion: boolean,
): FantasyEffectProfileId {
  const pair = fantasyPresentationProfile.reducedMotionEffect[kind];
  return reducedMotion ? pair.reduced : pair.animated;
}

export function getFantasyRiftVisualState(input: {
  isSource: boolean;
  isThreatened: boolean;
  isCorrupted: boolean;
}): FantasyRiftVisualState {
  if (input.isSource) return fantasyPresentationProfile.rift.source;
  if (input.isThreatened) return fantasyPresentationProfile.rift.threatened;
  if (input.isCorrupted) return fantasyPresentationProfile.rift.corrupted;
  return 'fantasy-rift-none';
}

/** Safe lookup used by tests and BoardView — never throws. */
export function lookupFantasyTextureUrl(key: string): string | null {
  return fantasyPresentationProfile.textureUrls[key] ?? null;
}
