import Phaser from 'phaser';
import { MainMenuScene } from './MainMenuScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { initializeSharedGameFlowPersistence } from '../flow/gameFlowPersistenceCoordinator';
import { getBrowserTestOptions } from '../presentation/testing/browserTestOptions';
import { getPlayableLevelContent } from '../content/levelCatalog';
import { type PuzzleLaunchContext } from '../content/levelRun';
import { PuzzleScene } from './PuzzleScene';

export class BootScene extends Phaser.Scene {
  public static readonly key = 'BootScene';

  public constructor() {
    super(BootScene.key);
  }

  public create(): void {
    const { width, height } = this.scale;
    getSharedGameFlowController();
    initializeSharedGameFlowPersistence();

    this.add
      .text(width / 2, height / 2, 'Booting StoryCrush...', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

    this.time.delayedCall(300, () => {
      if (getBrowserTestOptions().e2eEnabled) {
        const query = new window.URLSearchParams(window.location.search);
        const levelId = query.get('level');
        const seedText = query.get('seed');
        const seed = seedText === null ? Number.NaN : Number(seedText);
        if (getPlayableLevelContent(levelId) && Number.isSafeInteger(seed) && seed >= 0) {
          const context: PuzzleLaunchContext = {
            mode: 'puzzle-lab',
            run: { levelId: levelId!, seed },
          };
          this.scene.start(PuzzleScene.key, context);
          return;
        }
      }
      this.scene.start(MainMenuScene.key);
    });
  }
}
