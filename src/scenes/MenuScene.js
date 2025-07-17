import Phaser from 'phaser';
import { SaveSystem } from '../utils/SaveSystem.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.saveSystem = new SaveSystem();
    }

    preload() {
        this.load.image('menuBg', 'data:image/svg+xml;base64,' + btoa(`
            <svg width="400" height="700" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#98FB98;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="400" height="700" fill="url(#skyGradient)"/>
                <circle cx="100" cy="100" r="30" fill="#FFD700"/>
                <rect x="0" y="600" width="400" height="100" fill="#228B22"/>
                <polygon points="50,550 100,450 150,550" fill="#006400"/>
                <polygon points="150,500 200,400 250,500" fill="#006400"/>
                <polygon points="250,580 300,480 350,580" fill="#006400"/>
            </svg>
        `));
    }

    create() {
        this.add.image(200, 350, 'menuBg');

        this.add.text(200, 120, 'WOODCHOPPER', {
            fontSize: '36px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(200, 160, 'Cozy Forest Adventure', {
            fontSize: '20px',
            fill: '#4a6741',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        const startButton = this.add.rectangle(200, 250, 300, 60, 0x8B4513)
            .setInteractive()
            .on('pointerdown', () => this.startGame());

        this.add.text(200, 250, 'START ADVENTURE', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const baseButton = this.add.rectangle(200, 330, 300, 60, 0x654321)
            .setInteractive()
            .on('pointerdown', () => this.goToBase());

        this.add.text(200, 330, 'VISIT BASE', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Load game button (only show if save exists)
        if (this.saveSystem.hasSaveData()) {
            const loadButton = this.add.rectangle(200, 410, 300, 60, 0x4169E1)
                .setInteractive()
                .on('pointerdown', () => this.loadGame());

            this.add.text(200, 410, '📂 LOAD GAME', {
                fontSize: '20px',
                fill: '#ffffff',
                fontFamily: 'Arial',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            // Show save info
            const saveInfo = this.saveSystem.getSaveInfo();
            if (saveInfo) {
                this.add.text(200, 440, `Saved: ${saveInfo.timestamp}`, {
                    fontSize: '12px',
                    fill: '#4a6741',
                    fontFamily: 'Arial'
                }).setOrigin(0.5);
            }
        }

        this.add.text(200, 520, 'Chop trees • Collect resources • Upgrade your base', {
            fontSize: '14px',
            fill: '#4a6741',
            fontFamily: 'Arial',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);

        // Add discrete version number in bottom right corner
        this.add.text(380, 680, 'v1.1.0', {
            fontSize: '12px',
            fill: '#4a6741',
            fontFamily: 'Arial',
            alpha: 0.7
        }).setOrigin(1, 1);
    }

    startGame() {
        this.scene.start('GameScene');
    }

    goToBase() {
        this.scene.start('BaseScene');
    }

    loadGame() {
        // Show loading message
        const loadingText = this.add.text(200, 350, 'Loading game...', {
            fontSize: '24px',
            fill: '#4169E1',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Load game after a short delay for visual feedback
        this.time.delayedCall(500, () => {
            const loadResult = this.saveSystem.loadGame();
            
            if (loadResult.success) {
                // Start the game scene directly
                this.scene.start('GameScene');
            } else {
                // Show error message
                loadingText.setText(loadResult.message);
                loadingText.setFill('#FF0000');
                
                this.time.delayedCall(3000, () => {
                    loadingText.destroy();
                });
            }
        });
    }
}