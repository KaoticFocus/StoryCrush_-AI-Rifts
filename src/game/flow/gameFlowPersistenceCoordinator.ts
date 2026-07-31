import {
  getSharedGameFlowController,
  setGameFlowStateChangeHandler,
  type GameFlowController,
} from './gameFlowController';
import {
  createBrowserGameFlowStorage,
  createGameFlowRepository,
  type GameFlowPersistenceResult,
} from './gameFlowRepository';

export interface GameFlowPersistenceCoordinator {
  initialize(): GameFlowPersistenceResult;
  save(): GameFlowPersistenceResult;
  clear(): GameFlowPersistenceResult;
  getLastResult(): GameFlowPersistenceResult | null;
}

type GameFlowRepository = ReturnType<typeof createGameFlowRepository>;

let sharedCoordinator: GameFlowPersistenceCoordinator | null = null;
let sharedRepository: GameFlowRepository | null = null;
let sharedController: GameFlowController | null = null;
let sharedLastResult: GameFlowPersistenceResult | null = null;
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

  setGameFlowStateChangeHandler(() => {
    if (!initialized || !restoreAttempted) {
      return;
    }
    const result = repository.save(controller);
    sharedLastResult = result;
  });

  return {
    initialize(): GameFlowPersistenceResult {
      if (restoreAttempted) {
        return sharedLastResult ?? { ok: true, status: 'not-found', state: controller.getState() };
      }
      initialized = true;
      restoreAttempted = true;
      const result = repository.restore(controller);
      sharedLastResult = result;
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
        sharedLastResult = restoreResult;
      }
      const result = repository.save(controller);
      sharedLastResult = result;
      return result;
    },
    clear(): GameFlowPersistenceResult {
      initialized = false;
      restoreAttempted = false;
      const result = repository.clear();
      sharedLastResult = result;
      return result;
    },
    getLastResult(): GameFlowPersistenceResult | null {
      return sharedLastResult;
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
