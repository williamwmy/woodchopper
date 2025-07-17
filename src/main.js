import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import BaseScene from './scenes/BaseScene.js';
import PlayerUpgradeScene from './scenes/PlayerUpgradeScene.js';
import EquipmentScene from './scenes/EquipmentScene.js';

const config = {
    type: Phaser.WEBGL,
    width: 400,
    height: 700,
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
    scene: [MenuScene, GameScene, BaseScene, PlayerUpgradeScene, EquipmentScene]
};

const game = new Phaser.Game(config);

export default game;