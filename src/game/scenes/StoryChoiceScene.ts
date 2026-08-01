import Phaser from 'phaser';
import { PuzzleScene } from './PuzzleScene';
import {
  getSharedGameFlowController,
  createPrototypeCampaignDefinition,
} from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import { createBrowserSeedProvider } from '../presentation/browserSeedProvider';
import { type PuzzleLaunchContext } from '../content/levelRun';

export class StoryChoiceScene extends Phaser.Scene {
  public static readonly key = 'StoryChoiceScene';
  private readonly flowController = getSharedGameFlowController();
  private readonly seedProvider = createBrowserSeedProvider();

  public constructor() {
    super(StoryChoiceScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('fantasy-choice');
    markBrowserTestScene('story-choice');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#020617');

    this.add
      .text(width / 2, height * 0.16, 'Choose the Archive Response', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    const choicePanel = this.add.rectangle(
      width / 2,
      height * 0.45,
      width - 120,
      240,
      0x0f172a,
      0.95,
    );
    choicePanel.setStrokeStyle(2, 0x38bdf8);

    const choices = createPrototypeCampaignDefinition().chapters[0]?.availableChoices ?? [];
    let transitionLocked = false;

    choices.forEach((choice, index) => {
      const y = height * 0.34 + index * 72;
      const button = this.add
        .text(width / 2, y, choice.label, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#f8fafc',
          backgroundColor: '#1d4ed8',
          padding: { x: 16, y: 10 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => {
        if (transitionLocked) return;
        const result = this.flowController.chooseStoryOption(choice.id);
        if (!result.ok) return;
        transitionLocked = true;
        this.flowController.advanceTo('puzzle');
        const run = { levelId: 'archive-stabilization', seed: this.seedProvider.nextSeed() };
        this.flowController.recordActiveLevelRun(run);
        const context: PuzzleLaunchContext = { mode: 'campaign', run };
        this.scene.start(PuzzleScene.key, context);
      });
    });
  }
}
