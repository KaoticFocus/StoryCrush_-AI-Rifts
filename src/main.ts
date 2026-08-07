import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { getBrowserTestOptions } from './game/presentation/testing/browserTestOptions';
import {
  attachViewportAuthority,
  type ViewportAuthorityHandle,
} from './game/presentation/viewportAuthority';
import './styles/global.css';

let viewportAuthority: ViewportAuthorityHandle | null = null;

function showStartupFallback(message: string): void {
  const fallback = document.getElementById('startup-fallback');
  if (fallback) {
    fallback.textContent = message;
    fallback.hidden = false;
  }
}

function initializeGame(): Phaser.Game {
  document.documentElement.dataset.safeAreaTest = String(
    getBrowserTestOptions().safeAreaSimulationEnabled,
  );
  const existingGame = window.__storyCrushGame;
  if (existingGame) {
    viewportAuthority?.dispose();
    viewportAuthority = null;
    existingGame.destroy(true);
  }

  const game = new Phaser.Game(createGameConfig());
  window.__storyCrushGame = game;
  viewportAuthority = attachViewportAuthority(game);

  return game;
}

try {
  initializeGame();
} catch (error) {
  console.error('Failed to initialize StoryCrush prototype puzzle', error);
  showStartupFallback(
    'StoryCrush prototype failed to initialize. Check the browser console for details.',
  );
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    viewportAuthority?.dispose();
    viewportAuthority = null;
    window.__storyCrushGame?.destroy(true);
    window.__storyCrushGame = undefined;
  });
}
