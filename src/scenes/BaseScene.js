import Phaser from 'phaser';
import { AxeUpgrade } from '../objects/AxeUpgrade.js';
import { BaseBuilding } from '../objects/BaseBuilding.js';

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
        this.playerResources = {
            wood: 50,
            coins: 200,
            oak_wood: 5,
            maple_syrup: 3,
            birch_bark: 2,
            pine_resin: 4
        };
        this.axeUpgrade = new AxeUpgrade();
        this.baseBuilding = new BaseBuilding(this);
    }

    preload() {
        this.createBaseTextures();
    }

    create() {
        this.cameras.main.setBackgroundColor('#98FB98');
        
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
        this.add.text(400, 50, 'YOUR BASE', {
            fontSize: '36px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const buildings = [
            { key: 'warehouse', x: 150, name: 'WAREHOUSE', type: 'warehouse' },
            { key: 'smithy', x: 300, name: 'SMITHY', type: 'smithy' },
            { key: 'house', x: 450, name: 'LODGE', type: 'lodge' },
            { key: 'house', x: 600, name: 'WORKSHOP', type: 'workshop' }
        ];

        buildings.forEach(building => {
            const buildingSprite = this.add.image(building.x, 150, building.key)
                .setInteractive()
                .on('pointerdown', () => this.showBuildingInfo(building.type));
            
            const buildingInfo = this.baseBuilding.getBuildingInfo(building.type);
            
            this.add.text(building.x, 190, building.name, { 
                fontSize: '12px', 
                fill: '#2d4a2b',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            this.add.text(building.x, 205, `Level ${buildingInfo.level}`, { 
                fontSize: '10px', 
                fill: '#8B4513'
            }).setOrigin(0.5);

            if (building.type === 'workshop' && !buildingInfo.unlocked) {
                buildingSprite.setTint(0x666666);
                this.add.text(building.x, 220, 'LOCKED', { 
                    fontSize: '10px', 
                    fill: '#FF0000'
                }).setOrigin(0.5);
            }
        });
    }

    createUI() {
        this.add.rectangle(10, 240, 780, 350, 0x000000, 0.1);
        
        this.add.text(30, 220, 'UPGRADES & EQUIPMENT', {
            fontSize: '24px',
            fill: '#2d4a2b',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        });

        this.add.text(30, 260, `Resources: Wood: ${this.playerResources.wood} | Coins: ${this.playerResources.coins}`, {
            fontSize: '16px',
            fill: '#2d4a2b'
        });

        this.add.text(30, 280, `Special: Oak: ${this.playerResources.oak_wood} | Maple: ${this.playerResources.maple_syrup} | Birch: ${this.playerResources.birch_bark} | Pine: ${this.playerResources.pine_resin}`, {
            fontSize: '14px',
            fill: '#8B4513'
        });

        this.add.text(30, 305, 'SKILLS', {
            fontSize: '18px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        });

        this.add.text(30, 325, `Skill Points: ${this.playerStats.skillPoints}`, {
            fontSize: '16px',
            fill: '#2d4a2b'
        });

        const upgradeButtons = [
            { name: 'Strength', stat: 'strength', cost: this.playerStats.strength * 2, y: 345 },
            { name: 'Speed', stat: 'speed', cost: this.playerStats.speed * 2, y: 365 },
            { name: 'Stamina', stat: 'stamina', cost: this.playerStats.stamina * 2, y: 385 }
        ];

        upgradeButtons.forEach(upgrade => {
            const button = this.add.rectangle(150, upgrade.y, 100, 20, 0x8B4513)
                .setInteractive()
                .on('pointerdown', () => this.upgradeSkill(upgrade.stat));

            this.add.text(150, upgrade.y, `+${upgrade.name}`, {
                fontSize: '12px',
                fill: '#ffffff',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            this.add.text(270, upgrade.y, `Level ${this.playerStats[upgrade.stat]} (Cost: ${upgrade.cost})`, {
                fontSize: '12px',
                fill: '#2d4a2b'
            }).setOrigin(0, 0.5);
        });

        this.add.text(450, 305, 'AXE UPGRADES', {
            fontSize: '18px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        });

        const axeInfo = this.axeUpgrade.getAxeInfo();
        this.add.text(450, 325, `Current: ${axeInfo.material} (Level ${axeInfo.level})`, {
            fontSize: '14px',
            fill: '#2d4a2b'
        });

        const axeTypes = this.axeUpgrade.getAxeTypes();
        axeTypes.slice(1, 4).forEach((axe, index) => {
            const y = 345 + (index * 20);
            const canUpgrade = this.axeUpgrade.canUpgrade(axe.material, this.playerResources);
            
            const button = this.add.rectangle(520, y, 100, 18, canUpgrade ? 0x228B22 : 0x666666)
                .setInteractive()
                .on('pointerdown', () => this.upgradeAxe(axe.material, axe.cost));

            this.add.text(520, y, axe.name, {
                fontSize: '11px',
                fill: '#ffffff',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            this.add.text(640, y, `${axe.cost} coins`, {
                fontSize: '11px',
                fill: canUpgrade ? '#2d4a2b' : '#666666'
            }).setOrigin(0, 0.5);
        });

        this.add.text(30, 420, 'BUILDINGS', {
            fontSize: '18px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        });

        const buildingTypes = ['warehouse', 'smithy', 'lodge', 'workshop'];
        const descriptions = this.baseBuilding.getBuildingDescriptions();
        
        buildingTypes.forEach((type, index) => {
            const y = 440 + (index * 30);
            const buildingInfo = this.baseBuilding.getBuildingInfo(type);
            const desc = descriptions[type];
            const canUpgrade = this.baseBuilding.canUpgrade(type, this.playerResources);
            
            const button = this.add.rectangle(150, y, 120, 25, canUpgrade ? 0x4169E1 : 0x666666)
                .setInteractive()
                .on('pointerdown', () => this.upgradeBuilding(type));

            this.add.text(150, y, `Upgrade ${desc.name}`, {
                fontSize: '11px',
                fill: '#ffffff',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            this.add.text(280, y - 5, `${desc.currentEffect}`, {
                fontSize: '10px',
                fill: '#2d4a2b'
            }).setOrigin(0, 0.5);
            
            this.add.text(280, y + 5, `Cost: ${buildingInfo.upgradeCost} coins`, {
                fontSize: '10px',
                fill: canUpgrade ? '#2d4a2b' : '#666666'
            }).setOrigin(0, 0.5);
        });

        const backButton = this.add.rectangle(700, 560, 80, 30, 0x654321)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('MenuScene'));

        this.add.text(700, 560, 'BACK', {
            fontSize: '14px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        const adventureButton = this.add.rectangle(600, 560, 80, 30, 0x228B22)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('GameScene'));

        this.add.text(600, 560, 'ADVENTURE', {
            fontSize: '12px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
    }

    upgradeSkill(stat) {
        const cost = this.playerStats[stat] * 2;
        if (this.playerStats.skillPoints >= cost) {
            this.playerStats.skillPoints -= cost;
            this.playerStats[stat]++;
            this.scene.restart();
        }
    }

    upgradeAxe(material, cost) {
        if (this.playerResources.coins >= cost) {
            this.playerResources.coins -= cost;
            this.axeUpgrade.upgradeAxe(material);
            this.scene.restart();
        }
    }

    upgradeBuilding(buildingType) {
        if (this.baseBuilding.upgradeBuilding(buildingType, this.playerResources)) {
            this.scene.restart();
        }
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