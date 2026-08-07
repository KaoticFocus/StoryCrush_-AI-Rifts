import { describe, expect, it } from 'vitest';
import { type BoardPiece, type PieceType } from '../../../src/game/board';
import {
  FANTASY_BOARD_THEME_ID,
  fantasyPresentationProfile,
  getFantasyPieceVisualId,
  getFantasyRiftVisualState,
  getFantasySpecialVisualId,
  lookupFantasyTextureUrl,
  resolveFantasyEffectProfile,
} from '../../../src/game/presentation/fantasy/fantasyPresentationProfile';

const standardTypes: PieceType[] = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'];

describe('fantasy presentation profile', () => {
  it('maps all six standard piece types to distinct Fantasy visual identities', () => {
    const ids = standardTypes.map((type) => getFantasyPieceVisualId(type));
    expect(new Set(ids).size).toBe(6);
    expect(ids.every((id) => id.startsWith('fantasy-'))).toBe(true);
  });

  it('gives every standard piece a non-color glyph/silhouette identifier', () => {
    for (const type of standardTypes) {
      const glyph = fantasyPresentationProfile.pieceGlyphByType[type];
      expect(glyph.length).toBeGreaterThan(0);
      expect(glyph).not.toMatch(/red|blue|green|gold|purple|white|color/i);
    }
    const glyphs = standardTypes.map((type) => fantasyPresentationProfile.pieceGlyphByType[type]);
    expect(new Set(glyphs).size).toBe(6);
  });

  it('keeps horizontal and vertical special presentation distinct', () => {
    const horizontal: BoardPiece = {
      kind: 'line-clear',
      pieceType: 'ruby',
      orientation: 'horizontal',
    };
    const vertical: BoardPiece = {
      kind: 'line-clear',
      pieceType: 'ruby',
      orientation: 'vertical',
    };
    expect(getFantasySpecialVisualId(horizontal)).toBe('fantasy-special-line-horizontal');
    expect(getFantasySpecialVisualId(vertical)).toBe('fantasy-special-line-vertical');
    expect(getFantasySpecialVisualId(horizontal)).not.toBe(getFantasySpecialVisualId(vertical));
  });

  it('exposes cross and type-targeting special visual keys', () => {
    const cross: BoardPiece = { kind: 'cross-clear', pieceType: 'emerald' };
    const wildcard: BoardPiece = { kind: 'wildcard', pieceType: 'sapphire' };
    expect(getFantasySpecialVisualId(cross)).toBe('fantasy-special-cross');
    expect(getFantasySpecialVisualId(wildcard)).toBe('fantasy-special-type-target');
  });

  it('maps Rift source, threatened, and corrupted states to distinct visual keys', () => {
    const source = getFantasyRiftVisualState({
      isSource: true,
      isThreatened: false,
      isCorrupted: true,
    });
    const threatened = getFantasyRiftVisualState({
      isSource: false,
      isThreatened: true,
      isCorrupted: false,
    });
    const corrupted = getFantasyRiftVisualState({
      isSource: false,
      isThreatened: false,
      isCorrupted: true,
    });
    expect(source).toBe('fantasy-rift-source');
    expect(threatened).toBe('fantasy-rift-threatened');
    expect(corrupted).toBe('fantasy-rift-corrupted');
    expect(new Set([source, threatened, corrupted]).size).toBe(3);
  });

  it('provides reduced-motion alternatives for animated effect profiles', () => {
    for (const kind of ['spread', 'cleanse', 'hint', 'reject'] as const) {
      const animated = resolveFantasyEffectProfile(kind, false);
      const reduced = resolveFantasyEffectProfile(kind, true);
      expect(animated).not.toBe(reduced);
      expect(reduced).toContain('reduced');
    }
  });

  it('falls back safely for missing profile/asset lookups', () => {
    expect(lookupFantasyTextureUrl('missing:key')).toBeNull();
    expect(
      lookupFantasyTextureUrl(fantasyPresentationProfile.textureKeys.pieceByType.ruby),
    ).toMatch(/piece_fire_red\.png$/);
    expect(fantasyPresentationProfile.themeId).toBe(FANTASY_BOARD_THEME_ID);
    expect(fantasyPresentationProfile.fallbackThemeId).toBe('procedural-vector');
  });
});
