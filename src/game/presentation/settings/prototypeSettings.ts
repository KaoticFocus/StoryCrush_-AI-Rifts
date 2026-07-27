import { type PlaybackMode } from '../playback/playbackTypes';

export const PROTOTYPE_SETTINGS_VERSION = 1;
export const PROTOTYPE_SETTINGS_STORAGE_KEY = 'storycrush.prototype-settings.v1';

export interface PrototypeSettings {
  version: typeof PROTOTYPE_SETTINGS_VERSION;
  playbackMode: PlaybackMode;
  reducedMotion: boolean;
  hintsEnabled: boolean;
}

export function createDefaultPrototypeSettings(reducedMotion = false): PrototypeSettings {
  return {
    version: PROTOTYPE_SETTINGS_VERSION,
    playbackMode: 'normal',
    reducedMotion,
    hintsEnabled: true,
  };
}

export function clonePrototypeSettings(settings: PrototypeSettings): PrototypeSettings {
  return { ...settings };
}

export function isPlaybackMode(value: unknown): value is PlaybackMode {
  return value === 'normal' || value === 'fast' || value === 'instant';
}
