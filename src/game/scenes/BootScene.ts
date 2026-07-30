import Phaser from 'phaser';
import { MainMenuScene } from './MainMenuScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { createBrowserGameFlowStorage, createGameFlowRepository } from '../flow/gameFlowRepository';
import { createGameFlowPersistenceCoordinator } from '../flow/gameFlowPersistenceCoordinator';

export class BootScene extends Phaser.Scene {
  public static readonly key = 'BootScene';

  public constructor() {
    super(BootScene.key);
  }

  public create(): void {
    const { width, height } = this.scale;
    const controller = getSharedGameFlowController();
    const repository = createGameFlowRepository(createBrowserGameFlowStorage());
    const coordinator = createGameFlowPersistenceCoordinator(controller, repository);
    coordinator.initialize();

    this.add
      .text(width / 2, height / 2, 'Booting StoryCrush...', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

    this.time.delayedCall(300, () => {
      this.scene.start(MainMenuScene.key);
    });
  }
}
