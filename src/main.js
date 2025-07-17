import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import BaseScene from './scenes/BaseScene.js';

const config = {
    type: Phaser.WEBGL,
    width: 800,
    height: 600,
    canvas: document.getElementById('game-canvas'),
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'game-container'
    },
    scene: [MenuScene, GameScene, BaseScene]
};

const game = new Phaser.Game(config);

export default game;