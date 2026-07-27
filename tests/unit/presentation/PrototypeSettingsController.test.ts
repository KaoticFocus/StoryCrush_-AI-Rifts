import { describe, expect, it } from 'vitest';
import { PrototypeSettingsController } from '../../../src/game/presentation/settings/PrototypeSettingsController';
import {
  PrototypeSettingsRepository,
  type StorageLike,
} from '../../../src/game/presentation/settings/PrototypeSettingsRepository';
import { PROTOTYPE_SETTINGS_STORAGE_KEY } from '../../../src/game/presentation/settings/prototypeSettings';

class MemoryStorage implements StorageLike {
  public values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('PrototypeSettingsController', () => {
  it('loads immutable defaults and persists presentation-only updates', () => {
    const storage = new MemoryStorage();
    const controller = new PrototypeSettingsController(
      new PrototypeSettingsRepository(storage, () => true),
    );
    const initial = controller.getSnapshot();

    expect(initial).toEqual({
      version: 1,
      playbackMode: 'normal',
      reducedMotion: true,
      hintsEnabled: true,
    });
    initial.hintsEnabled = false;
    expect(controller.getSnapshot().hintsEnabled).toBe(true);

    controller.setPlaybackMode('fast');
    controller.setReducedMotion(false);
    controller.setHintsEnabled(false);

    expect(JSON.parse(storage.getItem(PROTOTYPE_SETTINGS_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      playbackMode: 'fast',
      reducedMotion: false,
      hintsEnabled: false,
    });
  });

  it('recovers from invalid stored values and reset persists defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROTOTYPE_SETTINGS_STORAGE_KEY, '{"version":1,"playbackMode":"slow"}');
    const controller = new PrototypeSettingsController(new PrototypeSettingsRepository(storage));

    expect(controller.getSnapshot()).toEqual({
      version: 1,
      playbackMode: 'normal',
      reducedMotion: false,
      hintsEnabled: true,
    });
    expect(controller.reset()).toEqual(controller.getSnapshot());
  });
});
