import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MultiverseMapScene } from './scenes/MultiverseMapScene';
import { ChapterIntroScene } from './scenes/ChapterIntroScene';
import { DialogueScene } from './scenes/DialogueScene';
import { StoryChoiceScene } from './scenes/StoryChoiceScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ConsequenceScene } from './scenes/ConsequenceScene';
import { getBrowserTestOptions } from './presentation/testing/browserTestOptions';

const useE2eCanvasRenderer = typeof window !== 'undefined' && getBrowserTestOptions().e2eEnabled;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: useE2eCanvasRenderer ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#0f172a',
  width: 960,
  height: 540,
  scene: [
    BootScene,
    MainMenuScene,
    MultiverseMapScene,
    ChapterIntroScene,
    DialogueScene,
    StoryChoiceScene,
    PuzzleScene,
    ResultsScene,
    ConsequenceScene,
  ],
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
