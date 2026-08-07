import Phaser from 'phaser';
import { StoryChoiceScene } from './StoryChoiceScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import {
  calculateSceneShellLayout,
  publishSceneShellDiagnostics,
} from '../presentation/sceneShellLayout';

export class DialogueScene extends Phaser.Scene {
  public static readonly key = 'DialogueScene';
  private readonly flowController = getSharedGameFlowController();
  private uiRoot: Phaser.GameObjects.Container | null = null;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;
  private advancing = false;

  public constructor() {
    super(DialogueScene.key);
  }

  public create(): void {
    this.advancing = false;
    this.flowController.advanceTo('fantasy-dialogue');
    markBrowserTestScene('dialogue');
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
      .text(shell.contentCenterX, shell.safeY + 4, 'Archive Dialogue', {
        fontFamily: 'monospace',
        fontSize: `${shell.titleFontSize}px`,
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: shell.titleWrapWidth },
      })
      .setOrigin(0.5, 0);

    const lines = [
      'Archivist: The fracture remembers too much.',
      'Archivist: It wants a witness, not a guardian.',
      'Archivist: Choose carefully, and let the vault answer.',
    ];

    const panelTop = title.y + title.height + shell.gutter;
    const preferredContinueY = shell.viewportHeight * 0.72;
    const continueReserve = shell.minTouch + shell.gutter;
    const panelMaxBottom = Math.min(
      preferredContinueY - continueReserve,
      shell.safeY + shell.safeHeight - continueReserve,
    );
    const panelHeight = Math.max(140, panelMaxBottom - panelTop);
    const panelWidth = shell.bodyWrapWidth;
    const panel = this.add
      .rectangle(
        shell.contentCenterX,
        panelTop + panelHeight / 2,
        panelWidth,
        panelHeight,
        0x0f172a,
        0.95,
      )
      .setStrokeStyle(2, 0x38bdf8);

    const speaker = this.add
      .text(shell.safeX + 12, panelTop + 10, 'Archivist', {
        fontFamily: 'monospace',
        fontSize: `${shell.subtitleFontSize}px`,
        color: '#7dd3fc',
      })
      .setOrigin(0, 0);

    let lineY = speaker.y + speaker.height + 8;
    const lineTexts: Phaser.GameObjects.Text[] = [];
    for (const line of lines) {
      const text = this.add
        .text(shell.contentCenterX, lineY, line, {
          fontFamily: 'monospace',
          fontSize: `${shell.bodyFontSize}px`,
          color: '#e2e8f0',
          align: 'center',
          wordWrap: { width: panelWidth - 28 },
        })
        .setOrigin(0.5, 0);
      lineTexts.push(text);
      lineY += text.height + 6;
    }

    const minContinueY = Math.max(
      panelTop + panelHeight + shell.gutter + shell.minTouch / 2,
      lineY + shell.gutter + shell.minTouch / 2,
    );
    const maxContinueY = shell.safeY + shell.safeHeight - shell.minTouch / 2;
    const continueY = Math.min(maxContinueY, Math.max(minContinueY, preferredContinueY));

    const continueButton = this.add
      .text(shell.contentCenterX, continueY, 'Continue to Choice', {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: shell.buttonPadX, y: Math.max(shell.buttonPadY, 12) },
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth },
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

    this.uiRoot.add([panel, title, speaker, ...lineTexts, continueButton]);
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
    this.scene.start(StoryChoiceScene.key);
  }
}
