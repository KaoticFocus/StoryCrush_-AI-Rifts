import Phaser from 'phaser';
import { MainMenuScene } from './MainMenuScene';
import { ChapterIntroScene } from './ChapterIntroScene';
import { getSharedGameFlowController } from '../flow/gameFlowController';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class MultiverseMapScene extends Phaser.Scene {
  public static readonly key = 'MultiverseMapScene';
  private readonly flowController = getSharedGameFlowController();

  public constructor() {
    super(MultiverseMapScene.key);
  }

  public create(): void {
    this.flowController.advanceTo('multiverse-map');
    markBrowserTestScene('multiverse-map');
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#020617');

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

    this.add
      .text(width / 2, height * 0.16, 'Multiverse Map', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.24, `Fantasy chapter status: ${chapterSummary}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#7dd3fc',
      })
      .setOrigin(0.5);

    this.add
      .rectangle(width * 0.28, height * 0.46, 220, 140, 0x1d4ed8, 0.95)
      .setStrokeStyle(2, 0x93c5fd);
    this.add
      .text(width * 0.28, height * 0.43, 'Fantasy', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#eff6ff',
      })
      .setOrigin(0.5);
    this.add
      .text(width * 0.28, height * 0.48, 'Archive fracture', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#bfdbfe',
      })
      .setOrigin(0.5);

    const fantasyButton = this.add
      .text(width * 0.28, height * 0.56, 'Enter Fantasy Chapter', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8fafc',
        backgroundColor: '#2563eb',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    fantasyButton.on('pointerdown', () => {
      this.flowController.advanceTo('fantasy-chapter-intro');
      this.scene.start(ChapterIntroScene.key);
    });

    this.add
      .rectangle(width * 0.72, height * 0.46, 220, 140, 0x334155, 0.95)
      .setStrokeStyle(2, 0x64748b);
    this.add
      .text(width * 0.72, height * 0.43, 'Cyberpunk', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);
    this.add
      .text(width * 0.72, height * 0.48, 'Locked for Phase 2A', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    const backButton = this.add
      .text(width / 2, height * 0.76, 'Back to Main Menu', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f8fafc',
        backgroundColor: '#0f766e',
        padding: { x: 14, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.flowController.resetProgress();
      this.scene.start(MainMenuScene.key);
    });
  }
}
