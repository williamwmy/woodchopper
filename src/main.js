import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.WEBGL,
    width: 400,
    height: 700,
    canvas: document.getElementById('game-canvas'),
    backgroundColor: '#1d2b1f',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container'
    },
    scene: [MenuScene, GameScene]
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
