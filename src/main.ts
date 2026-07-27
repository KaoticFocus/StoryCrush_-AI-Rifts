import Phaser from 'phaser';
import { gameConfig } from './game/config';
import './styles/global.css';

function showStartupFallback(message: string): void {
  const fallback = document.getElementById('startup-fallback');
  if (fallback) {
    fallback.textContent = message;
    fallback.hidden = false;
  }
}

function initializeGame(): Phaser.Game {
  const existingGame = window.__storyCrushGame;
  if (existingGame) {
    existingGame.destroy(true);
  }

  const game = new Phaser.Game(gameConfig);
  window.__storyCrushGame = game;

  return game;
}

try {
  initializeGame();
} catch (error) {
  console.error('Failed to initialize StoryCrush foundation build', error);
  showStartupFallback('StoryCrush failed to initialize. Check the browser console for details.');
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.__storyCrushGame?.destroy(true);
    window.__storyCrushGame = undefined;
  });
}
