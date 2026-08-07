import Phaser from 'phaser';
import { MainMenuScene } from './MainMenuScene';
import { ChapterIntroScene } from './ChapterIntroScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import {
  calculateSceneShellLayout,
  publishSceneShellDiagnostics,
  type SceneShellLayout,
} from '../presentation/sceneShellLayout';

export class MultiverseMapScene extends Phaser.Scene {
  public static readonly key = 'MultiverseMapScene';
  private readonly flowController = getSharedGameFlowController();
  private uiRoot: Phaser.GameObjects.Container | null = null;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;

  public constructor() {
    super(MultiverseMapScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('multiverse-map');
    markBrowserTestScene('multiverse-map');
    this.cameras.main.setBackgroundColor('#020617');
    this.buildUi();
    this.resizeHandler = () => this.buildUi();
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

    const state = this.flowController.getState();
    const chapterStatus = state.chapterStatus['fantasy-chapter']?.status ?? 'available';
    const lastOutcome = state.chapterStatus['fantasy-chapter']?.lastOutcome;
    const chapterSummary =
      lastOutcome === 'failed' && state.latestPuzzleResult
        ? 'Complicated'
        : chapterStatus === 'completed'
          ? 'Completed'
          : chapterStatus === 'in-progress'
            ? 'In progress'
            : 'Available';

    const title = this.add
      .text(shell.contentCenterX, shell.safeY + 4, 'Multiverse Map', {
        fontFamily: 'monospace',
        fontSize: `${shell.titleFontSize}px`,
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: shell.titleWrapWidth },
      })
      .setOrigin(0.5, 0);

    const status = this.add
      .text(
        shell.contentCenterX,
        title.y + title.height + shell.gutter,
        `Fantasy chapter status: ${chapterSummary}`,
        {
          fontFamily: 'monospace',
          fontSize: `${shell.subtitleFontSize}px`,
          color: '#7dd3fc',
          align: 'center',
          wordWrap: { width: shell.bodyWrapWidth },
        },
      )
      .setOrigin(0.5, 0);

    const cardsTop = status.y + status.height + shell.gutter * 1.5;
    const cardWidth = shell.stackCards
      ? Math.min(shell.safeWidth, 320)
      : Math.min(220, shell.safeWidth * 0.42);
    // Leave room for enter + locked card + back control on short phones.
    const cardHeight = shell.stackCards
      ? Math.min(
          120,
          Math.max(88, Math.floor((shell.safeY + shell.safeHeight - cardsTop - 120) / 2)),
        )
      : 140;

    // Desktop ratios stay near the historical 0.28 / 0.72 shell so neighboring tests remain stable.
    const fantasyCenterX = shell.stackCards ? shell.contentCenterX : shell.viewportWidth * 0.28;
    const cyberCenterX = shell.stackCards ? shell.contentCenterX : shell.viewportWidth * 0.72;
    const fantasyCenterY = shell.stackCards
      ? cardsTop + cardHeight / 2
      : shell.viewportHeight * 0.46;
    const cyberCenterY = shell.stackCards
      ? fantasyCenterY + cardHeight + shell.gutter + 36 + cardHeight / 2
      : fantasyCenterY;

    this.uiRoot.add(title);
    this.uiRoot.add(status);
    this.drawChapterCard(shell, fantasyCenterX, fantasyCenterY, cardWidth, cardHeight, {
      title: 'Fantasy',
      subtitle: 'Archive fracture',
      locked: false,
    });
    this.drawChapterCard(shell, cyberCenterX, cyberCenterY, cardWidth, cardHeight, {
      title: 'Cyberpunk',
      subtitle: 'Locked for Phase 2A',
      locked: true,
    });

    // Keep Enter clearly under the Fantasy card and above the locked card / back control.
    const enterY = shell.stackCards
      ? Math.min(
          fantasyCenterY + cardHeight / 2 + Math.max(26, shell.minTouch / 2 + 4),
          Math.max(
            fantasyCenterY + cardHeight / 2 + 24,
            (fantasyCenterY + cardHeight / 2 + (cyberCenterY - cardHeight / 2)) / 2,
          ),
        )
      : shell.viewportHeight * 0.56;
    const fantasyButton = this.add
      .text(fantasyCenterX, enterY, 'Enter Fantasy Chapter', {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: shell.buttonPadX, y: Math.max(shell.buttonPadY, 12) },
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth },
      })
      .setOrigin(0.5);
    const enterBounds = fantasyButton.getBounds();
    const hitW = Math.max(shell.minTouch * 2.4, enterBounds.width + 12);
    const hitH = Math.max(shell.minTouch, enterBounds.height + 8);
    fantasyButton.setInteractive(
      new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
      Phaser.Geom.Rectangle.Contains,
    );
    let entering = false;
    fantasyButton.on('pointerdown', () => {
      fantasyButton.setAlpha(0.82);
      if (entering) return;
      entering = true;
      this.flowController.advanceTo('fantasy-chapter-intro');
      this.scene.start(ChapterIntroScene.key);
    });
    fantasyButton.on('pointerup', () => fantasyButton.setAlpha(1));
    fantasyButton.on('pointerout', () => fantasyButton.setAlpha(1));

    const backY = shell.safeY + shell.safeHeight - shell.minTouch / 2;
    const backButton = this.add
      .text(shell.contentCenterX, backY, 'Back to Main Menu', {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#f8fafc',
        backgroundColor: '#0f766e',
        padding: { x: shell.buttonPadX, y: Math.max(shell.buttonPadY, 12) },
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth },
      })
      .setOrigin(0.5);
    const backBounds = backButton.getBounds();
    backButton.setInteractive(
      new Phaser.Geom.Rectangle(
        -Math.max(shell.minTouch * 2.2, backBounds.width + 12) / 2,
        -Math.max(shell.minTouch, backBounds.height + 8) / 2,
        Math.max(shell.minTouch * 2.2, backBounds.width + 12),
        Math.max(shell.minTouch, backBounds.height + 8),
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    backButton.on('pointerdown', () => {
      this.flowController.resetProgress();
      this.scene.start(MainMenuScene.key);
    });

    this.uiRoot.add([fantasyButton, backButton]);

    // Publish enter-button ratio for focused tests (presentation-only).
    const statusEl = document.getElementById('storycrush-test-status');
    statusEl?.setAttribute(
      'data-map-enter-ratio',
      `${(fantasyCenterX / shell.viewportWidth).toFixed(3)},${(enterY / shell.viewportHeight).toFixed(3)}`,
    );
  }

  private drawChapterCard(
    shell: SceneShellLayout,
    x: number,
    y: number,
    width: number,
    height: number,
    card: { title: string; subtitle: string; locked: boolean },
  ): void {
    const fill = card.locked ? 0x334155 : 0x1d4ed8;
    const stroke = card.locked ? 0x64748b : 0x93c5fd;
    const rect = this.add.rectangle(x, y, width, height, fill, 0.95).setStrokeStyle(2, stroke);
    const title = this.add
      .text(x, y - 18, card.title, {
        fontFamily: 'monospace',
        fontSize: `${shell.subtitleFontSize + 4}px`,
        color: card.locked ? '#e2e8f0' : '#eff6ff',
        align: 'center',
        wordWrap: { width: width - 24 },
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(x, y + 16, card.subtitle, {
        fontFamily: 'monospace',
        fontSize: `${shell.bodyFontSize}px`,
        color: card.locked ? '#cbd5e1' : '#bfdbfe',
        align: 'center',
        wordWrap: { width: width - 24 },
      })
      .setOrigin(0.5);
    this.uiRoot?.add([rect, title, subtitle]);
  }
}
