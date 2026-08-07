/* global KeyboardEvent */
import Phaser from 'phaser';
import { PuzzleScene } from './PuzzleScene';
import { PuzzleLabScene } from './PuzzleLabScene';
import { MultiverseMapScene } from './MultiverseMapScene';
import { ChapterIntroScene } from './ChapterIntroScene';
import { DialogueScene } from './DialogueScene';
import { StoryChoiceScene } from './StoryChoiceScene';
import { ResultsScene } from './ResultsScene';
import { ConsequenceScene } from './ConsequenceScene';
import {
  createPrototypeCampaignDefinition,
  getSharedGameFlowController,
  resolveGameFlowResumeState,
  type GameFlowNodeId,
} from '../flow/gameFlowController';
import {
  getSharedGameFlowPersistenceCoordinator,
  getSharedPersistenceStatus,
} from '../flow/gameFlowPersistenceCoordinator';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import { createBrowserSeedProvider } from '../presentation/browserSeedProvider';
import { parsePlaytestLaunch } from '../content/playtestLaunch';
import { type PuzzleLaunchContext } from '../content/levelRun';
import {
  calculateSceneShellLayout,
  publishSceneShellDiagnostics,
  type SceneShellLayout,
} from '../presentation/sceneShellLayout';

export class MainMenuScene extends Phaser.Scene {
  public static readonly key = 'MainMenuScene';
  private readonly flowController = getSharedGameFlowController();
  private readonly seedProvider = createBrowserSeedProvider();

  private persistenceStatusText: Phaser.GameObjects.Text | null = null;
  private confirmationContainer: Phaser.GameObjects.Container | null = null;
  private confirmationVisible = false;
  private hasExistingSave = false;
  private canContinue = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private uiRoot: Phaser.GameObjects.Container | null = null;
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;

  public constructor() {
    super(MainMenuScene.key);
  }

  public create(): void {
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      markBrowserTestScene('main-menu');
    });
    markBrowserTestScene('main-menu');
    this.cameras.main.setBackgroundColor('#020617');

    const persistedStatus = getSharedPersistenceStatus();
    const sessionStatus = getSharedGameFlowPersistenceCoordinator().getSessionStatus();
    this.hasExistingSave = Boolean(sessionStatus.savePresent);
    this.canContinue = sessionStatus.canContinue;

    this.buildUi(persistedStatus);
    this.resizeHandler = () => {
      if (this.confirmationVisible) {
        this.closeNewGameConfirmation(false);
      }
      this.buildUi(getSharedPersistenceStatus());
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);

    this.registerKeyboardControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }
      if (this.resizeHandler) {
        this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
        this.resizeHandler = null;
      }
      this.setConfirmationStatus(false);
    });
  }

  private buildUi(persistedStatus: ReturnType<typeof getSharedPersistenceStatus>): void {
    this.uiRoot?.destroy(true);
    this.uiRoot = this.add.container(0, 0);
    const shell = calculateSceneShellLayout({
      width: this.scale.width,
      height: this.scale.height,
    });
    publishSceneShellDiagnostics(shell);

    const title = this.add
      .text(shell.contentCenterX, shell.safeY + shell.titleFontSize, 'StoryCrush: AI Rifts', {
        fontFamily: 'monospace',
        fontSize: `${shell.titleFontSize}px`,
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: shell.titleWrapWidth },
      })
      .setOrigin(0.5, 0);

    const subtitle = this.add
      .text(shell.contentCenterX, title.y + title.height + shell.gutter, 'Phase 2A Game Shell', {
        fontFamily: 'monospace',
        fontSize: `${shell.subtitleFontSize}px`,
        color: '#7dd3fc',
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth },
      })
      .setOrigin(0.5, 0);

    const buttonStep = Math.max(shell.minTouch + 10, 56);
    const preferredNewGameY = shell.viewportHeight * 0.6;
    const minNewGameY = subtitle.y + subtitle.height + buttonStep + shell.gutter;
    const maxNewGameY = shell.safeY + shell.safeHeight - buttonStep * 2 - shell.minTouch;
    const newGameY = Math.min(maxNewGameY, Math.max(minNewGameY, preferredNewGameY));
    const continueY = newGameY + buttonStep;
    const puzzleLabY = newGameY - buttonStep;
    const statusY = Math.min(
      shell.safeY + shell.safeHeight - shell.bodyFontSize,
      continueY + buttonStep + 8,
    );

    const playPuzzleButton = this.createShellButton(
      shell,
      shell.contentCenterX,
      puzzleLabY,
      'Puzzle Lab',
      '#0f766e',
    );
    playPuzzleButton.on('pointerup', () => {
      const query = new window.URLSearchParams(window.location.search);
      if (query.get('e2e') === '1' && (query.get('fixture') || query.get('scenario'))) {
        const context: PuzzleLaunchContext = {
          mode: 'browser-fixture',
          fixtureId: query.get('fixture') ?? query.get('scenario') ?? 'fixture',
        };
        this.scene.start(PuzzleScene.key, context);
        return;
      }
      const playtestRun = parsePlaytestLaunch(window.location.search);
      if (playtestRun) {
        const context: PuzzleLaunchContext = {
          mode: 'puzzle-lab',
          run: playtestRun,
          playtest: true,
        };
        this.scene.start(PuzzleScene.key, context);
        return;
      }
      this.scene.start(PuzzleLabScene.key);
    });

    const newGameButton = this.createShellButton(
      shell,
      shell.contentCenterX,
      newGameY,
      'New Game',
      '#1d4ed8',
    );
    newGameButton.on('pointerdown', () => {
      this.requestNewGame();
    });

    const continueButton = this.createShellButton(
      shell,
      shell.contentCenterX,
      continueY,
      'Continue',
      '#334155',
    );
    continueButton.setAlpha(this.canContinue ? 1 : 0.55);
    if (this.canContinue) {
      continueButton.on('pointerdown', () => {
        this.resumeFlowFromState();
      });
    } else {
      continueButton.disableInteractive();
    }

    this.persistenceStatusText = this.add
      .text(shell.contentCenterX, statusY, this.getPersistenceMessage(persistedStatus), {
        fontFamily: 'monospace',
        fontSize: `${Math.max(12, shell.bodyFontSize - 2)}px`,
        color: '#fef3c7',
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth },
      })
      .setOrigin(0.5, 1);

    this.uiRoot.add([
      title,
      subtitle,
      playPuzzleButton,
      newGameButton,
      continueButton,
      this.persistenceStatusText,
    ]);

    // Presentation diagnostics for focused journey tests — not authoritative.
    const statusEl = document.getElementById('storycrush-test-status');
    statusEl?.setAttribute(
      'data-primary-action-ratio',
      `${(shell.contentCenterX / shell.viewportWidth).toFixed(3)},${(
        newGameY / shell.viewportHeight
      ).toFixed(3)}`,
    );
    statusEl?.setAttribute(
      'data-continue-action-ratio',
      `${(shell.contentCenterX / shell.viewportWidth).toFixed(3)},${(
        continueY / shell.viewportHeight
      ).toFixed(3)}`,
    );
  }

  private createShellButton(
    shell: SceneShellLayout,
    x: number,
    y: number,
    label: string,
    backgroundColor: string,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#eff6ff',
        backgroundColor,
        padding: { x: shell.buttonPadX, y: Math.max(shell.buttonPadY, 12) },
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => button.setAlpha(0.82));
    button.on('pointerup', () => button.setAlpha(1));
    button.on('pointerout', () => button.setAlpha(1));
    return button;
  }

  private requestNewGame(): void {
    if (this.hasExistingSave && !this.confirmationVisible) {
      this.showNewGameConfirmation();
      return;
    }
    this.startNewGame();
  }

  private showNewGameConfirmation(): void {
    if (this.confirmationVisible) {
      return;
    }

    this.confirmationVisible = true;
    this.setConfirmationStatus(true);
    this.announce('Replace saved progress? Press Enter to start a new game or Escape to cancel.');
    const shell = calculateSceneShellLayout({
      width: this.scale.width,
      height: this.scale.height,
    });
    const panel = this.add.container(shell.contentCenterX, shell.safeY + shell.safeHeight * 0.5);
    const background = this.add.rectangle(
      0,
      0,
      Math.min(shell.safeWidth, shell.viewportWidth * 0.92),
      Math.max(180, shell.safeHeight * 0.34),
      0x020617,
      0.96,
    );
    background.setStrokeStyle(2, 0x38bdf8);
    const title = this.add
      .text(0, -48, 'Replace saved progress?', {
        fontFamily: 'monospace',
        fontSize: `${shell.subtitleFontSize + 2}px`,
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth * 0.9 },
      })
      .setOrigin(0.5);
    const message = this.add
      .text(0, 0, 'Starting a new game will replace your current save.', {
        fontFamily: 'monospace',
        fontSize: `${shell.bodyFontSize}px`,
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: shell.bodyWrapWidth * 0.85 },
      })
      .setOrigin(0.5);
    const cancelButton = this.add
      .text(-72, 56, 'Cancel', {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#f8fafc',
        backgroundColor: '#334155',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const confirmButton = this.add
      .text(78, 56, 'Start New Game', {
        fontFamily: 'monospace',
        fontSize: `${shell.buttonFontSize}px`,
        color: '#f8fafc',
        backgroundColor: '#dc2626',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    cancelButton.on('pointerdown', () => {
      this.closeNewGameConfirmation();
    });
    confirmButton.on('pointerdown', () => {
      this.closeNewGameConfirmation(false);
      this.startNewGame();
    });

    panel.add([background, title, message, cancelButton, confirmButton]);
    this.confirmationContainer = panel;
  }

  private startNewGame(): void {
    const result = getSharedGameFlowPersistenceCoordinator().replaceWithNewCampaign(() => {
      this.flowController.resetProgress();
      this.flowController.advanceTo('multiverse-map');
    });
    if (!result.ok && result.status !== 'storage-unavailable') {
      this.announce('The existing save could not be replaced. Your saved progress was preserved.');
      return;
    }
    this.scene.start(MultiverseMapScene.key);
  }

  private closeNewGameConfirmation(announceCancellation = true): void {
    if (!this.confirmationVisible) {
      return;
    }
    this.confirmationVisible = false;
    this.confirmationContainer?.destroy(true);
    this.confirmationContainer = null;
    this.setConfirmationStatus(false);
    if (announceCancellation) {
      this.announce('New Game cancelled. Saved progress was preserved.');
    }
  }

  private registerKeyboardControls(): void {
    this.keydownHandler = (event) => {
      if (event.repeat) {
        return;
      }
      if (this.confirmationVisible) {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closeNewGameConfirmation();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.closeNewGameConfirmation(false);
          this.startNewGame();
        }
        return;
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        this.requestNewGame();
      } else if (event.key.toLowerCase() === 'c' && this.canContinue) {
        event.preventDefault();
        this.resumeFlowFromState();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  private announce(message: string): void {
    const statusElement = document.getElementById('storycrush-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  private setConfirmationStatus(visible: boolean): void {
    document
      .getElementById('storycrush-test-status')
      ?.setAttribute('data-confirmation-visible', String(visible));
  }

  private resumeFlowFromState(): void {
    const state = this.flowController.getState();
    const definition = createPrototypeCampaignDefinition();
    const resolved = resolveGameFlowResumeState(state.currentNodeId, state, definition);
    this.flowController.restoreState(resolved.state);
    const sceneForNode = this.getSceneKeyForNode(resolved.state.currentNodeId);
    if (resolved.reason === 'puzzle') {
      this.persistenceStatusText?.setText(
        'Your story progress was restored. The puzzle will restart.',
      );
    }
    if (sceneForNode) {
      if (resolved.reason === 'puzzle') {
        const run = resolved.state.activeLevelRun ?? {
          levelId: 'archive-stabilization',
          seed: this.seedProvider.nextSeed(),
        };
        this.flowController.recordActiveLevelRun(run);
        const context: PuzzleLaunchContext = { mode: 'campaign', run };
        this.announce('Campaign puzzle restored. The same board has been reconstructed.');
        this.scene.start(sceneForNode, context);
        return;
      }
      this.scene.start(sceneForNode);
      return;
    }

    this.flowController.advanceTo('multiverse-map');
    this.scene.start(MultiverseMapScene.key);
  }

  private getPersistenceMessage(status: ReturnType<typeof getSharedPersistenceStatus>): string {
    if (!status) {
      return 'No saved progress yet.';
    }
    switch (status.status) {
      case 'unsupported-version':
        return 'This save was created by a newer version of StoryCrush.';
      case 'invalid-payload':
      case 'corrupt-cleared':
        return 'Corrupt save detected. Your progress was reset.';
      case 'storage-unavailable':
        return 'Progress will last only until this tab is closed.';
      case 'restored':
      case 'saved':
        return 'Saved progress is available.';
      default:
        return 'No saved progress yet.';
    }
  }

  private getSceneKeyForNode(nodeId: GameFlowNodeId): string | null {
    switch (nodeId) {
      case 'multiverse-map':
      case 'return-to-map':
        return MultiverseMapScene.key;
      case 'fantasy-chapter-intro':
        return ChapterIntroScene.key;
      case 'fantasy-dialogue':
        return DialogueScene.key;
      case 'fantasy-choice':
        return StoryChoiceScene.key;
      case 'puzzle':
        return PuzzleScene.key;
      case 'results':
        return ResultsScene.key;
      case 'fantasy-consequence':
        return ConsequenceScene.key;
      case 'main-menu':
      default:
        return null;
    }
  }
}
