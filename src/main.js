import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import CharacterScene from './scenes/CharacterScene.js';

// Size the canvas to the device's aspect ratio so it fills the screen
// (no letterbox bars). Width stays 400; height follows the screen, clamped
// to a sensible portrait range.
const aspect = Phaser.Math.Clamp(window.innerHeight / window.innerWidth, 1.7, 2.2);
const GAME_WIDTH = 400;
const GAME_HEIGHT = Math.round(GAME_WIDTH * aspect);

const config = {
    type: Phaser.WEBGL,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    canvas: document.getElementById('game-canvas'),
    backgroundColor: '#1d2b1f',
    input: { activePointers: 3 },
    dom: { createContainer: true },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container'
    },
    scene: [MenuScene, GameScene, CharacterScene]
};

const game = new Phaser.Game(config);

// Register the PWA service worker in production builds only
// (in dev it would interfere with Vite's hot module reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

export default game;
