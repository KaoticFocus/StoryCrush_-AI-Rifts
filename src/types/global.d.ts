import type Phaser from 'phaser';

declare global {
  interface Window {
    __storyCrushGame?: Phaser.Game;
  }
}

export {};
