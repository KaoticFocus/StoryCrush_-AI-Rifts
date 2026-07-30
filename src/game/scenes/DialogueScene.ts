import Phaser from 'phaser';
import { StoryChoiceScene } from './StoryChoiceScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class DialogueScene extends Phaser.Scene {
  public static readonly key = 'DialogueScene';
  private readonly flowController = getSharedGameFlowController();

  public constructor() {
    super(DialogueScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('fantasy-dialogue');
    markBrowserTestScene('dialogue');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#020617');

    this.add
      .text(width / 2, height * 0.16, 'Archive Dialogue', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    const lines = [
      'Archivist: The fracture remembers too much.',
      'Archivist: It wants a witness, not a guardian.',
      'Archivist: Choose carefully, and let the vault answer.',
    ];

    const panel = this.add.rectangle(width / 2, height * 0.42, width - 100, 220, 0x0f172a, 0.95);
    panel.setStrokeStyle(2, 0x38bdf8);

    lines.forEach((line, index) => {
      this.add
        .text(width / 2, height * 0.32 + index * 38, line, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#e2e8f0',
          align: 'center',
        })
        .setOrigin(0.5);
    });

    const continueButton = this.add
      .text(width / 2, height * 0.72, 'Continue to Choice', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    continueButton.on('pointerdown', () => {
      this.scene.start(StoryChoiceScene.key);
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start(StoryChoiceScene.key));
    this.input.keyboard?.on('keydown-SPACE', () => this.scene.start(StoryChoiceScene.key));
  }
}
