import {
  clonePrototypeSettings,
  createDefaultPrototypeSettings,
  isPlaybackMode,
  PROTOTYPE_SETTINGS_STORAGE_KEY,
  PROTOTYPE_SETTINGS_VERSION,
  type PrototypeSettings,
} from './prototypeSettings';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class PrototypeSettingsRepository {
  public constructor(
    private readonly storage: StorageLike | null,
    private readonly getDefaultReducedMotion: () => boolean = () => false,
  ) {}

  public load(): PrototypeSettings {
    const defaults = createDefaultPrototypeSettings(this.getDefaultReducedMotion());
    if (!this.storage) {
      return defaults;
    }

    try {
      const raw = this.storage.getItem(PROTOTYPE_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return defaults;
      }

      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') {
        return defaults;
      }

      const stored = value as Record<string, unknown>;
      if (
        stored.version !== PROTOTYPE_SETTINGS_VERSION ||
        !isPlaybackMode(stored.playbackMode) ||
        typeof stored.reducedMotion !== 'boolean' ||
        typeof stored.hintsEnabled !== 'boolean'
      ) {
        return defaults;
      }

      return {
        version: PROTOTYPE_SETTINGS_VERSION,
        playbackMode: stored.playbackMode,
        reducedMotion: stored.reducedMotion,
        hintsEnabled: stored.hintsEnabled,
      };
    } catch {
      return defaults;
    }
  }

  public save(settings: PrototypeSettings): void {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(PROTOTYPE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Presentation preferences are optional and must never block play.
    }
  }

  public reset(): PrototypeSettings {
    const settings = createDefaultPrototypeSettings(this.getDefaultReducedMotion());
    this.save(settings);
    return clonePrototypeSettings(settings);
  }
}
