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

  public constructor() {
    super(MainMenuScene.key);
  }

  public create(): void {
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      markBrowserTestScene('main-menu');
    });
    markBrowserTestScene('main-menu');
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#020617');

    this.add
      .text(width / 2, height * 0.2, 'StoryCrush: AI Rifts', {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.28, 'Phase 2A Game Shell', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#7dd3fc',
      })
      .setOrigin(0.5);

    const playPuzzleButton = this.add
      .text(width / 2, height * 0.5, 'Puzzle Lab', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#eff6ff',
        backgroundColor: '#0f766e',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

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

    const newGameButton = this.add
      .text(width / 2, height * 0.6, 'New Game', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#eff6ff',
        backgroundColor: '#1d4ed8',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const persistedStatus = getSharedPersistenceStatus();
    const sessionStatus = getSharedGameFlowPersistenceCoordinator().getSessionStatus();
    this.hasExistingSave = Boolean(sessionStatus.savePresent);

    newGameButton.on('pointerdown', () => {
      this.requestNewGame();
    });

    this.canContinue = sessionStatus.canContinue;
    const continueButton = this.add
      .text(width / 2, height * 0.7, 'Continue', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e2e8f0',
        backgroundColor: '#334155',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setAlpha(this.canContinue ? 1 : 0.6);

    if (this.canContinue) {
      continueButton.setInteractive({ useHandCursor: true });
      continueButton.on('pointerdown', () => {
        this.resumeFlowFromState();
      });
    }

    this.persistenceStatusText = this.add
      .text(width / 2, height * 0.84, this.getPersistenceMessage(persistedStatus), {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fef3c7',
        align: 'center',
        wordWrap: { width: width * 0.8 },
      })
      .setOrigin(0.5);

    this.add.circle(width / 2, height * 0.78, 12, 0x22c55e);

    this.registerKeyboardControls();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }
      this.setConfirmationStatus(false);
    });
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
    const { width, height } = this.scale;
    const panel = this.add.container(width / 2, height * 0.5);
    const background = this.add.rectangle(0, 0, width * 0.8, height * 0.3, 0x020617, 0.96);
    background.setStrokeStyle(2, 0x38bdf8);
    const title = this.add
      .text(0, -32, 'Replace saved progress?', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8fafc',
        align: 'center',
      })
      .setOrigin(0.5);
    const message = this.add
      .text(0, 8, 'Starting a new game will replace your current save.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: width * 0.7 },
      })
      .setOrigin(0.5);
    const cancelButton = this.add
      .text(-70, 56, 'Cancel', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f8fafc',
        backgroundColor: '#334155',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const confirmButton = this.add
      .text(70, 56, 'Start New Game', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f8fafc',
        backgroundColor: '#dc2626',
        padding: { x: 16, y: 8 },
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
