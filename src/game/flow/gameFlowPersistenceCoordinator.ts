import {
  getSharedGameFlowController,
  setGameFlowStateChangeHandler,
  type GameFlowController,
  type GameFlowNodeId,
} from './gameFlowController';
import {
  createBrowserGameFlowStorage,
  createGameFlowRepository,
  type GameFlowPersistenceResult,
} from './gameFlowRepository';

export interface PersistenceSessionStatus {
  mode: 'durable' | 'memory-only' | 'unavailable';
  savePresent: boolean;
  canContinue: boolean;
  resolvedNodeId: GameFlowNodeId | null;
  resumeReason: string | null;
  warning: 'none' | 'memory-only' | 'write-failed' | 'corrupt-reset' | 'future-version';
}

export interface GameFlowPersistenceCoordinator {
  initialize(): GameFlowPersistenceResult;
  save(): GameFlowPersistenceResult;
  clear(): GameFlowPersistenceResult;
  replaceWithNewCampaign(action: () => void): GameFlowPersistenceResult;
  getLastResult(): GameFlowPersistenceResult | null;
  getSessionStatus(): PersistenceSessionStatus;
}

type GameFlowRepository = ReturnType<typeof createGameFlowRepository>;

let sharedCoordinator: GameFlowPersistenceCoordinator | null = null;
let sharedRepository: GameFlowRepository | null = null;
let sharedController: GameFlowController | null = null;
const coordinatorRegistry = new WeakMap<
  GameFlowController,
  WeakMap<GameFlowRepository, GameFlowPersistenceCoordinator>
>();

function createCoordinatorInstance(
  controller: GameFlowController,
  repository: GameFlowRepository,
): GameFlowPersistenceCoordinator {
  let restoreAttempted = false;
  let initialized = false;
  let replacementInProgress = false;
  let lastResult: GameFlowPersistenceResult | null = null;
  let lastOperation: 'restore' | 'save' | 'clear' = 'restore';
  let lastAnnouncement = '';

  const announceResult = (
    result: GameFlowPersistenceResult,
    operation: 'restore' | 'save' | 'clear',
  ): void => {
    const message =
      result.status === 'restored'
        ? 'Saved progress restored.'
        : result.status === 'corrupt-cleared'
          ? 'Corrupt saved progress was removed. A new game can be started safely.'
          : result.status === 'unsupported-version'
            ? 'This save was created by a newer version and cannot be continued.'
            : result.status === 'storage-unavailable'
              ? operation === 'save'
                ? 'Progress could not be written. Changes may not persist after this tab closes.'
                : 'Durable storage is unavailable. Progress will last only in this tab.'
              : repository.mode === 'memory-only' && operation === 'restore'
                ? 'Durable storage is unavailable. Progress will last only in this tab.'
                : '';
    if (!message || message === lastAnnouncement || typeof document === 'undefined') {
      return;
    }
    const statusElement = document.getElementById('storycrush-status');
    if (statusElement) {
      statusElement.textContent = message;
      lastAnnouncement = message;
    }
  };

  setGameFlowStateChangeHandler(() => {
    if (!initialized || !restoreAttempted || replacementInProgress) {
      return;
    }
    const result = repository.save(controller);
    lastResult = result;
    lastOperation = 'save';
  });

  return {
    initialize(): GameFlowPersistenceResult {
      if (restoreAttempted) {
        return lastResult ?? { ok: true, status: 'not-found', state: controller.getState() };
      }
      initialized = true;
      restoreAttempted = true;
      const result = repository.restore(controller);
      lastResult = result;
      lastOperation = 'restore';
      announceResult(result, 'restore');
      if (!result.ok && result.status === 'not-found') {
        return { ok: true, status: 'not-found', state: controller.getState() };
      }
      return result;
    },
    save(): GameFlowPersistenceResult {
      initialized = true;
      if (!restoreAttempted) {
        restoreAttempted = true;
        const restoreResult = repository.restore(controller);
        lastResult = restoreResult;
      }
      const result = repository.save(controller);
      lastResult = result;
      lastOperation = 'save';
      announceResult(result, 'save');
      return result;
    },
    replaceWithNewCampaign(action: () => void): GameFlowPersistenceResult {
      if (replacementInProgress) {
        return lastResult ?? { ok: true, status: 'saved', state: controller.getState() };
      }
      replacementInProgress = true;
      initialized = true;
      restoreAttempted = true;
      try {
        const clearResult = repository.clear();
        lastResult = clearResult;
        lastOperation = 'clear';
        announceResult(clearResult, 'clear');
        action();
        const result = repository.save(controller);
        lastResult = result;
        lastOperation = 'save';
        announceResult(result, 'save');
        return result;
      } finally {
        replacementInProgress = false;
      }
    },
    clear(): GameFlowPersistenceResult {
      initialized = false;
      restoreAttempted = false;
      const result = repository.clear();
      lastResult = result;
      lastOperation = 'clear';
      announceResult(result, 'clear');
      return result;
    },
    getLastResult(): GameFlowPersistenceResult | null {
      return lastResult;
    },
    getSessionStatus(): PersistenceSessionStatus {
      const lastResultSnapshot = lastResult ?? {
        ok: true,
        status: 'not-found',
        state: controller.getState(),
      };
      const currentState = controller.getState();
      const savePresent =
        lastResultSnapshot.status === 'restored' ||
        lastResultSnapshot.status === 'saved' ||
        lastResultSnapshot.status === 'unsupported-version';
      const canContinue =
        savePresent &&
        lastResultSnapshot.status !== 'unsupported-version' &&
        currentState.currentNodeId !== 'main-menu';
      const warning =
        lastResultSnapshot.status === 'storage-unavailable'
          ? lastOperation === 'save'
            ? 'write-failed'
            : 'memory-only'
          : lastResultSnapshot.status === 'invalid-payload' ||
              lastResultSnapshot.status === 'corrupt-cleared'
            ? 'corrupt-reset'
            : lastResultSnapshot.status === 'unsupported-version'
              ? 'future-version'
              : 'none';

      return {
        mode: lastResultSnapshot.status === 'storage-unavailable' ? 'unavailable' : repository.mode,
        savePresent,
        canContinue,
        resolvedNodeId: canContinue ? currentState.currentNodeId : null,
        resumeReason:
          lastResultSnapshot.status === 'saved' || lastResultSnapshot.status === 'restored'
            ? 'restored'
            : null,
        warning,
      };
    },
  };
}

export function createGameFlowPersistenceCoordinator(
  controller: GameFlowController,
  repository: GameFlowRepository,
): GameFlowPersistenceCoordinator {
  let controllerRegistry = coordinatorRegistry.get(controller);
  if (!controllerRegistry) {
    controllerRegistry = new WeakMap<GameFlowRepository, GameFlowPersistenceCoordinator>();
    coordinatorRegistry.set(controller, controllerRegistry);
  }

  const existing = controllerRegistry.get(repository);
  if (existing) {
    return existing;
  }

  const coordinator = createCoordinatorInstance(controller, repository);
  controllerRegistry.set(repository, coordinator);
  return coordinator;
}

export function getSharedGameFlowPersistenceCoordinator(): GameFlowPersistenceCoordinator {
  if (!sharedCoordinator) {
    sharedController = getSharedGameFlowController();
    sharedRepository = createGameFlowRepository(createBrowserGameFlowStorage());
    sharedCoordinator = createGameFlowPersistenceCoordinator(sharedController, sharedRepository);
  }
  return sharedCoordinator;
}

export function initializeSharedGameFlowPersistence(): GameFlowPersistenceResult {
  return getSharedGameFlowPersistenceCoordinator().initialize();
}

export function getSharedPersistenceStatus(): GameFlowPersistenceResult | null {
  return getSharedGameFlowPersistenceCoordinator().getLastResult();
}
