import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  public static readonly key = 'MainMenuScene';

  public constructor() {
    super(MainMenuScene.key);
  }

  public create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.38, 'StoryCrush: AI Rifts', {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.5, 'Foundation Build', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#7dd3fc',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.6, 'Phaser initialized successfully', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#86efac',
      })
      .setOrigin(0.5);

    this.add.circle(width / 2, height * 0.7, 12, 0x22c55e);
  }
}
