import Phaser from 'phaser';
import { AxeUpgrade } from '../objects/AxeUpgrade.js';
import { BaseBuilding } from '../objects/BaseBuilding.js';
import { SaveSystem } from '../utils/SaveSystem.js';

export default class EquipmentScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EquipmentScene' });
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
        
        // Load axe upgrade data
        const savedAxe = this.registry.get('axeUpgrade');
        if (savedAxe) {
            // Restore the AxeUpgrade instance with saved data
            this.axeUpgrade.level = savedAxe.level || this.axeUpgrade.level;
            this.axeUpgrade.material = savedAxe.material || this.axeUpgrade.material;
            this.axeUpgrade.enchantments = savedAxe.enchantments || this.axeUpgrade.enchantments;
            this.axeUpgrade.stats = savedAxe.stats || this.axeUpgrade.stats;
        }
        
        // Load building data
        const savedBuildings = this.registry.get('buildings');
        if (savedBuildings) {
            Object.keys(savedBuildings).forEach(type => {
                const building = savedBuildings[type];
                this.baseBuilding.setBuildingData(type, building);
            });
        }
    }

    createUI() {
        // Title
        this.add.text(200, 40, 'EQUIPMENT & BUILDINGS', {
            fontSize: '24px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Resource display
        this.add.rectangle(200, 95, 380, 60, 0x000000, 0.1).setOrigin(0.5);
        this.add.text(20, 75, `💰 Coins: ${this.playerResources.coins}`, {
            fontSize: '16px',
            fill: '#FFD700',
            fontWeight: 'bold'
        });

        this.add.text(20, 95, `🪵 Wood: ${this.playerResources.wood} | 🌳 Oak: ${this.playerResources.oak_wood} | 🍁 Maple: ${this.playerResources.maple_syrup}`, {
            fontSize: '12px',
            fill: '#2d4a2b'
        });
        
        this.add.text(20, 110, `🌲 Birch: ${this.playerResources.birch_bark} | 🌿 Pine: ${this.playerResources.pine_resin}`, {
            fontSize: '12px',
            fill: '#2d4a2b'
        });

        // AXE UPGRADES SECTION
        this.add.text(200, 150, 'AXE UPGRADES', {
            fontSize: '20px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const axeInfo = this.axeUpgrade.getAxeInfo();
        this.add.text(200, 175, `⚔️ Current: ${axeInfo.material.toUpperCase()} AXE`, {
            fontSize: '14px',
            fill: '#FFD700',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.add.text(200, 190, `Level ${axeInfo.level} | Power: ${axeInfo.stats.power}`, {
            fontSize: '12px',
            fill: '#4a6741'
        }).setOrigin(0.5);

        const axeTypes = this.axeUpgrade.getAxeTypes();
        axeTypes.forEach((axe, index) => {
            const y = 220 + (index * 35);
            const canUpgrade = this.axeUpgrade.canUpgrade(axe.material, this.playerResources);
            const isOwned = axeInfo.material === axe.material;
            
            let buttonColor, textColor, statusText, statusColor;
            
            if (isOwned) {
                buttonColor = 0x4169E1;
                textColor = '#ffffff';
                statusText = '✓ OWNED';
                statusColor = '#00FF00';
            } else if (canUpgrade) {
                buttonColor = 0x228B22;
                textColor = '#ffffff';
                statusText = '💰 CAN AFFORD';
                statusColor = '#FFD700';
            } else {
                buttonColor = 0x666666;
                textColor = '#999999';
                statusText = '❌ TOO EXPENSIVE';
                statusColor = '#FF4500';
            }
            
            const button = this.add.rectangle(200, y, 350, 30, buttonColor)
                .setInteractive()
                .on('pointerdown', () => {
                    if (!isOwned) {
                        this.upgradeAxe(axe.material, axe.cost);
                    }
                });

            this.add.text(200, y, axe.name, {
                fontSize: '14px',
                fill: textColor,
                fontWeight: 'bold'
            }).setOrigin(0.5);

            // Stats display
            this.add.text(30, y + 18, `Power: ${axe.power} | Cost: ${axe.cost} coins`, {
                fontSize: '10px',
                fill: '#2d4a2b'
            });

            this.add.text(370, y + 18, statusText, {
                fontSize: '10px',
                fill: statusColor,
                fontWeight: 'bold'
            }).setOrigin(1, 0.5);
        });

        // BUILDINGS SECTION
        this.add.text(200, 360, 'BUILDINGS', {
            fontSize: '20px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const buildingTypes = ['warehouse', 'smithy', 'lodge', 'workshop'];
        const descriptions = this.baseBuilding.getBuildingDescriptions();
        const buildingIcons = { warehouse: '🏪', smithy: '🔨', lodge: '🏠', workshop: '⚙️' };
        
        buildingTypes.forEach((type, index) => {
            const y = 390 + (index * 35);
            const buildingInfo = this.baseBuilding.getBuildingInfo(type);
            const desc = descriptions[type];
            const canUpgrade = this.baseBuilding.canUpgrade(type, this.playerResources);
            
            const buttonColor = canUpgrade ? 0x4169E1 : 0x666666;
            const textColor = canUpgrade ? '#ffffff' : '#999999';
            
            const button = this.add.rectangle(200, y, 350, 30, buttonColor)
                .setInteractive()
                .on('pointerdown', () => this.upgradeBuilding(type));

            this.add.text(200, y, `${buildingIcons[type]} ${desc.name}`, {
                fontSize: '14px',
                fill: textColor,
                fontWeight: 'bold'
            }).setOrigin(0.5);

            // Building info
            this.add.text(30, y + 18, `${desc.currentEffect}`, {
                fontSize: '10px',
                fill: '#2d4a2b'
            });
            
            this.add.text(370, y + 18, `Cost: ${buildingInfo.upgradeCost} coins`, {
                fontSize: '10px',
                fill: canUpgrade ? '#2d4a2b' : '#666666'
            }).setOrigin(1, 0.5);
        });

        // ENCHANTMENTS SECTION
        this.add.text(200, 530, 'ENCHANTMENTS', {
            fontSize: '18px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const enchantments = this.axeUpgrade.getEnchantments();
        enchantments.slice(0, 3).forEach((enchantment, index) => {
            const y = 560 + (index * 30);
            const canEnchant = this.axeUpgrade.canEnchant(enchantment.name, this.playerResources);
            const hasEnchantment = this.axeUpgrade.enchantments.includes(enchantment.name);
            
            let buttonColor, textColor, statusText, statusColor;
            
            if (hasEnchantment) {
                buttonColor = 0x4169E1;
                textColor = '#ffffff';
                statusText = '✓ OWNED';
                statusColor = '#00FF00';
            } else if (canEnchant) {
                buttonColor = 0x800080;
                textColor = '#ffffff';
                statusText = '💰 CAN AFFORD';
                statusColor = '#FFD700';
            } else {
                buttonColor = 0x666666;
                textColor = '#999999';
                statusText = '❌ TOO EXPENSIVE';
                statusColor = '#FF4500';
            }
            
            const button = this.add.rectangle(200, y, 300, 25, buttonColor)
                .setInteractive()
                .on('pointerdown', () => {
                    if (!hasEnchantment) {
                        this.addEnchantment(enchantment.name, enchantment.cost);
                    }
                });

            this.add.text(200, y, `✨ ${enchantment.name}`, {
                fontSize: '12px',
                fill: textColor,
                fontWeight: 'bold'
            }).setOrigin(0.5);

            this.add.text(30, y + 15, `${enchantment.cost} coins`, {
                fontSize: '10px',
                fill: '#2d4a2b'
            });
            
            this.add.text(370, y + 15, statusText, {
                fontSize: '10px',
                fill: statusColor,
                fontWeight: 'bold'
            }).setOrigin(1, 0.5);
        });

        // Navigation buttons
        const buttonY = 650;
        

        // Player upgrades button
        const playerButton = this.add.rectangle(120, buttonY + 40, 150, 35, 0x228B22)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('PlayerUpgradeScene'));

        this.add.text(120, buttonY + 40, '📊 PLAYER', {
            fontSize: '14px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Back to base button
        const backButton = this.add.rectangle(280, buttonY + 40, 150, 35, 0x654321)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('BaseScene'));

        this.add.text(280, buttonY + 40, '🏠 BACK', {
            fontSize: '14px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
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
        // Save data back to registry
        this.registry.set('playerResources', this.playerResources);
        this.registry.set('axeUpgrade', this.axeUpgrade);
        
        // Save building data
        const buildingData = {};
        const buildingTypes = ['warehouse', 'smithy', 'lodge', 'workshop'];
        buildingTypes.forEach(type => {
            const info = this.baseBuilding.getBuildingInfo(type);
            buildingData[type] = {
                level: info.level,
                unlocked: info.unlocked,
                upgradeCost: info.upgradeCost
            };
        });
        this.registry.set('buildings', buildingData);
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
        
        // Get BaseScene for additional data
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