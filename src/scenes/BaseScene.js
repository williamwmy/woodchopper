import Phaser from 'phaser';
import { AxeUpgrade } from '../objects/AxeUpgrade.js';
import { BaseBuilding } from '../objects/BaseBuilding.js';
import { SaveSystem } from '../utils/SaveSystem.js';

export default class BaseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BaseScene' });
        this.buildings = [];
        this.playerStats = {
            strength: 1,
            speed: 1,
            stamina: 1,
            skillPoints: 15
        };
        // Default resources (will be overridden from registry)
        this.playerResources = {
            wood: 0,
            coins: 0,
            oak_wood: 0,
            maple_syrup: 0,
            birch_bark: 0,
            pine_resin: 0
        };
        this.axeUpgrade = new AxeUpgrade();
        this.baseBuilding = new BaseBuilding(this);
        this.saveSystem = new SaveSystem();
    }

    preload() {
        this.createBaseTextures();
    }

    create() {
        this.cameras.main.setBackgroundColor('#98FB98');
        
        // Load resources from registry
        const savedResources = this.registry.get('playerResources');
        if (savedResources) {
            this.playerResources = { ...savedResources };
        }
        
        // Load other saved data from registry
        const savedStats = this.registry.get('playerStats');
        if (savedStats) {
            this.playerStats = { ...savedStats };
        }
        
        const savedAxe = this.registry.get('axeUpgrade');
        if (savedAxe) {
            // Restore the AxeUpgrade instance with saved data
            this.axeUpgrade.level = savedAxe.level || this.axeUpgrade.level;
            this.axeUpgrade.material = savedAxe.material || this.axeUpgrade.material;
            this.axeUpgrade.enchantments = savedAxe.enchantments || this.axeUpgrade.enchantments;
            this.axeUpgrade.stats = savedAxe.stats || this.axeUpgrade.stats;
        }
        
        const savedBuildings = this.registry.get('buildings');
        if (savedBuildings) {
            // Apply saved building data to baseBuilding
            Object.keys(savedBuildings).forEach(type => {
                const building = savedBuildings[type];
                this.baseBuilding.setBuildingData(type, building);
            });
        }
        
        this.createBaseLayout();
        this.createUI();
        this.setupInput();
    }

    createBaseTextures() {
        const graphics = this.add.graphics();
        
        graphics.fillStyle(0x8B4513);
        graphics.fillRect(0, 0, 80, 60);
        graphics.fillStyle(0x654321);
        graphics.fillRect(10, 10, 60, 40);
        graphics.generateTexture('warehouse', 80, 60);
        
        graphics.clear();
        graphics.fillStyle(0x696969);
        graphics.fillRect(0, 0, 70, 50);
        graphics.fillStyle(0xFF4500);
        graphics.fillRect(10, 10, 50, 30);
        graphics.generateTexture('smithy', 70, 50);
        
        graphics.clear();
        graphics.fillStyle(0x8B4513);
        graphics.fillRect(0, 0, 100, 80);
        graphics.fillStyle(0x654321);
        graphics.fillRect(10, 10, 80, 60);
        graphics.generateTexture('house', 100, 80);
        
        graphics.destroy();
    }

    createBaseLayout() {
        this.add.text(200, 40, 'YOUR BASE', {
            fontSize: '28px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const buildings = [
            { key: 'warehouse', x: 100, y: 100, name: 'WAREHOUSE', type: 'warehouse' },
            { key: 'smithy', x: 300, y: 100, name: 'SMITHY', type: 'smithy' },
            { key: 'house', x: 100, y: 200, name: 'LODGE', type: 'lodge' },
            { key: 'house', x: 300, y: 200, name: 'WORKSHOP', type: 'workshop' }
        ];

        buildings.forEach(building => {
            const buildingSprite = this.add.image(building.x, building.y, building.key)
                .setInteractive()
                .on('pointerdown', () => this.showBuildingInfo(building.type));
            
            const buildingInfo = this.baseBuilding.getBuildingInfo(building.type);
            
            this.add.text(building.x, building.y + 45, building.name, { 
                fontSize: '12px', 
                fill: '#2d4a2b',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            this.add.text(building.x, building.y + 60, `Level ${buildingInfo.level}`, { 
                fontSize: '10px', 
                fill: '#8B4513'
            }).setOrigin(0.5);

            if (building.type === 'workshop' && !buildingInfo.unlocked) {
                buildingSprite.setTint(0x666666);
                this.add.text(building.x, building.y + 75, 'LOCKED', { 
                    fontSize: '10px', 
                    fill: '#FF0000'
                }).setOrigin(0.5);
            }
        });
    }

    createUI() {
        // Resource display
        this.add.rectangle(200, 310, 380, 80, 0x000000, 0.1).setOrigin(0.5);
        this.add.text(20, 280, `💰 Coins: ${this.playerResources.coins}`, {
            fontSize: '18px',
            fill: '#FFD700',
            fontWeight: 'bold'
        });

        this.add.text(20, 305, `🪵 Wood: ${this.playerResources.wood} | 🌳 Oak: ${this.playerResources.oak_wood}`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });
        
        this.add.text(20, 325, `🍁 Maple: ${this.playerResources.maple_syrup} | 🌲 Birch: ${this.playerResources.birch_bark}`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });
        
        this.add.text(20, 345, `🌿 Pine: ${this.playerResources.pine_resin}`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });

        // Main navigation buttons
        const buttonY = 420;

        // Player upgrades button
        const playerButton = this.add.rectangle(200, buttonY, 350, 60, 0x228B22)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('PlayerUpgradeScene'));

        this.add.text(200, buttonY - 10, '📊 PLAYER UPGRADES', {
            fontSize: '18px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(200, buttonY + 10, 'Skills • Stats • Abilities', {
            fontSize: '12px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Equipment & buildings button
        const equipmentButton = this.add.rectangle(200, buttonY + 80, 350, 60, 0x800080)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('EquipmentScene'));

        this.add.text(200, buttonY + 70, '⚔️ EQUIPMENT', {
            fontSize: '18px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(200, buttonY + 90, 'Axes • Buildings • Enchantments', {
            fontSize: '12px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Additional options
        const optionsY = 580;

        // Save button - make it very prominent
        const saveButton = this.add.rectangle(200, optionsY, 300, 50, 0x4169E1)
            .setInteractive()
            .on('pointerdown', () => this.saveGame());

        this.add.text(200, optionsY, '💾 SAVE GAME', {
            fontSize: '20px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Bottom navigation
        const bottomY = 650;

        // Adventure button
        const adventureButton = this.add.rectangle(120, bottomY, 150, 40, 0x228B22)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('GameScene'));

        this.add.text(120, bottomY, '🏃 ADVENTURE', {
            fontSize: '16px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Back to menu button
        const backButton = this.add.rectangle(280, bottomY, 150, 40, 0x654321)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('MenuScene'));

        this.add.text(280, bottomY, '🏠 MENU', {
            fontSize: '16px',
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

    upgradeAxe(material, cost) {
        if (this.playerResources.coins >= cost) {
            this.playerResources.coins -= cost;
            this.axeUpgrade.upgradeAxe(material);
            this.saveResources();
            this.scene.restart();
        }
    }

    addEnchantment(enchantmentName, cost) {
        if (this.playerResources.coins >= cost) {
            this.playerResources.coins -= cost;
            this.axeUpgrade.addEnchantment(enchantmentName);
            this.saveResources();
            this.scene.restart();
        }
    }

    upgradeBuilding(buildingType) {
        if (this.baseBuilding.upgradeBuilding(buildingType, this.playerResources)) {
            this.saveResources();
            this.scene.restart();
        }
    }

    saveResources() {
        // Save resources back to registry
        this.registry.set('playerResources', this.playerResources);
        this.registry.set('playerStats', this.playerStats);
        this.registry.set('axeUpgrade', this.axeUpgrade);
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
        
        // Perform save
        const saveResult = this.saveSystem.saveGame(gameScene, this);
        
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

    showBuildingInfo(buildingType) {
        const descriptions = this.baseBuilding.getBuildingDescriptions();
        const desc = descriptions[buildingType];
        
        console.log(`${desc.name}: ${desc.description}`);
        console.log(`Current: ${desc.currentEffect}`);
        console.log(`Next: ${desc.nextLevel}`);
    }

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            console.log('Clicked at:', pointer.x, pointer.y);
        });
    }
}