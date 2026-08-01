import Phaser from 'phaser';
import { type LevelViewModel } from './levelViewModel';
import { getPlaybackDurations } from './playback/playbackTimings';
import { type PlaybackSettings } from './playback/ResolutionPlaybackController';
import { type PlaybackMode } from './playback/playbackTypes';
import { type PuzzleLayout } from './puzzleLayout';

type ButtonKey = 'restart' | 'menu' | 'mode' | 'motion' | 'hint' | 'pause';

interface ButtonEntry {
  key: ButtonKey;
  label: string;
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export class HudView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly hudBackground: Phaser.GameObjects.Graphics;
  private readonly footerBackground: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly movesText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly summaryText: Phaser.GameObjects.Text;
  private readonly feedbackLayer: Phaser.GameObjects.Container;
  private readonly pauseOverlay: Phaser.GameObjects.Container;
  private readonly pauseOverlayBackground: Phaser.GameObjects.Graphics;
  private readonly pauseOverlayTitle: Phaser.GameObjects.Text;
  private readonly pauseOverlayButtons: Array<{
    key: 'resume' | 'restart' | 'menu' | 'hints' | 'reset';
    background: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
  }> = [];
  private readonly objectiveTexts: Phaser.GameObjects.Text[] = [];
  private readonly objectiveTextById = new Map<string, Phaser.GameObjects.Text>();
  private readonly buttons: ButtonEntry[] = [];
  private readonly transientObjects = new Set<Phaser.GameObjects.GameObject>();
  private readonly activeTweens = new Set<Phaser.Tweens.Tween>();
  private readonly activeTimers = new Set<Phaser.Time.TimerEvent>();
  private readonly pendingResolvers = new Set<() => void>();
  private layout: PuzzleLayout | null = null;
  private onRestart: (() => void) | null = null;
  private onBackToMenu: (() => void) | null = null;
  private onCyclePlaybackMode: (() => void) | null = null;
  private onToggleReducedMotion: (() => void) | null = null;
  private onRequestHint: (() => void) | null = null;
  private onTogglePause: (() => void) | null = null;
  private onToggleHints: (() => void) | null = null;
  private onResetSettings: (() => void) | null = null;

  public constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0);
    this.hudBackground = scene.add.graphics();
    this.footerBackground = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, 'Prototype Level', this.headerStyle('#f8fafc', 28));
    this.scoreText = scene.add.text(0, 0, '', this.bodyStyle('#e2e8f0', 24));
    this.movesText = scene.add.text(0, 0, '', this.bodyStyle('#bae6fd', 24));
    this.statusText = scene.add.text(0, 0, '', this.bodyStyle('#fcd34d', 22));
    this.summaryText = scene.add.text(0, 0, '', this.bodyStyle('#cbd5e1', 18));
    this.feedbackLayer = scene.add.container(0, 0);
    this.pauseOverlay = scene.add.container(0, 0).setVisible(false);
    this.pauseOverlayBackground = scene.add.graphics();
    this.pauseOverlayTitle = scene.add.text(0, 0, 'Paused', this.headerStyle('#f8fafc', 28));
    this.pauseOverlay.add([this.pauseOverlayBackground, this.pauseOverlayTitle]);

    this.root.add([
      this.hudBackground,
      this.footerBackground,
      this.titleText,
      this.scoreText,
      this.movesText,
      this.statusText,
      this.summaryText,
      this.feedbackLayer,
      this.pauseOverlay,
    ]);
    this.root.setDepth(200);

    this.buttons.push(this.createButton('restart', 'Restart'));
    this.buttons.push(this.createButton('menu', 'Back to Menu'));
    this.buttons.push(this.createButton('mode', 'Mode'));
    this.buttons.push(this.createButton('motion', 'Motion'));
    this.buttons.push(this.createButton('hint', 'Hint'));
    this.buttons.push(this.createButton('pause', 'Pause'));
    this.pauseOverlayButtons.push(
      this.createPauseOverlayButton('resume', 'Resume'),
      this.createPauseOverlayButton('restart', 'Restart'),
      this.createPauseOverlayButton('menu', 'Back to Menu'),
      this.createPauseOverlayButton('hints', 'Hints'),
      this.createPauseOverlayButton('reset', 'Reset Settings'),
    );
  }

  public setCallbacks(callbacks: {
    onRestart: () => void;
    onBackToMenu: () => void;
    onCyclePlaybackMode: () => void;
    onToggleReducedMotion: () => void;
    onRequestHint: () => void;
    onTogglePause: () => void;
    onToggleHints: () => void;
    onResetSettings: () => void;
  }): void {
    this.onRestart = callbacks.onRestart;
    this.onBackToMenu = callbacks.onBackToMenu;
    this.onCyclePlaybackMode = callbacks.onCyclePlaybackMode;
    this.onToggleReducedMotion = callbacks.onToggleReducedMotion;
    this.onRequestHint = callbacks.onRequestHint;
    this.onTogglePause = callbacks.onTogglePause;
    this.onToggleHints = callbacks.onToggleHints;
    this.onResetSettings = callbacks.onResetSettings;
  }

  public render(input: {
    layout: PuzzleLayout;
    viewModel: LevelViewModel;
    summary: string;
    playbackMode: PlaybackMode;
    reducedMotion: boolean;
    hintsEnabled: boolean;
    paused: boolean;
    hasError?: boolean;
  }): void {
    const { layout, viewModel, summary } = input;
    this.layout = layout;

    this.hudBackground.clear();
    this.footerBackground.clear();

    this.hudBackground.fillStyle(0x0f172a, 0.88);
    this.hudBackground.fillRoundedRect(
      layout.hudRect.x,
      layout.hudRect.y,
      layout.hudRect.width,
      layout.hudRect.height,
      18,
    );
    this.hudBackground.lineStyle(2, 0x334155, 1);
    this.hudBackground.strokeRoundedRect(
      layout.hudRect.x,
      layout.hudRect.y,
      layout.hudRect.width,
      layout.hudRect.height,
      18,
    );

    this.footerBackground.fillStyle(0x0f172a, 0.84);
    this.footerBackground.fillRoundedRect(
      layout.footerRect.x,
      layout.footerRect.y,
      layout.footerRect.width,
      layout.footerRect.height,
      16,
    );
    this.footerBackground.lineStyle(2, 0x334155, 1);
    this.footerBackground.strokeRoundedRect(
      layout.footerRect.x,
      layout.footerRect.y,
      layout.footerRect.width,
      layout.footerRect.height,
      16,
    );

    const horizontalPadding = 18;
    const verticalPadding = 16;
    const lineGap = 12;
    let cursorY = layout.hudRect.y + verticalPadding;
    const textX = layout.hudRect.x + horizontalPadding;

    this.titleText.setPosition(textX, cursorY);
    this.titleText.setText(viewModel.titleText ?? 'Prototype Level');
    cursorY += this.titleText.height + lineGap;

    this.scoreText.setPosition(textX, cursorY);
    this.scoreText.setText(viewModel.scoreText);

    this.movesText.setPosition(layout.hudRect.x + layout.hudRect.width * 0.5, cursorY);
    this.movesText.setText(viewModel.movesText);
    cursorY += Math.max(this.scoreText.height, this.movesText.height) + lineGap;

    this.statusText.setPosition(textX, cursorY);
    this.statusText.setText(`Status ${viewModel.statusText}`);
    this.statusText.setColor(viewModel.isTerminal ? '#fda4af' : '#fcd34d');
    cursorY += this.statusText.height + lineGap;

    while (this.objectiveTexts.length < viewModel.objectives.length) {
      const text = this.scene.add.text(0, 0, '', this.bodyStyle('#e2e8f0', 18));
      this.objectiveTexts.push(text);
      this.root.add(text);
    }

    this.objectiveTexts.forEach((text, index) => {
      const objective = viewModel.objectives[index];
      if (!objective) {
        text.setVisible(false);
        return;
      }

      text.setVisible(true);
      text.setPosition(textX, cursorY);
      text.setColor(objective.complete ? '#86efac' : '#e2e8f0');
      text.setText(objective.label);
      this.objectiveTextById.set(objective.id, text);
      cursorY += text.height + 8;
    });

    for (const [objectiveId, text] of [...this.objectiveTextById.entries()]) {
      if (!viewModel.objectives.some((objective) => objective.id === objectiveId)) {
        this.objectiveTextById.delete(objectiveId);
        text.setVisible(false);
      }
    }

    const showSummary = layout.footerRect.height > 124;
    this.summaryText.setVisible(showSummary);
    if (showSummary) {
      this.summaryText.setText(summary);
      this.summaryText.setColor(input.hasError ? '#fca5a5' : '#cbd5e1');
      this.summaryText.setPosition(
        layout.footerRect.x + horizontalPadding,
        layout.footerRect.y + 8,
      );
      this.summaryText.setWordWrapWidth(layout.footerRect.width - horizontalPadding * 2);
    }

    const buttonGap = 8;
    const buttonHeight = 36;
    const columns = 3;
    const buttonWidth = Math.max(
      92,
      Math.floor(
        (layout.footerRect.width - horizontalPadding * 2 - buttonGap * (columns - 1)) / columns,
      ),
    );
    this.buttons.forEach((button, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = layout.footerRect.x + horizontalPadding + column * (buttonWidth + buttonGap);
      const y = layout.footerRect.y + 42 + row * (buttonHeight + 8);
      button.background.setPosition(x + buttonWidth / 2, y + buttonHeight / 2);
      button.background.setSize(buttonWidth, buttonHeight);
      button.text.setPosition(x + buttonWidth / 2, y + buttonHeight / 2);
      button.text.setFontSize(buttonWidth < 110 ? 12 : 14);
      button.text.setText(
        this.getButtonLabel(
          button.key,
          input.playbackMode,
          input.reducedMotion,
          input.hintsEnabled,
        ),
      );
    });

    this.renderPauseOverlay(layout, input.hintsEnabled, input.paused);
  }

  public destroy(): void {
    this.cancelTransientEffects();
    for (const button of this.buttons) {
      button.background.removeAllListeners();
    }
    this.root.destroy(true);
  }

  public getResourceSnapshot(): {
    displayObjects: number;
    temporaryObjects: number;
    activeTweens: number;
    activeTimers: number;
  } {
    return {
      displayObjects: this.root.getAll().length,
      temporaryObjects: this.transientObjects.size,
      activeTweens: this.activeTweens.size,
      activeTimers: this.activeTimers.size,
    };
  }

  public cancelTransientEffects(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens.clear();

    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers.clear();

    for (const resolver of this.pendingResolvers) {
      resolver();
    }
    this.pendingResolvers.clear();

    for (const object of this.transientObjects) {
      object.destroy();
    }
    this.transientObjects.clear();
    this.feedbackLayer.removeAll(true);
  }

  public async showScoreFeedback(label: string, settings: PlaybackSettings): Promise<void> {
    if (!this.layout) {
      return;
    }

    const durations = getPlaybackDurations(settings);
    const feedback = this.scene.add
      .text(this.scoreText.x + 110, this.scoreText.y, label, this.bodyStyle('#fef08a', 18))
      .setOrigin(0, 0.5);
    this.feedbackLayer.add(feedback);
    this.transientObjects.add(feedback);

    await this.runFeedbackTransition(
      durations.scoreLabel,
      () => {
        this.trackTween(
          this.scene.tweens.add({
            targets: feedback,
            alpha: 0,
            y: feedback.y - 18,
            duration: durations.scoreLabel,
            ease: 'Sine.easeOut',
          }),
        );
      },
      () => {
        this.transientObjects.delete(feedback);
        feedback.destroy();
      },
    );
  }

  public async showObjectiveFeedback(input: {
    objectiveId: string;
    label: string;
    sourcePositions: Array<{ x: number; y: number }>;
    completed: boolean;
    settings: PlaybackSettings;
  }): Promise<void> {
    const objectiveText = this.objectiveTextById.get(input.objectiveId);
    if (!objectiveText) {
      return;
    }

    const durations = getPlaybackDurations(input.settings);
    const label = this.scene.add
      .text(
        objectiveText.x + objectiveText.width + 12,
        objectiveText.y + objectiveText.height / 2,
        input.label,
        this.bodyStyle('#93c5fd', 16),
      )
      .setOrigin(0, 0.5);
    this.feedbackLayer.add(label);
    this.transientObjects.add(label);

    const tokens = input.sourcePositions.slice(0, 6).map((position) => {
      const token = this.scene.add.circle(position.x, position.y, 4, 0xfef08a, 0.9);
      this.feedbackLayer.add(token);
      this.transientObjects.add(token);
      return token;
    });

    await this.runFeedbackTransition(
      durations.collectionFeedback,
      () => {
        this.trackTween(
          this.scene.tweens.add({
            targets: label,
            alpha: 0,
            x: label.x + 10,
            duration: durations.collectionFeedback,
            ease: 'Sine.easeOut',
          }),
        );

        for (const token of tokens) {
          this.trackTween(
            this.scene.tweens.add({
              targets: token,
              x: objectiveText.x - 8,
              y: objectiveText.y + objectiveText.height / 2,
              alpha: 0,
              duration: durations.collectionFeedback,
              ease: input.settings.reducedMotion ? 'Linear' : 'Quad.easeInOut',
            }),
          );
        }

        if (input.completed) {
          this.trackTween(
            this.scene.tweens.add({
              targets: objectiveText,
              scaleX: 1.08,
              scaleY: 1.08,
              yoyo: true,
              duration: durations.objectiveComplete,
              repeat: 0,
              ease: 'Sine.easeInOut',
            }),
          );
        }
      },
      () => {
        this.transientObjects.delete(label);
        label.destroy();
        for (const token of tokens) {
          this.transientObjects.delete(token);
          token.destroy();
        }
        objectiveText.setScale(1);
      },
    );
  }

  private createButton(key: ButtonKey, label: string): ButtonEntry {
    const background = this.scene.add
      .rectangle(0, 0, 120, 36, 0x1d4ed8)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xbfdbfe)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add.text(0, 0, label, this.bodyStyle('#eff6ff', 16)).setOrigin(0.5);

    background.on('pointerover', () => {
      background.setFillStyle(0x2563eb);
    });
    background.on('pointerout', () => {
      background.setFillStyle(0x1d4ed8);
    });
    const handleButtonActivation = () => {
      if (key === 'restart') {
        this.onRestart?.();
        return;
      }

      if (key === 'mode') {
        this.onCyclePlaybackMode?.();
        return;
      }

      if (key === 'motion') {
        this.onToggleReducedMotion?.();
        return;
      }

      if (key === 'hint') {
        this.onRequestHint?.();
        return;
      }

      if (key === 'pause') {
        this.onTogglePause?.();
        return;
      }

      this.onBackToMenu?.();
    };

    background.on('pointerup', handleButtonActivation);

    this.root.add([background, text]);
    return { key, label, background, text };
  }

  private headerStyle(color: string, fontSize: number): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color,
    };
  }

  private bodyStyle(color: string, fontSize: number): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color,
    };
  }

  private getButtonLabel(
    key: ButtonKey,
    playbackMode: PlaybackMode,
    reducedMotion: boolean,
    hintsEnabled: boolean,
  ): string {
    switch (key) {
      case 'restart':
        return 'Restart';
      case 'menu':
        return 'Back to Menu';
      case 'mode':
        return `Mode: ${playbackMode}`;
      case 'motion':
        return reducedMotion ? 'Motion: Reduced' : 'Motion: Full';
      case 'hint':
        return hintsEnabled ? 'Hint' : 'Hints: Off';
      case 'pause':
        return 'Pause';
    }
  }

  private createPauseOverlayButton(
    key: 'resume' | 'restart' | 'menu' | 'hints' | 'reset',
    label: string,
  ) {
    const background = this.scene.add
      .rectangle(0, 0, 150, 38, 0x1d4ed8)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xbfdbfe)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add.text(0, 0, label, this.bodyStyle('#eff6ff', 15)).setOrigin(0.5);
    background.on('pointerdown', () => {
      if (key === 'resume') {
        this.onTogglePause?.();
      } else if (key === 'restart') {
        this.onRestart?.();
      } else if (key === 'menu') {
        this.onBackToMenu?.();
      } else if (key === 'hints') {
        this.onToggleHints?.();
      } else {
        this.onResetSettings?.();
      }
    });
    this.pauseOverlay.add([background, text]);
    return { key, background, text };
  }

  private renderPauseOverlay(layout: PuzzleLayout, hintsEnabled: boolean, paused: boolean): void {
    this.pauseOverlay.setVisible(paused);
    if (!paused) {
      return;
    }

    this.root.bringToTop(this.pauseOverlay);

    const panelWidth = Math.min(
      layout.viewportWidth - 32,
      Math.max(260, layout.viewportWidth * 0.72),
    );
    const panelHeight = Math.min(layout.viewportHeight - 32, 310);
    const x = (layout.viewportWidth - panelWidth) / 2;
    const y = (layout.viewportHeight - panelHeight) / 2;
    this.pauseOverlayBackground.clear();
    this.pauseOverlayBackground.fillStyle(0x020617, 0.96);
    this.pauseOverlayBackground.fillRoundedRect(x, y, panelWidth, panelHeight, 14);
    this.pauseOverlayBackground.lineStyle(2, 0x7dd3fc, 1);
    this.pauseOverlayBackground.strokeRoundedRect(x, y, panelWidth, panelHeight, 14);
    this.pauseOverlayTitle.setPosition(layout.viewportWidth / 2, y + 24).setOrigin(0.5, 0);

    this.pauseOverlayButtons.forEach((button, index) => {
      const buttonY = y + 86 + index * 40;
      button.background.setPosition(layout.viewportWidth / 2, buttonY);
      button.background.setSize(Math.min(210, panelWidth - 40), 32);
      button.text.setPosition(layout.viewportWidth / 2, buttonY);
      button.text.setText(
        button.key === 'hints'
          ? `Hints: ${hintsEnabled ? 'On' : 'Off'}`
          : button.key === 'reset'
            ? 'Reset Settings'
            : button.key === 'menu'
              ? 'Back to Menu'
              : button.key === 'resume'
                ? 'Resume'
                : 'Restart',
      );
    });
  }

  private async runFeedbackTransition(
    duration: number,
    onStart?: () => void,
    onFinish?: () => void,
  ): Promise<void> {
    onStart?.();

    if (duration <= 0) {
      onFinish?.();
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        this.pendingResolvers.delete(finish);
        onFinish?.();
        resolve();
      };

      this.pendingResolvers.add(finish);
      const timer = this.scene.time.delayedCall(duration, () => {
        this.activeTimers.delete(timer);
        finish();
      });
      this.activeTimers.add(timer);
    });
  }

  private trackTween(tween: Phaser.Tweens.Tween): Phaser.Tweens.Tween {
    this.activeTweens.add(tween);
    tween.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
      this.activeTweens.delete(tween);
    });
    tween.once(Phaser.Tweens.Events.TWEEN_STOP, () => {
      this.activeTweens.delete(tween);
    });
    return tween;
  }
}
