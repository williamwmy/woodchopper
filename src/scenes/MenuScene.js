import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        this.load.image('menuBg', 'data:image/svg+xml;base64,' + btoa(`
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#98FB98;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="800" height="600" fill="url(#skyGradient)"/>
                <circle cx="150" cy="150" r="40" fill="#FFD700"/>
                <rect x="50" y="500" width="700" height="100" fill="#228B22"/>
                <polygon points="100,450 150,350 200,450" fill="#006400"/>
                <polygon points="300,400 350,300 400,400" fill="#006400"/>
                <polygon points="500,480 550,380 600,480" fill="#006400"/>
            </svg>
        `));
    }

    create() {
        this.add.image(400, 300, 'menuBg');

        this.add.text(400, 150, 'WOODCHOPPER', {
            fontSize: '48px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(400, 200, 'Cozy Forest Adventure', {
            fontSize: '24px',
            fill: '#4a6741',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        const startButton = this.add.rectangle(400, 300, 200, 60, 0x8B4513)
            .setInteractive()
            .on('pointerdown', () => this.startGame());

        this.add.text(400, 300, 'START ADVENTURE', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const baseButton = this.add.rectangle(400, 380, 200, 60, 0x654321)
            .setInteractive()
            .on('pointerdown', () => this.goToBase());

        this.add.text(400, 380, 'VISIT BASE', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(400, 500, 'Chop trees • Collect resources • Upgrade your base', {
            fontSize: '16px',
            fill: '#4a6741',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
    }

    startGame() {
        this.scene.start('GameScene');
    }

    goToBase() {
        this.scene.start('BaseScene');
    }
}