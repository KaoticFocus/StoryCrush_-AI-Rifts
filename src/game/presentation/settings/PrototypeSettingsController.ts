import { type PlaybackMode } from '../playback/playbackTypes';
import { PrototypeSettingsRepository } from './PrototypeSettingsRepository';
import { clonePrototypeSettings, type PrototypeSettings } from './prototypeSettings';

export class PrototypeSettingsController {
  private settings: PrototypeSettings;

  public constructor(private readonly repository: PrototypeSettingsRepository) {
    this.settings = repository.load();
  }

  public getSnapshot(): PrototypeSettings {
    return clonePrototypeSettings(this.settings);
  }

  public setPlaybackMode(playbackMode: PlaybackMode): PrototypeSettings {
    return this.update({ playbackMode });
  }

  public setReducedMotion(reducedMotion: boolean): PrototypeSettings {
    return this.update({ reducedMotion });
  }

  public setHintsEnabled(hintsEnabled: boolean): PrototypeSettings {
    return this.update({ hintsEnabled });
  }

  public reset(): PrototypeSettings {
    this.settings = this.repository.reset();
    return this.getSnapshot();
  }

  private update(update: Partial<PrototypeSettings>): PrototypeSettings {
    this.settings = { ...this.settings, ...update };
    this.repository.save(this.settings);
    return this.getSnapshot();
  }
}
