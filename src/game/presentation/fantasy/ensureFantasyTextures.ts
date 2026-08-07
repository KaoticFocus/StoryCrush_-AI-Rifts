import Phaser from 'phaser';
import {
  fantasyPresentationProfile,
  type FantasyPresentationProfile,
} from './fantasyPresentationProfile';

export interface FantasyTextureLoadResult {
  ready: boolean;
  themeId: FantasyPresentationProfile['themeId'] | FantasyPresentationProfile['fallbackThemeId'];
  loadedCount: number;
  missingKeys: string[];
}

const sceneLoadState = new WeakMap<Phaser.Scene, FantasyTextureLoadResult>();

export function getFantasyTextureLoadResult(scene: Phaser.Scene): FantasyTextureLoadResult {
  return (
    sceneLoadState.get(scene) ?? {
      ready: false,
      themeId: fantasyPresentationProfile.fallbackThemeId,
      loadedCount: 0,
      missingKeys: [],
    }
  );
}

/**
 * Ensures Fantasy runtime textures are registered once per scene.
 * Missing files fall back to procedural drawing — board stays playable.
 */
export function ensureFantasyTextures(scene: Phaser.Scene): Promise<FantasyTextureLoadResult> {
  const existing = sceneLoadState.get(scene);
  if (existing?.ready) {
    return Promise.resolve(existing);
  }

  const entries = Object.entries(fantasyPresentationProfile.textureUrls);
  const alreadyPresent = entries.filter(([key]) => scene.textures.exists(key));
  const toLoad = entries.filter(([key]) => !scene.textures.exists(key));

  if (toLoad.length === 0) {
    const result: FantasyTextureLoadResult = {
      ready: alreadyPresent.length > 0,
      themeId:
        alreadyPresent.length > 0
          ? fantasyPresentationProfile.themeId
          : fantasyPresentationProfile.fallbackThemeId,
      loadedCount: alreadyPresent.length,
      missingKeys: [],
    };
    sceneLoadState.set(scene, result);
    return Promise.resolve(result);
  }

  return new Promise((resolve) => {
    const missingKeys: string[] = [];
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
      const loadedCount = entries.filter(([key]) => scene.textures.exists(key)).length;
      const result: FantasyTextureLoadResult = {
        ready: loadedCount > 0,
        themeId:
          loadedCount > 0
            ? fantasyPresentationProfile.themeId
            : fantasyPresentationProfile.fallbackThemeId,
        loadedCount,
        missingKeys,
      };
      sceneLoadState.set(scene, result);
      resolve(result);
    };

    const onFileError = (file: { key?: string }) => {
      if (file?.key) missingKeys.push(file.key);
    };
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);

    for (const [key, path] of toLoad) {
      scene.load.image(key, path);
    }

    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      finish();
    });

    scene.load.start();
    // Safety: never block interactivity forever on a hung loader.
    scene.time.delayedCall(4000, () => finish());
  });
}
