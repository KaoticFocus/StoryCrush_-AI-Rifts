import Phaser from 'phaser';
import { PuzzleScene } from './PuzzleScene';
import {
  getSharedGameFlowController,
  createPrototypeCampaignDefinition,
} from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import { createBrowserSeedProvider } from '../presentation/browserSeedProvider';
import { type PuzzleLaunchContext } from '../content/levelRun';
import {
  calculateSceneShellLayout,
  publishSceneShellDiagnostics,
} from '../presentation/sceneShellLayout';

export class StoryChoiceScene extends Phaser.Scene {
  public static readonly key = 'StoryChoiceScene';
  private readonly flowController = getSharedGameFlowController();
  private readonly seedProvider = createBrowserSeedProvider();
  private uiRoot: Phaser.GameObjects.Container | null = null;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;
  private transitionLocked = false;

  public constructor() {
    super(StoryChoiceScene.key);
  }

  public create(): void {
    this.transitionLocked = false;
    this.flowController.advanceTo('fantasy-choice');
    markBrowserTestScene('story-choice');
    this.cameras.main.setBackgroundColor('#020617');
    this.buildUi();
    this.resizeHandler = () => {
      if (this.transitionLocked) return;
      this.buildUi();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
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
      .text(shell.contentCenterX, shell.safeY + 4, 'Choose the Archive Response', {
        fontFamily: 'monospace',
        fontSize: `${shell.titleFontSize}px`,
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: shell.titleWrapWidth },
      })
      .setOrigin(0.5, 0);

    const choices = createPrototypeCampaignDefinition().chapters[0]?.availableChoices ?? [];
    const startY = title.y + title.height + shell.gutter * 1.5;
    const availableHeight = shell.safeY + shell.safeHeight - startY;
    const slotHeight = Math.max(
      shell.minTouch + 12,
      Math.min(72, Math.floor(availableHeight / Math.max(1, choices.length))),
    );

    const panelHeight = Math.min(
      shell.safeHeight * 0.55,
      slotHeight * choices.length + shell.gutter * 2,
    );
    const panel = this.add
      .rectangle(
        shell.contentCenterX,
        startY + panelHeight / 2,
        shell.bodyWrapWidth,
        panelHeight,
        0x0f172a,
        0.95,
      )
      .setStrokeStyle(2, 0x38bdf8);
    this.uiRoot.add([title, panel]);

    const firstChoiceRatioY: number[] = [];
    choices.forEach((choice, index) => {
      const preferredY = shell.viewportHeight * (0.34 + index * 0.09);
      const stackedY = startY + shell.gutter + index * slotHeight + slotHeight / 2;
      const y = shell.stackCards
        ? stackedY
        : Math.min(
            shell.safeY + shell.safeHeight - shell.minTouch / 2,
            Math.max(startY + shell.minTouch / 2, preferredY),
          );

      const button = this.add
        .text(shell.contentCenterX, y, choice.label, {
          fontFamily: 'monospace',
          fontSize: `${shell.buttonFontSize}px`,
          color: '#f8fafc',
          backgroundColor: '#1d4ed8',
          padding: { x: shell.buttonPadX, y: Math.max(shell.buttonPadY, 12) },
          align: 'center',
          wordWrap: { width: shell.bodyWrapWidth - 24 },
        })
        .setOrigin(0.5);
      const bounds = button.getBounds();
      const hitW = Math.max(shell.minTouch * 2.4, Math.min(shell.bodyWrapWidth, bounds.width + 16));
      const hitH = Math.max(shell.minTouch, bounds.height + 8);
      button.setInteractive(
        new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
        Phaser.Geom.Rectangle.Contains,
      );
      button.on('pointerdown', () => {
        button.setAlpha(0.82);
        button.setStyle({ backgroundColor: '#1e40af' });
        this.selectChoice(choice.id);
      });
      button.on('pointerup', () => button.setAlpha(1));
      button.on('pointerout', () => button.setAlpha(1));
      this.uiRoot?.add(button);
      if (index === 0) {
        firstChoiceRatioY.push(y / shell.viewportHeight);
      }
    });

    document
      .getElementById('storycrush-test-status')
      ?.setAttribute(
        'data-primary-action-ratio',
        `0.5,${(firstChoiceRatioY[0] ?? 0.34).toFixed(3)}`,
      );
  }

  private selectChoice(choiceId: string): void {
    if (this.transitionLocked) return;
    const result = this.flowController.chooseStoryOption(choiceId);
    if (!result.ok) return;
    this.transitionLocked = true;
    this.flowController.advanceTo('puzzle');
    const run = { levelId: 'archive-stabilization', seed: this.seedProvider.nextSeed() };
    this.flowController.recordActiveLevelRun(run);
    const context: PuzzleLaunchContext = { mode: 'campaign', run };
    this.scene.start(PuzzleScene.key, context);
  }
}
