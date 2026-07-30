import Phaser from 'phaser';
import { PuzzleScene } from './PuzzleScene';
import { MultiverseMapScene } from './MultiverseMapScene';
import { ChapterIntroScene } from './ChapterIntroScene';
import { DialogueScene } from './DialogueScene';
import { StoryChoiceScene } from './StoryChoiceScene';
import { ResultsScene } from './ResultsScene';
import { ConsequenceScene } from './ConsequenceScene';
import { getSharedGameFlowController, type GameFlowNodeId } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class MainMenuScene extends Phaser.Scene {
  public static readonly key = 'MainMenuScene';
  private readonly flowController = getSharedGameFlowController();

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

    newGameButton.on('pointerdown', () => {
      this.flowController.resetProgress();
      this.flowController.advanceTo('multiverse-map');
      this.scene.start(MultiverseMapScene.key);
    });

    const continueState = this.flowController.getState();
    const canContinue =
      continueState.hasContinuableSession || Boolean(continueState.latestPuzzleResult);
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

  private resumeFlowFromState(): void {
    const state = this.flowController.getState();
    const sceneForNode = this.getSceneKeyForNode(state.currentNodeId);
    if (sceneForNode) {
      this.scene.start(sceneForNode);
      return;
    }

    this.flowController.advanceTo('multiverse-map');
    this.scene.start(MultiverseMapScene.key);
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
