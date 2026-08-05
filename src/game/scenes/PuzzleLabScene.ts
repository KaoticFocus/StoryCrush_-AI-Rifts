/* global HTMLButtonElement, HTMLDivElement, KeyboardEvent */
import Phaser from 'phaser';
import {
  getCompactObjectiveSummary,
  getExperienceLabel,
  getObjectiveSummary,
  getThreatSummary,
  playableLevelCatalog,
  type PlayableLevelContent,
} from '../content/levelCatalog';
import { type PuzzleLaunchContext } from '../content/levelRun';
import { createBrowserSeedProvider } from '../presentation/browserSeedProvider';
import {
  calculatePuzzleLabCardLayout,
  type PuzzleLabCardBounds,
} from '../presentation/puzzleLabCardLayout';
import { markBrowserTestScene } from '../presentation/testing/BrowserTestStatusBridge';
import { MainMenuScene } from './MainMenuScene';
import { PuzzleScene } from './PuzzleScene';

function cardStrokeColor(content: PlayableLevelContent, index: number): number {
  if (content.experienceKind === 'rift-pressure') {
    return 0xd97706;
  }
  if (content.experienceKind === 'rift-erosion-lab') {
    return 0xf43f5e;
  }
  return index === 0 ? 0x38bdf8 : 0x64748b;
}

function badgeStyle(content: PlayableLevelContent): { color: string; backgroundColor: string } {
  if (content.experienceKind === 'rift-pressure') {
    return { color: '#fffbeb', backgroundColor: '#92400e' };
  }
  return { color: '#fecdd3', backgroundColor: '#7f1d1d' };
}

export class PuzzleLabScene extends Phaser.Scene {
  public static readonly key = 'PuzzleLabScene';
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private levelControls: HTMLDivElement | null = null;
  private launchInFlight = false;
  private readonly seedProvider = createBrowserSeedProvider();

  public constructor() {
    super(PuzzleLabScene.key);
  }

  public create(): void {
    this.launchInFlight = false;
    markBrowserTestScene('puzzle-lab');
    const { width, height } = this.scale;
    const portrait = width < height;
    this.cameras.main.setBackgroundColor('#07131f');

    this.add
      .text(width / 2, portrait ? 24 : 28, 'Puzzle Lab', {
        fontFamily: 'monospace',
        fontSize: portrait ? '22px' : '28px',
        color: '#f8fafc',
      })
      .setOrigin(0.5);

    const cardLayout = calculatePuzzleLabCardLayout({
      width,
      height,
      cardCount: playableLevelCatalog.length,
    });
    playableLevelCatalog.forEach((content, index) => {
      this.createLevelCard(content, index, cardLayout.cards[index], cardLayout.compact);
    });
    this.createLevelControls();

    this.add
      .text(width / 2, height - 18, 'Back to Main Menu', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f8fafc',
        backgroundColor: '#334155',
        padding: { x: 12, y: 6 },
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
    this.resizeHandler = () => this.layoutLevelControls();
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

  private createLevelControls(): void {
    this.levelControls?.remove();
    const controls = document.createElement('div');
    controls.className = 'puzzle-lab-level-controls';
    controls.setAttribute('aria-label', 'Puzzle Lab levels');
    playableLevelCatalog.forEach((content) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'puzzle-lab-level-control';
      const experience = getExperienceLabel(content);
      const threat = getThreatSummary(content);
      const ariaParts = [`Play ${content.title}`];
      if (experience) {
        ariaParts.push(experience);
      }
      if (threat) {
        ariaParts.push(threat);
      }
      control.setAttribute('aria-label', ariaParts.join('. '));
      control.dataset.levelId = content.id;
      control.dataset.experienceKind = content.experienceKind;
      control.addEventListener('click', () => this.launchLevel(content));
      controls.append(control);
    });
    document.getElementById('game-root')?.append(controls);
    this.levelControls = controls;
    this.layoutLevelControls();
  }

  private layoutLevelControls(): void {
    if (!this.levelControls) return;
    const { width, height } = this.scale;
    const layout = calculatePuzzleLabCardLayout({
      width,
      height,
      cardCount: playableLevelCatalog.length,
    });
    Array.from(this.levelControls.children).forEach((element, index) => {
      const control = element as HTMLButtonElement;
      const bounds = layout.cards[index];
      control.style.left = `${(bounds.x / width) * 100}%`;
      control.style.top = `${(bounds.y / height) * 100}%`;
      control.style.width = `${(bounds.width / width) * 100}%`;
      control.style.height = `${(bounds.height / height) * 100}%`;
    });
  }

  private createLevelCard(
    content: PlayableLevelContent,
    index: number,
    bounds: PuzzleLabCardBounds,
    compact: boolean,
  ): void {
    const { width: cardWidth, height: cardHeight } = bounds;
    const x = bounds.x + cardWidth / 2;
    const y = bounds.y + cardHeight / 2;
    const stroke = cardStrokeColor(content, index);

    const background = this.add
      .rectangle(x, y, cardWidth, cardHeight, 0x102a36, 0.98)
      .setStrokeStyle(2, stroke)
      .setInteractive({ useHandCursor: true });
    const textWidth = cardWidth - 20;
    const numberPrefix = `${index + 1}. `;
    this.add.text(
      x - cardWidth / 2 + 10,
      y - cardHeight / 2 + 8,
      `${numberPrefix}${content.title}`,
      {
        fontFamily: 'monospace',
        fontSize: compact ? '13px' : '18px',
        color: '#f8fafc',
        wordWrap: { width: textWidth },
      },
    );
    if (!compact) {
      this.add.text(x - cardWidth / 2 + 10, y - cardHeight / 2 + 40, content.subtitle, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cbd5e1',
        wordWrap: { width: textWidth },
      });
    }

    const experience = getExperienceLabel(content);
    const threat = getThreatSummary(content);
    let badgeY = y - cardHeight / 2 + (compact ? 30 : 84);
    if (experience) {
      const style = badgeStyle(content);
      this.add.text(x - cardWidth / 2 + 10, badgeY, experience, {
        fontFamily: 'monospace',
        fontSize: compact ? '10px' : '11px',
        color: style.color,
        backgroundColor: style.backgroundColor,
        padding: { x: 5, y: 2 },
      });
      badgeY += compact ? 16 : 22;
    }
    if (threat && !compact) {
      this.add.text(x - cardWidth / 2 + 10, badgeY, threat, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#fde68a',
        wordWrap: { width: textWidth },
      });
    } else if (threat && compact) {
      this.add.text(x - cardWidth / 2 + 10, badgeY, threat, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#fde68a',
        wordWrap: { width: textWidth },
      });
    }

    const objectiveText = compact
      ? `${content.definition.moveLimit} moves · ${getCompactObjectiveSummary(content)}`
      : `${content.definition.moveLimit} moves\n${getObjectiveSummary(content)}`;
    this.add.text(x - cardWidth / 2 + 10, y + cardHeight / 2 - (compact ? 36 : 70), objectiveText, {
      fontFamily: 'monospace',
      fontSize: compact ? '10px' : '12px',
      color: '#bae6fd',
      wordWrap: { width: textWidth },
    });
    this.add
      .text(x + cardWidth / 2 - 10, y + cardHeight / 2 - 8, `Play ${index + 1}`, {
        fontFamily: 'monospace',
        fontSize: compact ? '12px' : '14px',
        color: '#f8fafc',
        backgroundColor: '#0f766e',
        padding: { x: compact ? 8 : 12, y: compact ? 4 : 7 },
      })
      .setOrigin(1, 1);

    background.on('pointerup', () => this.launchLevel(content));
    background.on('pointerover', () => {
      background.setStrokeStyle(3, 0x7dd3fc);
      this.announce(`Selected ${content.title}. ${getObjectiveSummary(content)}.`);
    });
    background.on('pointerout', () => background.setStrokeStyle(2, stroke));
  }

  private launchLevel(content: PlayableLevelContent): void {
    // DOM semantic controls sit above the Phaser cards. A single gesture can deliver both a
    // button click and a canvas pointerup; guard so PuzzleScene is not started twice.
    if (this.launchInFlight) return;
    this.launchInFlight = true;
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
