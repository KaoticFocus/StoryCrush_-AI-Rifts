import {
  createInitialGameFlowState,
  type GameFlowController,
  type GameFlowState,
} from './gameFlowController';

export interface GameFlowStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistedGameFlowEnvelope {
  schemaVersion: 1;
  state: GameFlowState;
}

export const GAME_FLOW_STORAGE_KEY = 'storycrush.game-flow';
export const GAME_FLOW_SCHEMA_VERSION = 1;

export function createInMemoryGameFlowStorage(): GameFlowStorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

export function createGameFlowRepository(storage: GameFlowStorageAdapter) {
  function readEnvelope(): PersistedGameFlowEnvelope | null {
    const payload = storage.getItem(GAME_FLOW_STORAGE_KEY);
    if (!payload) return null;

    try {
      const parsed = JSON.parse(payload) as Partial<PersistedGameFlowEnvelope>;
      if (!parsed || parsed.schemaVersion !== GAME_FLOW_SCHEMA_VERSION || !parsed.state) {
        return null;
      }

      const state = parsed.state;
      if (
        typeof state.currentNodeId !== 'string' ||
        !Array.isArray(state.storyFlags) ||
        typeof state.chapterStatus !== 'object' ||
        state.chapterStatus === null ||
        typeof state.hasContinuableSession !== 'boolean'
      ) {
        return null;
      }

      return {
        schemaVersion: GAME_FLOW_SCHEMA_VERSION,
        state: {
          ...createInitialGameFlowState(),
          ...state,
          storyFlags: [...state.storyFlags],
          chapterStatus: { ...state.chapterStatus },
          latestPuzzleResult: state.latestPuzzleResult
            ? {
                ...state.latestPuzzleResult,
              }
            : null,
        },
      };
    } catch {
      return null;
    }
  }

  return {
    save(controller: GameFlowController): boolean {
      try {
        const state = controller.getState();
        const envelope: PersistedGameFlowEnvelope = {
          schemaVersion: GAME_FLOW_SCHEMA_VERSION,
          state,
        };
        storage.setItem(GAME_FLOW_STORAGE_KEY, JSON.stringify(envelope));
        return true;
      } catch {
        return false;
      }
    },
    restore(controller: GameFlowController): boolean {
      const envelope = readEnvelope();
      if (!envelope) return false;

      try {
        controller.restoreState(envelope.state);
        return true;
      } catch {
        return false;
      }
    },
    clear(): boolean {
      try {
        storage.removeItem(GAME_FLOW_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}
