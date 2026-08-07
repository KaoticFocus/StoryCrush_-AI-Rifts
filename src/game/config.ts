import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MultiverseMapScene } from './scenes/MultiverseMapScene';
import { ChapterIntroScene } from './scenes/ChapterIntroScene';
import { DialogueScene } from './scenes/DialogueScene';
import { StoryChoiceScene } from './scenes/StoryChoiceScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { PuzzleLabScene } from './scenes/PuzzleLabScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ConsequenceScene } from './scenes/ConsequenceScene';
import { getBrowserTestOptions } from './presentation/testing/browserTestOptions';
import { measureUsableViewport } from './presentation/viewportAuthority';

const useE2eCanvasRenderer = typeof window !== 'undefined' && getBrowserTestOptions().e2eEnabled;

/** Initial size from measured game-root — never let 960×540 become the mobile layout authority. */
export function createGameConfig(): Phaser.Types.Core.GameConfig {
  const initial =
    typeof window !== 'undefined'
      ? measureUsableViewport()
      : { width: 390, height: 844, source: 'fallback' as const };

  return {
    type: useE2eCanvasRenderer ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#0f172a',
    width: initial.width,
    height: initial.height,
    scene: [
      BootScene,
      MainMenuScene,
      MultiverseMapScene,
      ChapterIntroScene,
      DialogueScene,
      StoryChoiceScene,
      PuzzleLabScene,
      PuzzleScene,
      ResultsScene,
      ConsequenceScene,
    ],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // Prevent Phaser from rewriting parent CSS in ways that fight the app shell on iOS.
      expandParent: false,
      width: initial.width,
      height: initial.height,
    },
    render: {
      pixelArt: false,
      roundPixels: false,
      antialias: true,
    },
    callbacks: {
      postBoot: (game) => {
        if (useE2eCanvasRenderer) {
          const canvas = game.canvas;
          if (canvas instanceof window.HTMLCanvasElement) {
            canvas.style.imageRendering = 'auto';
          }
        }
      },
    },
  };
}
