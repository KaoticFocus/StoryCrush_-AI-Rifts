import {
  fantasyPresentationProfile,
  fantasyTextureKeys,
  type FantasyPresentationProfile,
} from './fantasyPresentationProfile';

export type FantasyAssetVariant = 'mobile' | 'general' | 'procedural';

const PUBLIC_ROOT = '/assets/fantasy';

function url(path: string): string {
  return `${PUBLIC_ROOT}/${path}`;
}

/**
 * Phone portrait/landscape use mobile Fantasy overrides.
 * Matches puzzleLayout phone classification (no user-agent sniffing).
 */
export function prefersMobileFantasyAssets(width: number, height: number): boolean {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const phonePortrait = w <= 500 && w < h * 1.05;
  const phoneLandscape = w > h && h <= 500;
  return phonePortrait || phoneLandscape;
}

/** Mobile runtime overrides for the same stable texture keys as general FP-1 art. */
export const fantasyMobileTextureUrls: Partial<Record<string, string>> = {
  [fantasyTextureKeys.pieceByType.ruby]: url('pieces/mobile/piece_fire_red.png'),
  [fantasyTextureKeys.pieceByType.sapphire]: url('pieces/mobile/piece_water_blue.png'),
  [fantasyTextureKeys.pieceByType.emerald]: url('pieces/mobile/piece_leaf_green.png'),
  [fantasyTextureKeys.pieceByType.topaz]: url('pieces/mobile/piece_sun_gold.png'),
  [fantasyTextureKeys.pieceByType.amethyst]: url('pieces/mobile/piece_moon_triangle_purple.png'),
  [fantasyTextureKeys.pieceByType.pearl]: url('pieces/mobile/piece_moon_silver.png'),
  [fantasyTextureKeys.specialLineHorizontal]: url('specials/mobile/special_fire_horizontal.png'),
  [fantasyTextureKeys.specialCross]: url('specials/mobile/special_starburst_green.png'),
  [fantasyTextureKeys.specialTypeTarget]: url('specials/mobile/special_vortex_blue.png'),
  [fantasyTextureKeys.overlaySelected]: url('specials/mobile/overlay_piece_selected.png'),
  [fantasyTextureKeys.overlayHint]: url('specials/mobile/overlay_valid_move.png'),
  [fantasyTextureKeys.boardBackplate]: url('board/mobile/board_backplate.png'),
  [fantasyTextureKeys.boardCell]: url('board/mobile/board_cell_empty.png'),
  [fantasyTextureKeys.boardCorner]: url('board/mobile/board_corner_top_left.png'),
  [fantasyTextureKeys.boardEdgeTop]: url('board/mobile/board_edge_top.png'),
  [fantasyTextureKeys.boardEdgeBottom]: url('board/mobile/board_edge_bottom.png'),
  [fantasyTextureKeys.boardEdgeSide]: url('board/mobile/board_edge_left.png'),
  [fantasyTextureKeys.boardOrnamentGem]: url('board/mobile/board_ornament_side_gem.png'),
  [fantasyTextureKeys.boardOrnamentCrest]: url('board/mobile/board_ornament_top_crest.png'),
  [fantasyTextureKeys.hudTopPanel]: url('hud/mobile/hud_top_panel_background.png'),
  [fantasyTextureKeys.hudScoreContainer]: url('hud/mobile/hud_score_container.png'),
  [fantasyTextureKeys.hudMovesContainer]: url('hud/mobile/hud_moves_container.png'),
  [fantasyTextureKeys.panelObjectives]: url('panels/mobile/panel_objectives_background.png'),
  [fantasyTextureKeys.buttonRestart]: url('buttons/mobile/button_restart_bg.png'),
  [fantasyTextureKeys.buttonMenu]: url('buttons/mobile/button_menu_bg.png'),
  [fantasyTextureKeys.buttonHint]: url('buttons/mobile/button_hint_bg.png'),
  [fantasyTextureKeys.buttonMode]: url('buttons/mobile/button_mode_bg.png'),
  [fantasyTextureKeys.buttonPause]: url('buttons/mobile/button_pause_round.png'),
};

/**
 * Resolve one texture URL for a stable key.
 * Phone: mobile → general → null (procedural).
 * Tablet/desktop: general → null.
 */
export function resolveFantasyTextureUrl(
  key: string,
  preferMobile: boolean,
): { url: string | null; variant: Exclude<FantasyAssetVariant, 'procedural'> | null } {
  if (preferMobile) {
    const mobileUrl = fantasyMobileTextureUrls[key];
    if (mobileUrl) {
      return { url: mobileUrl, variant: 'mobile' };
    }
  }
  const generalUrl = fantasyPresentationProfile.textureUrls[key] ?? null;
  if (generalUrl) {
    return { url: generalUrl, variant: 'general' };
  }
  return { url: null, variant: null };
}

/** Build the concrete key→url map for the current device class. */
export function buildFantasyTextureLoadMap(preferMobile: boolean): Record<string, string> {
  const keys = new Set<string>([
    ...Object.keys(fantasyPresentationProfile.textureUrls),
    ...Object.keys(fantasyMobileTextureUrls),
  ]);
  const map: Record<string, string> = {};
  for (const key of keys) {
    const resolved = resolveFantasyTextureUrl(key, preferMobile);
    if (resolved.url) {
      map[key] = resolved.url;
    }
  }
  return map;
}

export function classifyFantasyAssetVariant(input: {
  preferMobile: boolean;
  loadedCount: number;
  mobileResolvedCount: number;
}): FantasyAssetVariant {
  if (input.loadedCount <= 0) {
    return 'procedural';
  }
  if (input.preferMobile && input.mobileResolvedCount > 0) {
    return 'mobile';
  }
  return 'general';
}

export function countMobileResolvedUrls(loadMap: Record<string, string>): number {
  return Object.values(loadMap).filter((path) => path.includes('/mobile/')).length;
}

export function getFantasyFallbackThemeId(): FantasyPresentationProfile['fallbackThemeId'] {
  return fantasyPresentationProfile.fallbackThemeId;
}

/** Pure helper for tests — normalized mobile source path convention. */
export function toMobileManifestPath(generalRelativePath: string): string {
  const parts = generalRelativePath.split('/');
  if (parts.length < 2) return generalRelativePath;
  if (parts[1] === 'mobile') return generalRelativePath;
  return `${parts[0]}/mobile/${parts.slice(1).join('/')}`;
}
