import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { PuzzleScene } from './scenes/PuzzleScene';

const useE2eCanvasRenderer =
  typeof window !== 'undefined' &&
  new window.URLSearchParams(window.location.search).get('e2e') === '1';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: useE2eCanvasRenderer ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0f172a',
  width: 960,
  height: 540,
  scene: [BootScene, MainMenuScene, PuzzleScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    roundPixels: false,
    antialias: true,
  },
  callbacks: {
    postBoot: () => {
      if (useE2eCanvasRenderer) {
        const canvas = document.querySelector('canvas');
        if (canvas instanceof window.HTMLCanvasElement) {
          canvas.style.imageRendering = 'auto';
        }
      }
    },
  },
};
