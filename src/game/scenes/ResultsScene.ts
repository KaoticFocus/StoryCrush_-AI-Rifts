import Phaser from 'phaser';
import { ConsequenceScene } from './ConsequenceScene';
import {
  createPrototypeCampaignDefinition,
  getSharedGameFlowController,
} from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import {
  calculateSceneShellLayout,
  publishSceneShellDiagnostics,
} from '../presentation/sceneShellLayout';
import { publishViewportDiagnostics } from '../presentation/viewportAuthority';

export class ResultsScene extends Phaser.Scene {
  public static readonly key = 'ResultsScene';
  private readonly flowController = getSharedGameFlowController();
  private uiRoot: Phaser.GameObjects.Container | null = null;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;
  private advancing = false;

  public constructor() {
    super(ResultsScene.key);
  }

  public create(): void {
    this.advancing = false;
    this.flowController.advanceTo('results');
    markBrowserTestScene('results');
    this.cameras.main.setBackgroundColor('#020617');
    this.buildUi();
    this.resizeHandler = () => this.buildUi();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
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
    publishViewportDiagnostics(this.game);

    const state = this.flowController.getState();
    const result = state.latestPuzzleResult;
    const outcome = result?.outcome ?? 'failed';
    const score = result?.score ?? 0;
    const movesRemaining = result?.movesRemaining ?? 0;
    const selectedChoice = createPrototypeCampaignDefinition().chapters[0]?.availableChoices.find(
      (choice) => state.storyFlags.includes(choice.flag),
    );

    const title = this.add
      .text(
        shell.contentCenterX,
        shell.safeY + 8,
        outcome === 'won' ? 'Puzzle Success' : 'Puzzle Failure',
        {
          fontFamily: 'monospace',
          fontSize: `${shell.titleFontSize}px`,
          color: '#f8fafc',
          align: 'center',
          wordWrap: { width: shell.titleWrapWidth },
        },
      )
      .setOrigin(0.5, 0);

    const body = this.add
      .text(
        shell.contentCenterX,
        title.y + title.height + shell.gutter * 1.5,
        `Final score: ${score}\nMoves remaining: ${movesRemaining}\nObjective completed: ${
          result?.objectiveCompleted ? 'yes' : 'no'
        }\n\nChoice recorded: ${selectedChoice?.label ?? 'none'}\nFlag: ${
          state.storyFlags.join(', ') || 'none'
        }`,
        {
          fontFamily: 'monospace',
          fontSize: `${shell.bodyFontSize}px`,
          color: '#cbd5e1',
          align: 'center',
          wordWrap: { width: shell.bodyWrapWidth },
        },
      )
      .setOrigin(0.5, 0);

    const preferredY = shell.viewportHeight * 0.72;
    const minY = body.y + body.height + shell.gutter + shell.minTouch / 2;
    const maxY = shell.safeY + shell.safeHeight - shell.minTouch / 2;
    const continueY = Math.min(maxY, Math.max(minY, preferredY));
    const continueButton = this.add
      .text(shell.contentCenterX, continueY, 'Continue to Consequence', {
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
    const hitW = Math.max(shell.minTouch * 2.4, bounds.width + 12);
    const hitH = Math.max(shell.minTouch, bounds.height + 8);
    continueButton.setInteractive(
      new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
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
        `${(shell.contentCenterX / shell.viewportWidth).toFixed(3)},${(
          continueY / shell.viewportHeight
        ).toFixed(3)}`,
      );
  }

  private advance(): void {
    if (this.advancing) return;
    this.advancing = true;
    this.flowController.advanceTo('fantasy-consequence');
    this.scene.start(ConsequenceScene.key);
  }
}
