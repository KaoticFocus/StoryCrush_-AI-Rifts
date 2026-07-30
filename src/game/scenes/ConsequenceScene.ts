import Phaser from 'phaser';
import { MultiverseMapScene } from './MultiverseMapScene';
import {
  createPrototypeCampaignDefinition,
  getSharedGameFlowController,
} from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class ConsequenceScene extends Phaser.Scene {
  public static readonly key = 'ConsequenceScene';
  private readonly flowController = getSharedGameFlowController();

  public constructor() {
    super(ConsequenceScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('fantasy-consequence');
    markBrowserTestScene('consequence');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#020617');

    const state = this.flowController.getState();
    const result = state.latestPuzzleResult;
    const stabilized = state.storyFlags.includes('FANTASY_ARCHIVE_STABILIZED');
    const outcome = result?.outcome ?? 'failed';
    const selectedChoice = createPrototypeCampaignDefinition().chapters[0]?.availableChoices.find(
      (choice) => state.storyFlags.includes(choice.flag),
    );

    let message = 'The archive shuddered and the fracture endured.';
    if (stabilized && outcome === 'won') {
      message =
        'The archive steadied. The fracture closed for now, and the vault remembers more clearly.';
    } else if (stabilized && outcome === 'failed') {
      message = 'The archive stabilized, but the memory fracture still bled into the vault.';
    } else if (!stabilized && outcome === 'won') {
      message =
        'The fracture answered with a burst of power, and the archive now carries a new scar.';
    } else if (!stabilized && outcome === 'failed') {
      message = 'The fracture consumed the offered energy, and the archive is weaker than before.';
    }

    this.add
      .text(width / 2, height * 0.18, 'Consequence', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.36, `${message}\n\nChoice: ${selectedChoice?.label ?? 'none'}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: width - 90 },
      })
      .setOrigin(0.5);

    const continueButton = this.add
      .text(width / 2, height * 0.68, 'Return to Map', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f8fafc',
        backgroundColor: '#0f766e',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    continueButton.on('pointerdown', () => {
      this.flowController.advanceTo('multiverse-map');
      this.scene.start(MultiverseMapScene.key);
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.flowController.advanceTo('multiverse-map');
      this.scene.start(MultiverseMapScene.key);
    });
  }
}
