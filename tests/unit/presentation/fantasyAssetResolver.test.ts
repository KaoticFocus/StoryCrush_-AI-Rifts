import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildFantasyTextureLoadMap,
  classifyFantasyAssetVariant,
  prefersMobileFantasyAssets,
  resolveFantasyTextureUrl,
  toMobileManifestPath,
} from '../../../src/game/presentation/fantasy/fantasyAssetResolver';
import {
  fantasyPresentationProfile,
  fantasyTextureKeys,
  getFantasyPieceVisualId,
  getFantasySpecialVisualId,
} from '../../../src/game/presentation/fantasy/fantasyPresentationProfile';
import { type BoardPiece, type PieceType } from '../../../src/game/board';

describe('fantasyAssetResolver', () => {
  it('prefers mobile assets on phone portrait and landscape viewports', () => {
    expect(prefersMobileFantasyAssets(390, 844)).toBe(true);
    expect(prefersMobileFantasyAssets(320, 568)).toBe(true);
    expect(prefersMobileFantasyAssets(844, 390)).toBe(true);
  });

  it('does not prefer mobile assets on tablet or desktop', () => {
    expect(prefersMobileFantasyAssets(820, 1180)).toBe(false);
    expect(prefersMobileFantasyAssets(1280, 720)).toBe(false);
  });

  it('resolves phone keys to mobile overrides when available', () => {
    const ruby = resolveFantasyTextureUrl(fantasyTextureKeys.pieceByType.ruby, true);
    expect(ruby.variant).toBe('mobile');
    expect(ruby.url).toContain('/pieces/mobile/piece_fire_red.png');
  });

  it('falls back to general assets when mobile override is absent', () => {
    // Crest exists on general; force a key without a mobile map entry via unknown key path on general-only.
    const generalOnlyKey = 'fantasy:test:general-only';
    const resolved = resolveFantasyTextureUrl(generalOnlyKey, true);
    expect(resolved.url).toBeNull();
    expect(resolved.variant).toBeNull();

    const cell = resolveFantasyTextureUrl(fantasyTextureKeys.boardCell, false);
    expect(cell.variant).toBe('general');
    expect(cell.url).toContain('/board/board_cell_empty.png');
    expect(cell.url).not.toContain('/mobile/');
  });

  it('builds phone load maps that include mobile piece paths', () => {
    const map = buildFantasyTextureLoadMap(true);
    expect(map[fantasyTextureKeys.pieceByType.sapphire]).toContain('/pieces/mobile/');
    expect(
      classifyFantasyAssetVariant({ preferMobile: true, loadedCount: 6, mobileResolvedCount: 6 }),
    ).toBe('mobile');
    expect(
      classifyFantasyAssetVariant({ preferMobile: false, loadedCount: 6, mobileResolvedCount: 0 }),
    ).toBe('general');
    expect(
      classifyFantasyAssetVariant({ preferMobile: true, loadedCount: 0, mobileResolvedCount: 0 }),
    ).toBe('procedural');
  });

  it('keeps authoritative piece and special visual IDs unchanged', () => {
    const types: PieceType[] = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'pearl'];
    for (const type of types) {
      expect(getFantasyPieceVisualId(type)).toMatch(/^fantasy-/);
    }
    const horizontal: BoardPiece = {
      kind: 'line-clear',
      pieceType: 'ruby',
      orientation: 'horizontal',
    };
    expect(getFantasySpecialVisualId(horizontal)).toBe('fantasy-special-line-horizontal');
    expect(fantasyPresentationProfile.themeId).toBe('fantasy-board-v1');
  });

  it('normalizes mobile manifest paths to include /mobile/', () => {
    expect(toMobileManifestPath('pieces/piece_fire_red.png')).toBe(
      'pieces/mobile/piece_fire_red.png',
    );
    expect(toMobileManifestPath('board/mobile/board_cell_empty.png')).toBe(
      'board/mobile/board_cell_empty.png',
    );

    const manifest = JSON.parse(
      readFileSync(resolve('assets/source/fantasy/asset-manifest.mobile.json'), 'utf8'),
    ) as { assets: Array<{ file: string }> };
    expect(manifest.assets.length).toBeGreaterThan(0);
    for (const asset of manifest.assets) {
      expect(asset.file).toMatch(/\/mobile\//);
    }
  });
});
