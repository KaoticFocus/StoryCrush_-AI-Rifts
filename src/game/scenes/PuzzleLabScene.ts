/* global HTMLButtonElement, HTMLDivElement, KeyboardEvent */
import Phaser from 'phaser';
import {
  getObjectiveSummary,
  playableLevelCatalog,
  type PlayableLevelContent,
} from '../content/levelCatalog';
import { type PuzzleLaunchContext } from '../content/levelRun';
import { createBrowserSeedProvider } from '../presentation/browserSeedProvider';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import { MainMenuScene } from './MainMenuScene';
import { PuzzleScene } from './PuzzleScene';

export class PuzzleLabScene extends Phaser.Scene {
  public static readonly key = 'PuzzleLabScene';
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private levelControls: HTMLDivElement | null = null;
  private readonly seedProvider = createBrowserSeedProvider();

  public constructor() {
    super(PuzzleLabScene.key);
  }

  public create(): void {
    markBrowserTestScene('puzzle-lab');
    const { width, height } = this.scale;
    const portrait = width < height;
    this.cameras.main.setBackgroundColor('#07131f');

    this.add
      .text(width / 2, portrait ? 30 : 28, 'Puzzle Lab', {
        fontFamily: 'monospace',
        fontSize: portrait ? '24px' : '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    playableLevelCatalog.forEach((content, index) => {
      this.createLevelCard(content, index, portrait);
    });
    this.createLevelControls(portrait);

    this.add
      .text(width / 2, height - 20, 'Back to Main Menu', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f8fafc',
        backgroundColor: '#334155',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start(MainMenuScene.key));

    this.keydownHandler = (event) => {
      if (event.repeat) return;
      if (event.key === 'Escape') {
        this.scene.start(MainMenuScene.key);
        return;
      }
      const index = Number(event.key) - 1;
      const content = playableLevelCatalog[index];
      if (content) this.launchLevel(content);
    };
    document.addEventListener('keydown', this.keydownHandler);
    this.resizeHandler = () => this.layoutLevelControls(this.scale.width < this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
      if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
      this.resizeHandler = null;
      this.levelControls?.remove();
      this.levelControls = null;
    });
  }

  private createLevelControls(portrait: boolean): void {
    this.levelControls?.remove();
    const controls = document.createElement('div');
    controls.className = 'puzzle-lab-level-controls';
    controls.setAttribute('aria-label', 'Puzzle Lab levels');
    playableLevelCatalog.forEach((content) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'puzzle-lab-level-control';
      control.setAttribute('aria-label', `Play ${content.title}`);
      control.addEventListener('click', () => this.launchLevel(content));
      controls.append(control);
    });
    document.getElementById('game-root')?.append(controls);
    this.levelControls = controls;
    this.layoutLevelControls(portrait);
  }

  private layoutLevelControls(portrait: boolean): void {
    if (!this.levelControls) return;
    const { width, height } = this.scale;
    const margin = portrait ? 16 : 20;
    const gap = portrait ? 10 : 14;
    const cardWidth = portrait ? width - margin * 2 : (width - margin * 2 - gap * 2) / 3;
    const cardHeight = portrait ? (height - 116 - gap * 2) / 3 : height - 112;
    Array.from(this.levelControls.children).forEach((element, index) => {
      const control = element as HTMLButtonElement;
      const x = portrait ? width / 2 : margin + cardWidth / 2 + index * (cardWidth + gap);
      const y = portrait ? 64 + cardHeight / 2 + index * (cardHeight + gap) : 58 + cardHeight / 2;
      control.style.left = `${((x - cardWidth / 2) / width) * 100}%`;
      control.style.top = `${((y - cardHeight / 2) / height) * 100}%`;
      control.style.width = `${(cardWidth / width) * 100}%`;
      control.style.height = `${(cardHeight / height) * 100}%`;
    });
  }

  private createLevelCard(content: PlayableLevelContent, index: number, portrait: boolean): void {
    const { width, height } = this.scale;
    const margin = portrait ? 16 : 20;
    const gap = portrait ? 10 : 14;
    const cardWidth = portrait ? width - margin * 2 : (width - margin * 2 - gap * 2) / 3;
    const cardHeight = portrait ? (height - 116 - gap * 2) / 3 : height - 112;
    const x = portrait ? width / 2 : margin + cardWidth / 2 + index * (cardWidth + gap);
    const y = portrait ? 64 + cardHeight / 2 + index * (cardHeight + gap) : 58 + cardHeight / 2;

    const background = this.add
      .rectangle(x, y, cardWidth, cardHeight, 0x102a36, 0.98)
      .setStrokeStyle(2, index === 0 ? 0x38bdf8 : 0x64748b)
      .setInteractive({ useHandCursor: true });
    const textWidth = cardWidth - 24;
    this.add.text(x - cardWidth / 2 + 12, y - cardHeight / 2 + 10, content.title, {
      fontFamily: 'monospace',
      fontSize: portrait ? '16px' : '18px',
      color: '#f8fafc',
      wordWrap: { width: textWidth },
    });
    this.add.text(
      x - cardWidth / 2 + 12,
      y - cardHeight / 2 + (portrait ? 34 : 44),
      content.subtitle,
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cbd5e1',
        wordWrap: { width: textWidth },
      },
    );
    this.add.text(
      x - cardWidth / 2 + 12,
      y + cardHeight / 2 - (portrait ? 48 : 70),
      `${content.definition.moveLimit} moves\n${getObjectiveSummary(content)}`,
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#bae6fd',
        wordWrap: { width: textWidth },
      },
    );
    this.add
      .text(x + cardWidth / 2 - 12, y + cardHeight / 2 - 12, `Play ${index + 1}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f8fafc',
        backgroundColor: '#0f766e',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(1, 1);

    background.on('pointerup', () => this.launchLevel(content));
    background.on('pointerover', () => {
      background.setStrokeStyle(3, 0x7dd3fc);
      this.announce(`Selected ${content.title}. ${getObjectiveSummary(content)}.`);
    });
    background.on('pointerout', () => background.setStrokeStyle(2, 0x64748b));
  }

  private launchLevel(content: PlayableLevelContent): void {
    const context: PuzzleLaunchContext = {
      mode: 'puzzle-lab',
      run: { levelId: content.id, seed: this.seedProvider.nextSeed() },
    };
    this.announce(`Selected ${content.title}.`);
    this.scene.start(PuzzleScene.key, context);
  }

  private announce(message: string): void {
    const status = document.getElementById('storycrush-status');
    if (status) status.textContent = message;
  }
}
