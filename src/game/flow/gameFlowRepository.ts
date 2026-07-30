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

export interface GameFlowPersistenceResult {
  ok: boolean;
  status:
    'restored' | 'saved' | 'cleared' | 'not-found' | 'invalid-payload' | 'storage-unavailable';
  state: GameFlowState;
}

export const GAME_FLOW_STORAGE_KEY = 'storycrush.game-flow';
export const GAME_FLOW_SCHEMA_VERSION = 1;

function cloneState(state: GameFlowState): GameFlowState {
  return {
    ...state,
    storyFlags: [...state.storyFlags],
    chapterStatus: Object.fromEntries(
      Object.entries(state.chapterStatus).map(([id, chapter]) => [id, { ...chapter }]),
    ),
    latestPuzzleResult: state.latestPuzzleResult ? { ...state.latestPuzzleResult } : null,
  };
}

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

export function createBrowserGameFlowStorage(): GameFlowStorageAdapter {
  try {
    const browserStorage = typeof window !== 'undefined' ? window.localStorage : null;
    if (!browserStorage) {
      throw new Error('Browser storage not available');
    }

    return {
      getItem(key: string): string | null {
        return browserStorage.getItem(key);
      },
      setItem(key: string, value: string): void {
        browserStorage.setItem(key, value);
      },
      removeItem(key: string): void {
        browserStorage.removeItem(key);
      },
    };
  } catch {
    return createInMemoryGameFlowStorage();
  }
}

export function createGameFlowRepository(storage: GameFlowStorageAdapter) {
  function readEnvelope(): {
    envelope: PersistedGameFlowEnvelope | null;
    status: GameFlowPersistenceResult['status'];
  } {
    const payload = storage.getItem(GAME_FLOW_STORAGE_KEY);
    if (!payload) {
      return { envelope: null, status: 'not-found' };
    }

    try {
      const parsed = JSON.parse(payload) as Partial<PersistedGameFlowEnvelope> & {
        state?: Partial<GameFlowState>;
      };
      if (!parsed || parsed.schemaVersion !== GAME_FLOW_SCHEMA_VERSION || !parsed.state) {
        return { envelope: null, status: 'invalid-payload' };
      }

      const initialState = createInitialGameFlowState();
      const state = parsed.state as Partial<GameFlowState>;
      const currentNodeId =
        typeof state.currentNodeId === 'string' ? state.currentNodeId : initialState.currentNodeId;
      const storyFlags = Array.isArray(state.storyFlags)
        ? state.storyFlags.filter(
            (flag): flag is NonNullable<GameFlowState['storyFlags'][number]> => Boolean(flag),
          )
        : initialState.storyFlags;
      const chapterStatus =
        state.chapterStatus &&
        typeof state.chapterStatus === 'object' &&
        !Array.isArray(state.chapterStatus)
          ? Object.fromEntries(
              Object.entries(state.chapterStatus).map(([id, chapter]) => [
                id,
                { ...(chapter ?? {}) },
              ]),
            )
          : initialState.chapterStatus;
      const latestPuzzleResult = state.latestPuzzleResult ? { ...state.latestPuzzleResult } : null;
      const hasContinuableSession =
        typeof state.hasContinuableSession === 'boolean'
          ? state.hasContinuableSession
          : Boolean(latestPuzzleResult);

      return {
        envelope: {
          schemaVersion: GAME_FLOW_SCHEMA_VERSION,
          state: {
            ...initialState,
            currentNodeId,
            storyFlags,
            chapterStatus,
            latestPuzzleResult,
            hasContinuableSession,
          },
        },
        status: 'restored',
      };
    } catch {
      return { envelope: null, status: 'invalid-payload' };
    }
  }

  return {
    save(controller: GameFlowController): GameFlowPersistenceResult {
      try {
        const state = controller.getState();
        const envelope: PersistedGameFlowEnvelope = {
          schemaVersion: GAME_FLOW_SCHEMA_VERSION,
          state,
        };
        storage.setItem(GAME_FLOW_STORAGE_KEY, JSON.stringify(envelope));
        return { ok: true, status: 'saved', state: cloneState(state) };
      } catch {
        return { ok: false, status: 'storage-unavailable', state: controller.getState() };
      }
    },
    restore(controller: GameFlowController): GameFlowPersistenceResult {
      const { envelope, status } = readEnvelope();
      if (!envelope) {
        return { ok: false, status, state: controller.getState() };
      }

      try {
        controller.restoreState(envelope.state);
        return { ok: true, status: 'restored', state: controller.getState() };
      } catch {
        return { ok: false, status: 'invalid-payload', state: controller.getState() };
      }
    },
    clear(): GameFlowPersistenceResult {
      try {
        storage.removeItem(GAME_FLOW_STORAGE_KEY);
        return { ok: true, status: 'cleared', state: createInitialGameFlowState() };
      } catch {
        return { ok: false, status: 'storage-unavailable', state: createInitialGameFlowState() };
      }
    },
  };
}
