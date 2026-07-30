import { setGameFlowStateChangeHandler, type GameFlowController } from './gameFlowController';
import { createGameFlowRepository, type GameFlowPersistenceResult } from './gameFlowRepository';

export interface GameFlowPersistenceCoordinator {
  initialize(): GameFlowPersistenceResult;
  save(): GameFlowPersistenceResult;
  clear(): GameFlowPersistenceResult;
}

export function createGameFlowPersistenceCoordinator(
  controller: GameFlowController,
  repository: ReturnType<typeof createGameFlowRepository>,
): GameFlowPersistenceCoordinator {
  let initialized = false;

  setGameFlowStateChangeHandler(() => {
    if (!initialized) {
      return;
    }
    repository.save(controller);
  });

  return {
    initialize(): GameFlowPersistenceResult {
      initialized = true;
      const result = repository.restore(controller);
      if (!result.ok && result.status === 'not-found') {
        return { ok: true, status: 'not-found', state: controller.getState() };
      }
      return result;
    },
    save(): GameFlowPersistenceResult {
      initialized = true;
      return repository.save(controller);
    },
    clear(): GameFlowPersistenceResult {
      initialized = false;
      return repository.clear();
    },
  };
}
