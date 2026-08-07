import Phaser from 'phaser';
import {
  buildFantasyTextureLoadMap,
  classifyFantasyAssetVariant,
  resolveFantasyTextureUrl,
  type FantasyAssetVariant,
  prefersMobileFantasyAssets,
} from './fantasyAssetResolver';
import { fantasyPresentationProfile } from './fantasyPresentationProfile';

export interface FantasyTextureLoadResult {
  ready: boolean;
  themeId:
    typeof fantasyPresentationProfile.themeId | typeof fantasyPresentationProfile.fallbackThemeId;
  assetVariant: FantasyAssetVariant;
  preferMobile: boolean;
  loadedCount: number;
  mobileResolvedCount: number;
  missingKeys: string[];
}

interface SceneTextureState {
  result: FantasyTextureLoadResult;
  loadMap: Record<string, string>;
}

const sceneLoadState = new WeakMap<Phaser.Scene, SceneTextureState>();

function signatureFor(loadMap: Record<string, string>, preferMobile: boolean): string {
  return `${preferMobile ? 'm' : 'g'}|${Object.entries(loadMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, path]) => `${key}=${path}`)
    .join(';')}`;
}

export function getFantasyTextureLoadResult(scene: Phaser.Scene): FantasyTextureLoadResult {
  return (
    sceneLoadState.get(scene)?.result ?? {
      ready: false,
      themeId: fantasyPresentationProfile.fallbackThemeId,
      assetVariant: 'procedural',
      preferMobile: false,
      loadedCount: 0,
      mobileResolvedCount: 0,
      missingKeys: [],
    }
  );
}

function loadImageMap(
  scene: Phaser.Scene,
  entries: Array<[string, string]>,
): Promise<{ missingKeys: string[] }> {
  if (entries.length === 0) {
    return Promise.resolve({ missingKeys: [] });
  }

  return new Promise((resolve) => {
    const missingKeys: string[] = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
      resolve({ missingKeys });
    };
    const onFileError = (file: { key?: string }) => {
      if (file?.key) missingKeys.push(file.key);
    };
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    for (const [key, path] of entries) {
      scene.load.image(key, path);
    }
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => finish());
    scene.load.start();
    scene.time.delayedCall(4000, () => finish());
  });
}

/**
 * Ensures Fantasy runtime textures are registered for the current device class.
 * Stable texture keys are reused; mobile/general selection is resolved internally.
 * Missing mobile files fall back to general URLs, then procedural drawing.
 */
export async function ensureFantasyTextures(
  scene: Phaser.Scene,
  options?: { preferMobile?: boolean; width?: number; height?: number },
): Promise<FantasyTextureLoadResult> {
  const preferMobile =
    options?.preferMobile ??
    prefersMobileFantasyAssets(
      options?.width ?? scene.scale.width,
      options?.height ?? scene.scale.height,
    );
  const loadMap = buildFantasyTextureLoadMap(preferMobile);
  const existing = sceneLoadState.get(scene);
  if (
    existing?.result.ready &&
    signatureFor(existing.loadMap, existing.result.preferMobile) ===
      signatureFor(loadMap, preferMobile)
  ) {
    return existing.result;
  }

  const previousMap = existing?.loadMap ?? {};
  const toLoad: Array<[string, string]> = [];
  for (const [key, path] of Object.entries(loadMap)) {
    if (previousMap[key] === path && scene.textures.exists(key)) {
      continue;
    }
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    toLoad.push([key, path]);
  }

  const firstPass = await loadImageMap(scene, toLoad);

  if (preferMobile && firstPass.missingKeys.length > 0) {
    const retries: Array<[string, string]> = [];
    for (const key of firstPass.missingKeys) {
      const general = resolveFantasyTextureUrl(key, false);
      if (general.url && general.url !== loadMap[key]) {
        if (scene.textures.exists(key)) {
          scene.textures.remove(key);
        }
        retries.push([key, general.url]);
        loadMap[key] = general.url;
      }
    }
    if (retries.length > 0) {
      await loadImageMap(scene, retries);
    }
  }

  const loadedKeys = Object.keys(loadMap).filter((key) => scene.textures.exists(key));
  const loadedCount = loadedKeys.length;
  const mobileLoadedCount = loadedKeys.filter((key) =>
    (loadMap[key] ?? '').includes('/mobile/'),
  ).length;
  const missingKeys = Object.keys(loadMap).filter((key) => !scene.textures.exists(key));

  const result: FantasyTextureLoadResult = {
    ready: loadedCount > 0,
    themeId:
      loadedCount > 0
        ? fantasyPresentationProfile.themeId
        : fantasyPresentationProfile.fallbackThemeId,
    assetVariant: classifyFantasyAssetVariant({
      preferMobile,
      loadedCount,
      mobileResolvedCount: mobileLoadedCount,
    }),
    preferMobile,
    loadedCount,
    mobileResolvedCount: mobileLoadedCount,
    missingKeys,
  };

  sceneLoadState.set(scene, { result, loadMap: { ...loadMap } });
  return result;
}
