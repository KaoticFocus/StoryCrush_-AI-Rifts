import Phaser from 'phaser';
import { ConsequenceScene } from './ConsequenceScene';
import {
  createPrototypeCampaignDefinition,
  getSharedGameFlowController,
} from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class ResultsScene extends Phaser.Scene {
  public static readonly key = 'ResultsScene';
  private readonly flowController = getSharedGameFlowController();

  public constructor() {
    super(ResultsScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('results');
    markBrowserTestScene('results');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#020617');

    const state = this.flowController.getState();
    const result = state.latestPuzzleResult;
    const outcome = result?.outcome ?? 'failed';
    const score = result?.score ?? 0;
    const movesRemaining = result?.movesRemaining ?? 0;
    const selectedChoice = createPrototypeCampaignDefinition().chapters[0]?.availableChoices.find(
      (choice) => state.storyFlags.includes(choice.flag),
    );

    this.add
      .text(width / 2, height * 0.18, outcome === 'won' ? 'Puzzle Success' : 'Puzzle Failure', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.34,
        `Final score: ${score}\nMoves remaining: ${movesRemaining}\nObjective completed: ${result?.objectiveCompleted ? 'yes' : 'no'}`,
        {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#cbd5e1',
          align: 'center',
          wordWrap: { width: width - 90 },
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.56,
        `Choice recorded: ${selectedChoice?.label ?? 'none'}\nFlag: ${state.storyFlags.join(', ') || 'none'}`,
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#7dd3fc',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    const continueButton = this.add
      .text(width / 2, height * 0.72, 'Continue to Consequence', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    continueButton.on('pointerdown', () => {
      this.flowController.advanceTo('fantasy-consequence');
      this.scene.start(ConsequenceScene.key);
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.flowController.advanceTo('fantasy-consequence');
      this.scene.start(ConsequenceScene.key);
    });
  }
}
