import Phaser from 'phaser';
import { PuzzleScene } from './PuzzleScene';
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

export class MainMenuScene extends Phaser.Scene {
  public static readonly key = 'MainMenuScene';
  private readonly flowController = getSharedGameFlowController();

  private persistenceStatusText: Phaser.GameObjects.Text | null = null;
  private confirmationContainer: Phaser.GameObjects.Container | null = null;
  private confirmationVisible = false;

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

    playPuzzleButton.on('pointerdown', () => {
      this.scene.start(PuzzleScene.key, { campaignMode: false });
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
    const hasExistingSave = Boolean(
      persistedStatus &&
      persistedStatus.status !== 'not-found' &&
      persistedStatus.status !== 'cleared',
    );

    newGameButton.on('pointerdown', () => {
      if (hasExistingSave && !this.confirmationVisible) {
        this.showNewGameConfirmation();
        return;
      }
      this.startNewGame();
    });

    const continueState = this.flowController.getState();
    const canContinue =
      continueState.hasContinuableSession ||
      Boolean(continueState.latestPuzzleResult) ||
      persistedStatus?.status === 'restored';
    const continueButton = this.add
      .text(width / 2, height * 0.7, 'Continue', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e2e8f0',
        backgroundColor: '#334155',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setAlpha(canContinue ? 1 : 0.6);

    if (canContinue) {
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

    this.add
      .text(
        width / 2,
        height * 0.76,
        'Fantasy chapter: archive fracture.\nComplete the shell flow to reach the consequence scene.',
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#cbd5e1',
          align: 'center',
        },
      )
      .setOrigin(0.5);
  }

  private showNewGameConfirmation(): void {
    if (this.confirmationVisible) {
      return;
    }

    this.confirmationVisible = true;
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
      this.confirmationVisible = false;
      panel.destroy(true);
    });
    confirmButton.on('pointerdown', () => {
      this.confirmationVisible = false;
      panel.destroy(true);
      this.startNewGame();
    });

    panel.add([background, title, message, cancelButton, confirmButton]);
    this.confirmationContainer = panel;
  }

  private startNewGame(): void {
    this.flowController.resetProgress();
    getSharedGameFlowPersistenceCoordinator().clear();
    this.flowController.advanceTo('multiverse-map');
    this.scene.start(MultiverseMapScene.key);
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
