import Phaser from 'phaser';
import { DialogueScene } from './DialogueScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class ChapterIntroScene extends Phaser.Scene {
  public static readonly key = 'ChapterIntroScene';
  private readonly flowController = getSharedGameFlowController();

  public constructor() {
    super(ChapterIntroScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('fantasy-chapter-intro');
    markBrowserTestScene('chapter-intro');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#020617');

    this.add
      .text(width / 2, height * 0.18, 'Fantasy Chapter: The Archive Fracture', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.34,
        'A magical archive has detected an unstable memory fracture.\nThe vault is flickering between preserved truths and dangerous echoes.',
        {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#cbd5e1',
          align: 'center',
          wordWrap: { width: width - 80 },
        },
      )
      .setOrigin(0.5);

    const continueButton = this.add
      .text(width / 2, height * 0.68, 'Continue', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    continueButton.on('pointerdown', () => {
      this.scene.start(DialogueScene.key);
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start(DialogueScene.key));
    this.input.keyboard?.on('keydown-SPACE', () => this.scene.start(DialogueScene.key));
  }
}
