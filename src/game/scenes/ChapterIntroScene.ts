import Phaser from 'phaser';
import { DialogueScene } from './DialogueScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import {
  calculateSceneShellLayout,
  publishSceneShellDiagnostics,
} from '../presentation/sceneShellLayout';

export class ChapterIntroScene extends Phaser.Scene {
  public static readonly key = 'ChapterIntroScene';
  private readonly flowController = getSharedGameFlowController();
  private uiRoot: Phaser.GameObjects.Container | null = null;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;
  private advancing = false;

  public constructor() {
    super(ChapterIntroScene.key);
  }

  public create(): void {
    this.advancing = false;
    this.flowController.advanceTo('fantasy-chapter-intro');
    markBrowserTestScene('chapter-intro');
    this.cameras.main.setBackgroundColor('#020617');
    this.buildUi();
    this.resizeHandler = () => this.buildUi();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) {
        this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
        this.resizeHandler = null;
      }
    });
  }

  private buildUi(): void {
    this.uiRoot?.destroy(true);
    this.uiRoot = this.add.container(0, 0);
    const shell = calculateSceneShellLayout({
      width: this.scale.width,
      height: this.scale.height,
    });
    publishSceneShellDiagnostics(shell);

    const title = this.add
      .text(shell.contentCenterX, shell.safeY + 8, 'Fantasy Chapter: The Archive Fracture', {
        fontFamily: 'monospace',
        fontSize: `${shell.titleFontSize}px`,
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: shell.titleWrapWidth },
      })
      .setOrigin(0.5, 0);

    const body = this.add
      .text(
        shell.contentCenterX,
        title.y + title.height + shell.gutter * 1.5,
        'A magical archive has detected an unstable memory fracture.\nThe vault is flickering between preserved truths and dangerous echoes.',
        {
          fontFamily: 'monospace',
          fontSize: `${shell.bodyFontSize}px`,
          color: '#cbd5e1',
          align: 'center',
          wordWrap: { width: shell.bodyWrapWidth },
        },
      )
      .setOrigin(0.5, 0);

    const preferredContinueY = shell.viewportHeight * 0.68;
    const minContinueY = body.y + body.height + shell.gutter + shell.minTouch / 2;
    const maxContinueY = shell.safeY + shell.safeHeight - shell.minTouch / 2;
    const continueY = Math.min(maxContinueY, Math.max(minContinueY, preferredContinueY));
    const continueButton = this.add
      .text(shell.contentCenterX, continueY, 'Continue', {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: shell.buttonPadX, y: Math.max(shell.buttonPadY, 12) },
      })
      .setOrigin(0.5);
    const bounds = continueButton.getBounds();
    continueButton.setInteractive(
      new Phaser.Geom.Rectangle(
        -Math.max(shell.minTouch * 2.2, bounds.width + 12) / 2,
        -Math.max(shell.minTouch, bounds.height + 8) / 2,
        Math.max(shell.minTouch * 2.2, bounds.width + 12),
        Math.max(shell.minTouch, bounds.height + 8),
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    continueButton.on('pointerdown', () => {
      continueButton.setAlpha(0.82);
      this.advance();
    });
    continueButton.on('pointerup', () => continueButton.setAlpha(1));
    continueButton.on('pointerout', () => continueButton.setAlpha(1));

    this.uiRoot.add([title, body, continueButton]);
    document
      .getElementById('storycrush-test-status')
      ?.setAttribute(
        'data-primary-action-ratio',
        `0.5,${(continueY / shell.viewportHeight).toFixed(3)}`,
      );
  }

  private advance(): void {
    if (this.advancing) return;
    this.advancing = true;
    this.scene.start(DialogueScene.key);
  }
}
