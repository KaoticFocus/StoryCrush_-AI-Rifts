import {
  createInitialGameFlowState,
  createPrototypeCampaignDefinition,
  type GameFlowController,
  type GameFlowState,
  validateAndNormalizeGameFlowState,
} from './gameFlowController';

export type GameFlowStorageMode = 'durable' | 'memory-only' | 'unavailable';

export interface GameFlowStorageReadResult {
  ok: boolean;
  value: string | null;
  mode: GameFlowStorageMode;
  error?: 'security' | 'quota' | 'unknown';
}

export interface GameFlowStorageWriteResult {
  ok: boolean;
  mode: GameFlowStorageMode;
  error?: 'security' | 'quota' | 'unknown';
}

export interface GameFlowStorageAdapter {
  readonly mode: GameFlowStorageMode;
  getItem(key: string): GameFlowStorageReadResult;
  setItem(key: string, value: string): GameFlowStorageWriteResult;
  removeItem(key: string): GameFlowStorageWriteResult;
}

type PersistedGameFlowState = Omit<GameFlowState, 'latestPuzzleResult'> & {
  latestPuzzleResult?: GameFlowState['latestPuzzleResult'];
};

export interface PersistedGameFlowEnvelopeV2 {
  schemaVersion: 2;
  savedAtEpochMs: number;
  state: PersistedGameFlowState;
}

export interface PersistedGameFlowEnvelopeV1 {
  schemaVersion: 1;
  state: GameFlowState;
}

export type PersistedGameFlowEnvelope = PersistedGameFlowEnvelopeV2 | PersistedGameFlowEnvelopeV1;

export interface GameFlowPersistenceResult {
  ok: boolean;
  status:
    | 'restored'
    | 'saved'
    | 'cleared'
    | 'not-found'
    | 'invalid-payload'
    | 'storage-unavailable'
    | 'unsupported-version'
    | 'corrupt-cleared';
  state: GameFlowState;
  migratedFrom?: 1;
  preservedPayload?: string | null;
}

export const GAME_FLOW_STORAGE_KEY = 'storycrush.game-flow';
export const GAME_FLOW_SCHEMA_VERSION = 2;

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

function createPersistableState(state: GameFlowState): PersistedGameFlowState {
  const persistedState: PersistedGameFlowState = {
    currentNodeId: state.currentNodeId,
    storyFlags: [...state.storyFlags],
    chapterStatus: Object.fromEntries(
      Object.entries(state.chapterStatus).map(([id, chapter]) => [id, { ...chapter }]),
    ),
    hasContinuableSession: state.hasContinuableSession,
  };

  if (state.latestPuzzleResult !== null) {
    persistedState.latestPuzzleResult = { ...state.latestPuzzleResult };
  }

  return persistedState;
}

export function createInMemoryGameFlowStorage(): GameFlowStorageAdapter {
  const store = new Map<string, string>();
  return {
    mode: 'memory-only',
    getItem(key: string): GameFlowStorageReadResult {
      return {
        ok: true,
        value: store.has(key) ? (store.get(key) ?? null) : null,
        mode: 'memory-only',
      };
    },
    setItem(key: string, value: string): GameFlowStorageWriteResult {
      store.set(key, value);
      return { ok: true, mode: 'memory-only' };
    },
    removeItem(key: string): GameFlowStorageWriteResult {
      store.delete(key);
      return { ok: true, mode: 'memory-only' };
    },
  };
}

function describeStorageError(
  error: unknown,
): GameFlowStorageReadResult['error'] | GameFlowStorageWriteResult['error'] {
  const errorName = error instanceof Error ? error.name : 'Error';
  if (errorName === 'QuotaExceededError') {
    return 'quota';
  }
  if (error instanceof Error && /security|denied/i.test(error.message)) {
    return 'security';
  }
  return 'unknown';
}

export function createBrowserGameFlowStorage(
  browserStorage?: Pick<
    {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    },
    'getItem' | 'setItem' | 'removeItem'
  > | null,
): GameFlowStorageAdapter {
  const fallbackStore = createInMemoryGameFlowStorage();
  let storageHandle: Pick<
    {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    },
    'getItem' | 'setItem' | 'removeItem'
  > | null = null;

  if (browserStorage) {
    storageHandle = browserStorage;
  } else if (typeof window !== 'undefined' && window.localStorage) {
    try {
      storageHandle = window.localStorage;
    } catch {
      storageHandle = null;
    }
  }

  if (!storageHandle) {
    return fallbackStore;
  }

  return {
    mode: 'durable',
    getItem(key: string): GameFlowStorageReadResult {
      try {
        return { ok: true, value: storageHandle.getItem(key), mode: 'durable' };
      } catch (error) {
        return { ok: false, value: null, mode: 'unavailable', error: describeStorageError(error) };
      }
    },
    setItem(key: string, value: string): GameFlowStorageWriteResult {
      try {
        storageHandle.setItem(key, value);
        return { ok: true, mode: 'durable' };
      } catch (error) {
        return { ok: false, mode: 'unavailable', error: describeStorageError(error) };
      }
    },
    removeItem(key: string): GameFlowStorageWriteResult {
      try {
        storageHandle.removeItem(key);
        return { ok: true, mode: 'durable' };
      } catch (error) {
        return { ok: false, mode: 'unavailable', error: describeStorageError(error) };
      }
    },
  };
}

export function createGameFlowRepository(
  storage: GameFlowStorageAdapter,
  options?: {
    now?: () => number;
    definition?: ReturnType<typeof createPrototypeCampaignDefinition>;
  },
) {
  const now = options?.now ?? Date.now;
  const definition = options?.definition ?? createPrototypeCampaignDefinition();
  function readEnvelope(): {
    envelope: (Omit<PersistedGameFlowEnvelopeV2, 'state'> & { state: GameFlowState }) | null;
    status: GameFlowPersistenceResult['status'];
    migratedFrom?: 1;
    preservedPayload?: string | null;
  } {
    const readResult = storage.getItem(GAME_FLOW_STORAGE_KEY);
    if (!readResult.ok || readResult.value === null) {
      return { envelope: null, status: readResult.ok ? 'not-found' : 'storage-unavailable' };
    }
    const payload = readResult.value;
    if (!payload) {
      return { envelope: null, status: 'not-found' };
    }

    try {
      const parsed = JSON.parse(payload) as Partial<PersistedGameFlowEnvelope> & {
        state?: Partial<GameFlowState>;
      };
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.state ||
        typeof parsed.state !== 'object'
      ) {
        return { envelope: null, status: 'invalid-payload', preservedPayload: payload };
      }

      if (
        typeof parsed.schemaVersion === 'number' &&
        parsed.schemaVersion > GAME_FLOW_SCHEMA_VERSION
      ) {
        return { envelope: null, status: 'unsupported-version', preservedPayload: payload };
      }

      if (parsed.schemaVersion === 1) {
        const migrationResult = validateAndNormalizeGameFlowState(
          {
            currentNodeId: parsed.state.currentNodeId as GameFlowState['currentNodeId'],
            storyFlags: Array.isArray(parsed.state.storyFlags) ? parsed.state.storyFlags : [],
            chapterStatus: (parsed.state.chapterStatus as GameFlowState['chapterStatus']) ?? {},
            latestPuzzleResult: parsed.state.latestPuzzleResult ?? null,
            hasContinuableSession: Boolean(parsed.state.hasContinuableSession),
          } as GameFlowState,
          definition,
        );

        if (!migrationResult.ok || !migrationResult.state) {
          return { envelope: null, status: 'invalid-payload', preservedPayload: payload };
        }

        return {
          envelope: {
            schemaVersion: GAME_FLOW_SCHEMA_VERSION,
            savedAtEpochMs: now(),
            state: migrationResult.state,
          },
          status: 'restored',
          migratedFrom: 1,
          preservedPayload: payload,
        };
      }

      if (parsed.schemaVersion !== GAME_FLOW_SCHEMA_VERSION) {
        return { envelope: null, status: 'invalid-payload', preservedPayload: payload };
      }

      const validation = validateAndNormalizeGameFlowState(
        parsed.state as GameFlowState,
        definition,
      );
      if (!validation.ok || !validation.state) {
        return { envelope: null, status: 'invalid-payload', preservedPayload: payload };
      }

      return {
        envelope: {
          schemaVersion: GAME_FLOW_SCHEMA_VERSION,
          savedAtEpochMs: typeof parsed.savedAtEpochMs === 'number' ? parsed.savedAtEpochMs : now(),
          state: validation.state,
        },
        status: 'restored',
      };
    } catch {
      return { envelope: null, status: 'invalid-payload' };
    }
  }

  return {
    mode: storage.mode,
    save(controller: GameFlowController): GameFlowPersistenceResult {
      const existing = readEnvelope();
      if (existing.status === 'unsupported-version') {
        return {
          ok: false,
          status: 'unsupported-version',
          state: controller.getState(),
          preservedPayload: existing.preservedPayload,
        };
      }

      const state = controller.getState();
      const envelope: PersistedGameFlowEnvelopeV2 = {
        schemaVersion: GAME_FLOW_SCHEMA_VERSION,
        savedAtEpochMs: now(),
        state: createPersistableState(state),
      };
      const writeResult = storage.setItem(GAME_FLOW_STORAGE_KEY, JSON.stringify(envelope));
      if (!writeResult.ok) {
        return { ok: false, status: 'storage-unavailable', state: controller.getState() };
      }
      return { ok: true, status: 'saved', state: cloneState(state) };
    },
    restore(controller: GameFlowController): GameFlowPersistenceResult {
      const { envelope, status, migratedFrom, preservedPayload } = readEnvelope();
      if (!envelope) {
        if (status === 'invalid-payload') {
          const removeResult = storage.removeItem(GAME_FLOW_STORAGE_KEY);
          if (!removeResult.ok) {
            return {
              ok: false,
              status: 'storage-unavailable',
              state: controller.getState(),
              preservedPayload,
            };
          }
          return {
            ok: false,
            status: 'corrupt-cleared',
            state: controller.getState(),
            preservedPayload,
          };
        }
        return { ok: false, status, state: controller.getState(), migratedFrom, preservedPayload };
      }

      try {
        controller.restoreState(envelope.state);
        return {
          ok: true,
          status: 'restored',
          state: controller.getState(),
          migratedFrom,
          preservedPayload,
        };
      } catch {
        return {
          ok: false,
          status: 'invalid-payload',
          state: controller.getState(),
          preservedPayload,
        };
      }
    },
    clear(): GameFlowPersistenceResult {
      const removeResult = storage.removeItem(GAME_FLOW_STORAGE_KEY);
      if (!removeResult.ok) {
        return { ok: false, status: 'storage-unavailable', state: createInitialGameFlowState() };
      }
      return { ok: true, status: 'cleared', state: createInitialGameFlowState() };
    },
  };
}
