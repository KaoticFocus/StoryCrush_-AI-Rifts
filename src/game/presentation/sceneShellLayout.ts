/**
 * Shared responsive shell for pre-board scenes (menu → map → intro → dialogue → choice).
 * Presentation-only — never mutates story/save/gameplay authority.
 */

export type SceneLayoutClass = 'phone-portrait' | 'phone-landscape' | 'tablet' | 'desktop';

export interface SceneShellLayout {
  layoutClass: SceneLayoutClass;
  viewportWidth: number;
  viewportHeight: number;
  /** Safe content rectangle inside padding / safe insets. */
  safeX: number;
  safeY: number;
  safeWidth: number;
  safeHeight: number;
  contentCenterX: number;
  padding: number;
  gutter: number;
  titleFontSize: number;
  subtitleFontSize: number;
  bodyFontSize: number;
  buttonFontSize: number;
  minTouch: number;
  /** Stack chapter cards / major panels vertically (phone portrait). */
  stackCards: boolean;
  titleWrapWidth: number;
  bodyWrapWidth: number;
  buttonPadX: number;
  buttonPadY: number;
}

export function resolveSceneLayoutClass(width: number, height: number): SceneLayoutClass {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  if (w > h && h <= 500) return 'phone-landscape';
  if (w <= 500) return 'phone-portrait';
  if (w <= 900) return 'tablet';
  return 'desktop';
}

/**
 * Lay out against Phaser/game-root logical size.
 * App-shell safe-area padding is already outside #game-root — do not subtract it again.
 */
export function calculateSceneShellLayout(input: {
  width: number;
  height: number;
}): SceneShellLayout {
  const viewportWidth = Math.max(1, Math.floor(input.width));
  const viewportHeight = Math.max(1, Math.floor(input.height));
  const layoutClass = resolveSceneLayoutClass(viewportWidth, viewportHeight);

  const phone = layoutClass === 'phone-portrait' || layoutClass === 'phone-landscape';
  const compact = layoutClass === 'phone-portrait' || viewportHeight <= 600;
  const padding = phone
    ? Math.max(10, Math.min(16, Math.round(Math.min(viewportWidth, viewportHeight) * 0.03)))
    : Math.max(20, Math.round(Math.min(viewportWidth, viewportHeight) * 0.035));

  const safeX = padding;
  const safeY = padding;
  const safeWidth = Math.max(160, viewportWidth - padding * 2);
  const safeHeight = Math.max(200, viewportHeight - padding * 2);
  const contentCenterX = safeX + safeWidth / 2;

  const titleFontSize = compact ? Math.max(20, Math.min(28, Math.floor(safeWidth * 0.07))) : 34;
  const subtitleFontSize = compact ? Math.max(14, Math.min(18, Math.floor(safeWidth * 0.045))) : 22;
  const bodyFontSize = compact ? Math.max(14, Math.min(17, Math.floor(safeWidth * 0.042))) : 18;
  const buttonFontSize = compact ? Math.max(15, Math.min(18, Math.floor(safeWidth * 0.045))) : 20;

  return {
    layoutClass,
    viewportWidth,
    viewportHeight,
    safeX,
    safeY,
    safeWidth,
    safeHeight,
    contentCenterX,
    padding,
    gutter: compact ? 10 : 16,
    titleFontSize,
    subtitleFontSize,
    bodyFontSize,
    buttonFontSize,
    minTouch: 44,
    stackCards: layoutClass === 'phone-portrait',
    titleWrapWidth: Math.floor(safeWidth * 0.96),
    bodyWrapWidth: Math.floor(safeWidth * 0.92),
    buttonPadX: compact ? 14 : 18,
    buttonPadY: compact ? 12 : 12,
  };
}

/** Optional presentation diagnostics for browser tests — not authoritative. */
export function publishSceneShellDiagnostics(shell: SceneShellLayout): void {
  const element = document.getElementById('storycrush-test-status');
  if (!element) return;
  element.setAttribute('data-layout-class', shell.layoutClass);
  element.setAttribute('data-safe-width', String(shell.safeWidth));
  element.setAttribute('data-safe-height', String(shell.safeHeight));
  element.setAttribute(
    'data-scene-content-bounds',
    `${shell.safeX},${shell.safeY},${shell.safeWidth},${shell.safeHeight}`,
  );
}
