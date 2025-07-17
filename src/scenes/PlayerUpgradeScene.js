import Phaser from 'phaser';
import { SaveSystem } from '../utils/SaveSystem.js';

export default class PlayerUpgradeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PlayerUpgradeScene' });
        this.playerStats = {
            strength: 1,
            speed: 1,
            stamina: 1,
            skillPoints: 15
        };
        this.playerResources = {
            wood: 0,
            coins: 0,
            oak_wood: 0,
            maple_syrup: 0,
            birch_bark: 0,
            pine_resin: 0
        };
        this.saveSystem = new SaveSystem();
    }

    create() {
        this.cameras.main.setBackgroundColor('#98FB98');
        
        // Load data from registry
        this.loadDataFromRegistry();
        
        this.createUI();
        this.setupInput();
    }

    loadDataFromRegistry() {
        // Load resources from registry
        const savedResources = this.registry.get('playerResources');
        if (savedResources) {
            this.playerResources = { ...savedResources };
        }
        
        // Load player stats from registry
        const savedStats = this.registry.get('playerStats');
        if (savedStats) {
            this.playerStats = { ...savedStats };
        }
    }

    createUI() {
        // Title
        this.add.text(200, 50, 'PLAYER UPGRADES', {
            fontSize: '28px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Resource display
        this.add.rectangle(200, 120, 380, 80, 0x000000, 0.1).setOrigin(0.5);
        this.add.text(20, 90, `💰 Coins: ${this.playerResources.coins}`, {
            fontSize: '18px',
            fill: '#FFD700',
            fontWeight: 'bold'
        });

        this.add.text(20, 115, `🪵 Wood: ${this.playerResources.wood} | 🌳 Oak: ${this.playerResources.oak_wood}`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });
        
        this.add.text(20, 135, `🍁 Maple: ${this.playerResources.maple_syrup} | 🌲 Birch: ${this.playerResources.birch_bark}`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });
        
        this.add.text(20, 155, `🌿 Pine: ${this.playerResources.pine_resin}`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });

        // Skills section
        this.add.text(200, 200, 'SKILLS', {
            fontSize: '24px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(200, 230, `📊 Skill Points: ${this.playerStats.skillPoints}`, {
            fontSize: '20px',
            fill: '#4169E1',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Skill upgrade buttons
        const upgradeButtons = [
            { name: 'Strength', stat: 'strength', cost: this.playerStats.strength * 2, y: 280, icon: '💪', 
              desc: 'Increases damage dealt to trees and enemies' },
            { name: 'Speed', stat: 'speed', cost: this.playerStats.speed * 2, y: 380, icon: '⚡',
              desc: 'Increases movement speed and reduces stamina drain' },
            { name: 'Stamina', stat: 'stamina', cost: this.playerStats.stamina * 2, y: 480, icon: '❤️',
              desc: 'Increases maximum stamina and regeneration rate' }
        ];

        upgradeButtons.forEach(upgrade => {
            const canAfford = this.playerStats.skillPoints >= upgrade.cost;
            const buttonColor = canAfford ? 0x228B22 : 0x666666;
            const textColor = canAfford ? '#ffffff' : '#999999';
            
            // Main upgrade button
            const button = this.add.rectangle(200, upgrade.y, 350, 50, buttonColor)
                .setInteractive()
                .on('pointerdown', () => this.upgradeSkill(upgrade.stat));

            this.add.text(200, upgrade.y - 5, `${upgrade.icon} UPGRADE ${upgrade.name.toUpperCase()}`, {
                fontSize: '16px',
                fill: textColor,
                fontWeight: 'bold'
            }).setOrigin(0.5);

            // Current level and cost display
            this.add.text(200, upgrade.y + 10, `Level: ${this.playerStats[upgrade.stat]} | Cost: ${upgrade.cost} SP`, {
                fontSize: '12px',
                fill: canAfford ? '#4169E1' : '#999999'
            }).setOrigin(0.5);

            // Description
            this.add.text(200, upgrade.y + 35, upgrade.desc, {
                fontSize: '11px',
                fill: '#4a6741',
                wordWrap: { width: 340 }
            }).setOrigin(0.5, 0);
        });

        // Navigation buttons
        const buttonY = 620;

        // Equipment button
        const equipmentButton = this.add.rectangle(120, buttonY, 150, 40, 0x800080)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('EquipmentScene'));

        this.add.text(120, buttonY, '⚔️ EQUIPMENT', {
            fontSize: '14px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Back to base button
        const backButton = this.add.rectangle(280, buttonY, 150, 40, 0x654321)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('BaseScene'));

        this.add.text(280, buttonY, '🏠 BACK', {
            fontSize: '14px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
    }

    upgradeSkill(stat) {
        const cost = this.playerStats[stat] * 2;
        if (this.playerStats.skillPoints >= cost) {
            this.playerStats.skillPoints -= cost;
            this.playerStats[stat]++;
            this.saveResources();
            this.scene.restart();
        }
    }

    saveResources() {
        // Save data back to registry
        this.registry.set('playerResources', this.playerResources);
        this.registry.set('playerStats', this.playerStats);
    }

    saveGame() {
        // Get GameScene to save from
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) {
            // Show error message
            const errorMessage = this.add.text(200, 350, 'Kan ikke lagre - gå til spillet først!', {
                fontSize: '16px',
                fill: '#FF0000',
                fontWeight: 'bold',
                wordWrap: { width: 350 }
            }).setOrigin(0.5);
            
            this.time.delayedCall(3000, () => {
                errorMessage.destroy();
            });
            return;
        }

        // Save all current data to registry first
        this.saveResources();
        
        // Get BaseScene for building data
        const baseScene = this.scene.get('BaseScene');
        
        // Perform save
        const saveResult = this.saveSystem.saveGame(gameScene, baseScene || this);
        
        // Show save feedback
        const message = this.add.text(200, 350, saveResult.message, {
            fontSize: '20px',
            fill: saveResult.success ? '#00FF00' : '#FF0000',
            fontWeight: 'bold',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);
        
        let timeMessage;
        if (saveResult.success) {
            timeMessage = this.add.text(200, 380, `Lagret: ${saveResult.timestamp}`, {
                fontSize: '14px',
                fill: '#ffffff',
                fontWeight: 'bold'
            }).setOrigin(0.5);
        }
        
        // Remove messages after 3 seconds
        this.time.delayedCall(3000, () => {
            message.destroy();
            if (timeMessage) timeMessage.destroy();
        });
        
        return saveResult;
    }

    setupInput() {
        // Basic input handling if needed
    }
}