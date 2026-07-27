import Phaser from 'phaser';
import { PuzzleScene } from './PuzzleScene';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';

export class MainMenuScene extends Phaser.Scene {
  public static readonly key = 'MainMenuScene';

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
      .text(width / 2, height * 0.24, 'StoryCrush: AI Rifts', {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.34, 'Playable Prototype', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#7dd3fc',
      })
      .setOrigin(0.5);

    const playButton = this.add
      .text(width / 2, height * 0.5, 'Play Prototype', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#eff6ff',
        backgroundColor: '#1d4ed8',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playButton.on('pointerover', () => {
      playButton.setStyle({ backgroundColor: '#2563eb' });
    });
    playButton.on('pointerout', () => {
      playButton.setStyle({ backgroundColor: '#1d4ed8' });
    });
    playButton.on('pointerdown', () => {
      this.scene.start(PuzzleScene.key);
    });

    this.add.circle(width / 2, height * 0.7, 12, 0x22c55e);

    this.add
      .text(
        width / 2,
        height * 0.66,
        'Controls: tap or click one cell, then an adjacent cell to submit a move.\nBoard updates immediately after accepted swaps.',
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#cbd5e1',
          align: 'center',
        },
      )
      .setOrigin(0.5);
  }
}
