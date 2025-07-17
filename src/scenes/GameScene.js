import Phaser from 'phaser';
import { ProceduralGeneration } from '../utils/ProceduralGeneration.js';
import { DayNightCycle } from '../utils/DayNightCycle.js';
import { SpriteLoader } from '../utils/SpriteLoader.js';
import { SaveSystem } from '../utils/SaveSystem.js';
import { VirtualJoystick } from '../utils/VirtualJoystick.js';
import { AxeUpgrade } from '../objects/AxeUpgrade.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.trees = null;
        this.enemies = null;
        this.resources = { wood: 0, coins: 0, oak_wood: 0, maple_syrup: 0, birch_bark: 0, pine_resin: 0 };
        this.stamina = 100;
        this.maxStamina = 100;
        this.isMoving = false;
        this.lastMovementTime = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.worldWidth = 4000;
        this.worldHeight = 3000;
        this.baseX = this.worldWidth / 2;
        this.baseY = this.worldHeight - 300;
        this.procedural = new ProceduralGeneration(this);
        this.dayNightCycle = new DayNightCycle(this);
        this.enemySpawnRate = 1.0;
        this.nightBonus = false;
        this.axeUpgrade = new AxeUpgrade();
        this.spriteLoader = new SpriteLoader(this);
        this.playerDirection = 'neutral'; // Track player direction
        this.saveSystem = new SaveSystem();
        this.virtualJoystick = null;
    }

    preload() {
        // Try to load custom sprites first
        this.spriteLoader.loadCustomSprites();
    }
    
    create() {
        // Generate fallback sprites for any missing custom sprites
        this.createSimpleTextures();
        
        this.cameras.main.setBackgroundColor('#87CEEB');
        
        // Try to load saved game first
        this.loadSavedGame();
        
        // Load resources from registry if they exist
        const savedResources = this.registry.get('playerResources');
        if (savedResources) {
            this.resources = savedResources;
        } else {
            // First time - save initial resources to registry
            this.registry.set('playerResources', this.resources);
        }
        
        this.createWorld();
        this.createPlayer();
        this.createTrees();
        this.createEnemies();
        this.setupCollisions();
        this.createUI();
        this.setupInput();
        this.virtualJoystick = new VirtualJoystick(this);
        this.dayNightCycle.create();
    }

    createSimpleTextures() {
        // Generate simple sprites as fallback
        this.spriteLoader.generateSimpleSprites();
    }

    createWorld() {
        this.physics.world.setBounds(100, 100, this.worldWidth - 200, this.worldHeight - 200);
        
        // Create ground
        for (let y = this.worldHeight - 100; y < this.worldHeight; y += 100) {
            for (let x = 0; x < this.worldWidth; x += 800) {
                this.add.image(x + 400, y, 'ground');
            }
        }
        
        // Create mountain boundaries
        this.mountains = this.physics.add.staticGroup();
        
        // Top mountains
        for (let x = 0; x < this.worldWidth; x += 100) {
            const mountain = this.mountains.create(x + 50, 75, 'mountain');
            mountain.setImmovable(true);
        }
        
        // Bottom mountains
        for (let x = 0; x < this.worldWidth; x += 100) {
            const mountain = this.mountains.create(x + 50, this.worldHeight - 75, 'mountain');
            mountain.setImmovable(true);
        }
        
        // Left mountains
        for (let y = 100; y < this.worldHeight - 100; y += 100) {
            const mountain = this.mountains.create(75, y + 50, 'mountain');
            mountain.setImmovable(true);
        }
        
        // Right mountains
        for (let y = 100; y < this.worldHeight - 100; y += 100) {
            const mountain = this.mountains.create(this.worldWidth - 75, y + 50, 'mountain');
            mountain.setImmovable(true);
        }
        
        // Create base area
        this.createBaseArea();
    }

    createPlayer() {
        this.player = this.physics.add.sprite(this.baseX, this.baseY, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setBounce(0.2);
        
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setLerp(0.1, 0.1);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        
        // Add collision with mountains
        this.physics.add.collider(this.player, this.mountains);
    }

    setupCollisions() {
        // Add collision between player and trees
        this.physics.add.collider(this.player, this.trees);
    }

    updatePlayerSprite(direction) {
        if (direction === this.playerDirection) return;
        
        this.playerDirection = direction;
        let spriteKey = 'player';
        
        switch (direction) {
            case 'left':
                spriteKey = 'player_left';
                break;
            case 'right':
                spriteKey = 'player_right';
                break;
            default:
                spriteKey = 'player';
                break;
        }
        
        this.player.setTexture(spriteKey);
    }
    
    createBaseArea() {
        // Create base buildings
        this.baseBuildings = this.physics.add.staticGroup();
        
        // Main base building
        const mainBuilding = this.baseBuildings.create(this.baseX, this.baseY - 50, 'base_building');
        mainBuilding.setImmovable(true);
        
        // Base marker (golden circle)
        this.baseMarker = this.add.image(this.baseX, this.baseY + 50, 'base_marker');
        this.baseMarker.setInteractive();
        this.baseMarker.on('pointerdown', () => this.openBaseMenu());
        
        // Base area indicator
        this.baseZone = this.add.circle(this.baseX, this.baseY, 150, 0x228B22, 0.1);
        
        // Add text
        this.add.text(this.baseX, this.baseY + 100, 'YOUR BASE', {
            fontSize: '24px',
            fill: '#2d4a2b',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(this.baseX, this.baseY + 120, 'Click to upgrade, sell & sleep', {
            fontSize: '14px',
            fill: '#4a6741'
        }).setOrigin(0.5);
    }

    createTrees() {
        this.trees = this.physics.add.group();
        
        const zones = this.procedural.generateForestZones(this.worldWidth, this.worldHeight);
        
        zones.forEach(zone => {
            // Don't spawn trees too close to base
            const distanceToBase = Math.sqrt(Math.pow(zone.x - this.baseX, 2) + Math.pow(zone.y - this.baseY, 2));
            if (distanceToBase < 200) return;
            
            // Don't spawn trees too close to mountains
            if (zone.x < 200 || zone.x > this.worldWidth - 200 || 
                zone.y < 200 || zone.y > this.worldHeight - 200) return;
            
            const treesInZone = this.procedural.generateTreesInZone(zone, this.baseX, this.baseY);
            
            treesInZone.forEach(treeData => {
                const texture = this.getTreeTexture(treeData.type);
                const tree = this.trees.create(treeData.x, treeData.y, texture);
                tree.setImmovable(true);
                tree.health = treeData.health;
                tree.maxHealth = treeData.health;
                tree.treeType = treeData.type;
                tree.resources = treeData.resources;
            });
        });
    }
    
    getTreeTexture(treeType) {
        switch (treeType) {
            case 'sturdy': return 'sturdy_tree';
            case 'oak': return 'oak_tree';
            case 'maple': return 'maple_tree';
            case 'birch': return 'birch_tree';
            case 'pine': return 'pine_tree';
            default: return 'tree';
        }
    }

    createEnemies() {
        this.enemies = this.physics.add.group();
        
        const zones = this.procedural.generateForestZones(this.worldWidth, this.worldHeight);
        const enemyData = this.procedural.generateEnemies(zones);
        
        enemyData.forEach(enemy => {
            // Don't spawn enemies too close to base
            const distanceToBase = Math.sqrt(Math.pow(enemy.x - this.baseX, 2) + Math.pow(enemy.y - this.baseY, 2));
            if (distanceToBase < 300) return;
            
            // Don't spawn enemies too close to mountains
            if (enemy.x < 200 || enemy.x > this.worldWidth - 200 || 
                enemy.y < 200 || enemy.y > this.worldHeight - 200) return;
            
            const texture = enemy.type === 'stump' ? 'stump_enemy' : 'spirit_enemy';
            const enemySprite = this.enemies.create(enemy.x, enemy.y, texture);
            enemySprite.setImmovable(true);
            enemySprite.health = enemy.health;
            enemySprite.maxHealth = enemy.health;
            enemySprite.damage = enemy.damage;
            enemySprite.enemyType = enemy.type;
        });
        
        this.physics.add.overlap(this.player, this.enemies, this.handleEnemyCollision, null, this);
    }

    createUI() {
        const uiContainer = this.add.container(0, 0);
        uiContainer.setScrollFactor(0);
        
        this.add.rectangle(10, 10, 240, 140, 0x000000, 0.5).setOrigin(0, 0).setScrollFactor(0);
        
        this.woodText = this.add.text(20, 20, 'Wood: 0', { fontSize: '14px', fill: '#ffffff' }).setScrollFactor(0);
        this.coinsText = this.add.text(20, 35, 'Coins: 0', { fontSize: '14px', fill: '#ffffff' }).setScrollFactor(0);
        this.healthText = this.add.text(20, 50, 'Health: 100', { fontSize: '14px', fill: '#ffffff' }).setScrollFactor(0);
        this.staminaText = this.add.text(20, 65, 'Stamina: 100', { fontSize: '14px', fill: '#ffffff' }).setScrollFactor(0);
        this.timeText = this.add.text(20, 80, 'Time: 12:00', { fontSize: '14px', fill: '#87CEEB' }).setScrollFactor(0);
        
        this.specialText = this.add.text(20, 100, 'Oak: 0 | Maple: 0', { fontSize: '12px', fill: '#FFD700' }).setScrollFactor(0);
        this.specialText2 = this.add.text(20, 115, 'Birch: 0 | Pine: 0', { fontSize: '12px', fill: '#FFD700' }).setScrollFactor(0);
        
        const menuButton = this.add.rectangle(350, 30, 80, 40, 0x8B4513).setOrigin(0.5, 0.5).setScrollFactor(0);
        menuButton.setInteractive();
        menuButton.on('pointerdown', () => this.scene.start('MenuScene'));
        
        this.add.text(350, 30, 'MENU', { fontSize: '14px', fill: '#ffffff', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        
        const chopButton = this.add.circle(350, 580, 30, 0x228B22).setOrigin(0.5, 0.5).setScrollFactor(0);
        chopButton.setStrokeStyle(3, 0x1a6b1a);
        chopButton.setInteractive();
        chopButton.on('pointerdown', () => this.chopNearbyTree());
        
        this.add.text(350, 580, 'CHOP', { fontSize: '12px', fill: '#ffffff', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        
        const attackButton = this.add.circle(280, 620, 30, 0xFF4500).setOrigin(0.5, 0.5).setScrollFactor(0);
        attackButton.setStrokeStyle(3, 0xcc3300);
        attackButton.setInteractive();
        attackButton.on('pointerdown', () => this.attackNearbyEnemy());
        
        this.add.text(280, 620, 'ATTACK', { fontSize: '12px', fill: '#ffffff', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0);
        
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
    }

    movePlayerTo(x, y) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
        
        if (distance < 50) {
            this.checkForTreeChop(x, y);
        } else {
            // Calculate movement speed based on stamina
            let moveSpeed = 200;
            if (this.stamina < 30) {
                moveSpeed = 100;
            } else if (this.stamina < 60) {
                moveSpeed = 150;
            }
            
            // Determine direction based on target position
            const deltaX = x - this.player.x;
            if (Math.abs(deltaX) > 10) { // Only change direction if significant horizontal movement
                if (deltaX > 0) {
                    this.updatePlayerSprite('right');
                } else {
                    this.updatePlayerSprite('left');
                }
            }
            
            this.physics.moveToObject(this.player, { x, y }, moveSpeed);
            
            this.time.delayedCall(distance / moveSpeed * 1000, () => {
                this.player.setVelocity(0, 0);
                this.updatePlayerSprite('neutral');
            });
        }
    }

    checkForTreeChop(x, y) {
        const nearbyTree = this.trees.children.entries.find(tree => {
            const distance = Phaser.Math.Distance.Between(tree.x, tree.y, x, y);
            return distance < 30;
        });
        
        if (nearbyTree && this.stamina > 10) {
            this.chopTree(nearbyTree);
        }
    }

    chopNearbyTree() {
        const nearbyTree = this.trees.children.entries.find(tree => {
            const distance = Phaser.Math.Distance.Between(tree.x, tree.y, this.player.x, this.player.y);
            return distance < 60;
        });
        
        if (nearbyTree && this.stamina > 10) {
            this.chopTree(nearbyTree);
        }
    }

    chopTree(tree) {
        // Check if player has enough stamina
        if (this.stamina < 5) {
            const message = this.add.text(tree.x, tree.y - 50, 'Too tired to chop!', {
                fontSize: '16px',
                fill: '#FF0000',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            this.time.delayedCall(2000, () => {
                message.destroy();
            });
            return;
        }
        
        const treeResources = tree.resources;
        const axePower = this.axeUpgrade.stats.power;
        
        // Check if axe is powerful enough
        if (axePower < treeResources.requiredPower) {
            // Show message that axe is too weak
            const message = this.add.text(tree.x, tree.y - 50, 'Axe too weak!', {
                fontSize: '16px',
                fill: '#FF0000',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            this.time.delayedCall(2000, () => {
                message.destroy();
            });
            return;
        }
        
        // Use less stamina for chopping (based on tree type)
        let staminaCost = 5;
        if (treeResources.requiredPower >= 3) {
            staminaCost = 8; // Harder trees cost more stamina
        } else if (treeResources.requiredPower >= 2) {
            staminaCost = 6;
        }
        
        this.stamina = Math.max(0, this.stamina - staminaCost);
        tree.health--;
        
        tree.setTint(0xff9999);
        this.time.delayedCall(200, () => {
            tree.clearTint();
        });
        
        if (tree.health <= 0) {
            const woodGained = treeResources.wood;
            this.resources.wood += woodGained;
            
            if (treeResources.special) {
                this.resources[treeResources.special] += 1;
            }
            
            // Show wood gained message
            const message = this.add.text(tree.x, tree.y - 30, `+${woodGained} wood`, {
                fontSize: '14px',
                fill: '#00FF00',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            this.time.delayedCall(1500, () => {
                message.destroy();
            });
            
            this.updateUI();
            tree.destroy();
        }
    }
    
    attackNearbyEnemy() {
        // Check if player has enough stamina
        if (this.stamina < 15) {
            const message = this.add.text(this.player.x, this.player.y - 50, 'Too tired to fight!', {
                fontSize: '16px',
                fill: '#FF0000',
                fontWeight: 'bold'
            }).setOrigin(0.5);
            
            this.time.delayedCall(2000, () => {
                message.destroy();
            });
            return;
        }
        
        const nearbyEnemy = this.enemies.children.entries.find(enemy => {
            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            return distance < 60;
        });
        
        if (nearbyEnemy) {
            this.attackEnemy(nearbyEnemy);
        }
    }
    
    attackEnemy(enemy) {
        this.stamina = Math.max(0, this.stamina - 15);
        enemy.health -= 10;
        
        enemy.setTint(0xff0000);
        this.time.delayedCall(300, () => {
            enemy.clearTint();
        });
        
        if (enemy.health <= 0) {
            this.resources.coins += enemy.enemyType === 'stump' ? 5 : 8;
            this.updateUI();
            enemy.destroy();
        }
    }
    
    handleEnemyCollision(player, enemy) {
        if (this.time.now > (this.lastDamageTime || 0) + 1000) {
            this.health = Math.max(0, this.health - enemy.damage);
            this.lastDamageTime = this.time.now;
            
            player.setTint(0xff0000);
            this.time.delayedCall(500, () => {
                player.clearTint();
            });
            
            if (this.health <= 0) {
                this.gameOver();
            }
            
            this.updateUI();
        }
    }
    
    gameOver() {
        this.add.text(400, 300, 'GAME OVER', {
            fontSize: '48px',
            fill: '#ff0000',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        this.add.rectangle(400, 400, 200, 60, 0x8B4513)
            .setInteractive()
            .on('pointerdown', () => this.scene.restart())
            .setScrollFactor(0);
        
        this.add.text(400, 400, 'RESTART', {
            fontSize: '20px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        this.physics.pause();
    }
    
    
    openBaseMenu() {
        this.showBaseInterface();
    }
    
    showBaseInterface() {
        // Create base interface overlay
        this.baseInterface = this.add.container(0, 0);
        this.baseInterface.setScrollFactor(0);
        
        // Background
        const bg = this.add.rectangle(200, 350, 380, 500, 0x000000, 0.8);
        bg.setScrollFactor(0);
        this.baseInterface.add(bg);
        
        // Title
        const title = this.add.text(200, 120, 'BASE MANAGEMENT', {
            fontSize: '24px',
            fill: '#FFD700',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(title);
        
        // Resources display
        const resourceText = this.add.text(200, 160, 
            `Wood: ${this.resources.wood} | Coins: ${this.resources.coins}`, {
            fontSize: '16px',
            fill: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(resourceText);
        
        // Sell wood button
        const sellButton = this.add.rectangle(200, 220, 300, 50, 0x228B22)
            .setInteractive()
            .on('pointerdown', () => this.sellWood())
            .setScrollFactor(0);
        this.baseInterface.add(sellButton);
        
        const sellText = this.add.text(200, 220, 'SELL WOOD', {
            fontSize: '16px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(sellText);
        
        // Sleep button
        const sleepButton = this.add.rectangle(200, 290, 300, 50, 0x800080)
            .setInteractive()
            .on('pointerdown', () => this.sleepAtBase())
            .setScrollFactor(0);
        this.baseInterface.add(sleepButton);
        
        const sleepText = this.add.text(200, 280, 'SLEEP', {
            fontSize: '16px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(sleepText);
        
        const sleepSubtext = this.add.text(200, 300, 'Restore Stamina', {
            fontSize: '12px',
            fill: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(sleepSubtext);
        
        // Upgrade button
        const upgradeButton = this.add.rectangle(200, 360, 300, 50, 0x4169E1)
            .setInteractive()
            .on('pointerdown', () => this.goToUpgrades())
            .setScrollFactor(0);
        this.baseInterface.add(upgradeButton);
        
        const upgradeText = this.add.text(200, 350, 'UPGRADES & EQUIPMENT', {
            fontSize: '16px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(upgradeText);
        
        const upgradeSubtext = this.add.text(200, 370, 'Axes • Buildings • Enchantments', {
            fontSize: '12px',
            fill: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(upgradeSubtext);
        
        // Save button
        const saveButton = this.add.rectangle(200, 480, 300, 50, 0x228B22)
            .setInteractive()
            .on('pointerdown', () => this.saveGameFromBaseInterface())
            .setScrollFactor(0);
        this.baseInterface.add(saveButton);
        
        const saveText = this.add.text(200, 480, '💾 SAVE GAME', {
            fontSize: '16px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(saveText);
        
        // Close button
        const closeButton = this.add.rectangle(200, 540, 200, 40, 0x8B4513)
            .setInteractive()
            .on('pointerdown', () => this.closeBaseInterface())
            .setScrollFactor(0);
        this.baseInterface.add(closeButton);
        
        const closeText = this.add.text(200, 540, 'CLOSE', {
            fontSize: '16px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        this.baseInterface.add(closeText);
    }
    
    sellWood() {
        if (this.resources.wood > 0) {
            const coinsEarned = this.resources.wood * 2;
            this.resources.coins += coinsEarned;
            this.resources.wood = 0;
            
            // Show feedback
            const feedbackText = this.add.text(400, 450, `Sold all wood for ${coinsEarned} coins!`, {
                fontSize: '18px',
                fill: '#00FF00',
                fontWeight: 'bold'
            }).setOrigin(0.5).setScrollFactor(0);
            
            this.time.delayedCall(2000, () => {
                feedbackText.destroy();
            });
            
            this.updateUI();
            this.closeBaseInterface();
            this.showBaseInterface();
        }
    }
    
    sleepAtBase() {
        // Restore stamina to full
        this.stamina = this.maxStamina;
        
        // Advance to next day
        this.dayNightCycle.setTimeOfDay(0.25); // Set to morning
        
        // Show feedback
        const feedbackText = this.add.text(400, 420, 'You slept well! Stamina restored and new day begins!', {
            fontSize: '16px',
            fill: '#00FF00',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        this.time.delayedCall(3000, () => {
            feedbackText.destroy();
        });
        
        this.updateUI();
        this.closeBaseInterface();
    }

    goToUpgrades() {
        this.closeBaseInterface();
        this.scene.start('BaseScene');
    }
    
    closeBaseInterface() {
        if (this.baseInterface) {
            this.baseInterface.destroy();
            this.baseInterface = null;
        }
    }

    updateUI() {
        this.woodText.setText(`Wood: ${this.resources.wood}`);
        this.coinsText.setText(`Coins: ${this.resources.coins}`);
        this.healthText.setText(`Health: ${this.health}`);
        this.staminaText.setText(`Stamina: ${Math.floor(this.stamina)}`);
        this.timeText.setText(`Time: ${this.dayNightCycle.getTimeString()}`);
        this.specialText.setText(`Oak: ${this.resources.oak_wood} | Maple: ${this.resources.maple_syrup}`);
        this.specialText2.setText(`Birch: ${this.resources.birch_bark} | Pine: ${this.resources.pine_resin}`);
        
        // Save resources to registry for other scenes to access
        this.registry.set('playerResources', this.resources);
    }

    update() {
        let isMovingNow = false;
        let moveSpeed = 200;
        
        // Calculate movement speed based on stamina
        if (this.stamina < 30) {
            moveSpeed = 100; // Slow when tired
        } else if (this.stamina < 60) {
            moveSpeed = 150; // Medium speed when moderately tired
        }
        
        // Check keyboard input
        const keyboardMoving = this.cursors.left.isDown || this.cursors.right.isDown || 
                              this.cursors.up.isDown || this.cursors.down.isDown;
        
        // Check virtual joystick input
        const joystickActive = this.virtualJoystick && this.virtualJoystick.isActive();
        
        if (keyboardMoving) {
            // Handle keyboard movement
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-moveSpeed);
                this.updatePlayerSprite('left');
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(moveSpeed);
                this.updatePlayerSprite('right');
            } else {
                this.player.setVelocityX(0);
            }

            if (this.cursors.up.isDown) {
                this.player.setVelocityY(-moveSpeed);
            } else if (this.cursors.down.isDown) {
                this.player.setVelocityY(moveSpeed);
            } else {
                this.player.setVelocityY(0);
            }
            
            // Return to neutral sprite when not moving horizontally
            if (!this.cursors.left.isDown && !this.cursors.right.isDown) {
                this.updatePlayerSprite('neutral');
            }
            
            isMovingNow = true;
        } else if (joystickActive) {
            // Handle joystick movement
            const direction = this.virtualJoystick.getDirection();
            const force = this.virtualJoystick.getForce();
            
            const velocityX = direction.x * moveSpeed * force;
            const velocityY = direction.y * moveSpeed * force;
            
            this.player.setVelocity(velocityX, velocityY);
            
            // Update sprite based on horizontal movement
            if (Math.abs(direction.x) > 0.1) {
                if (direction.x > 0) {
                    this.updatePlayerSprite('right');
                } else {
                    this.updatePlayerSprite('left');
                }
            } else {
                this.updatePlayerSprite('neutral');
            }
            
            isMovingNow = true;
        } else {
            // No movement input
            this.player.setVelocity(0, 0);
            this.updatePlayerSprite('neutral');
        }
        
        // Handle stamina
        if (isMovingNow) {
            // Drain stamina while moving
            if (this.time.now > this.lastMovementTime + 1000) { // Every 1 second instead of 0.5
                this.stamina = Math.max(0, this.stamina - 1); // Reduced from 2 to 1
                this.lastMovementTime = this.time.now;
            }
            this.isMoving = true;
        } else {
            this.isMoving = false;
            // Slightly faster regeneration when not moving
            if (this.stamina < this.maxStamina) {
                this.stamina = Math.min(this.maxStamina, this.stamina + 0.1); // Increased from 0.05
            }
        }
        
        this.dayNightCycle.update();
        this.updateUI();
    }

    loadSavedGame() {
        const loadResult = this.saveSystem.loadGame();
        if (loadResult.success && loadResult.data) {
            const saveData = loadResult.data;
            
            // Restore resources
            this.resources = saveData.resources;
            
            // Restore game state
            this.health = saveData.gameState.health;
            this.maxHealth = saveData.gameState.maxHealth;
            this.stamina = saveData.gameState.stamina;
            this.maxStamina = saveData.gameState.maxStamina;
            
            // Restore axe upgrade
            this.axeUpgrade.level = saveData.axeUpgrade.level;
            this.axeUpgrade.material = saveData.axeUpgrade.material;
            this.axeUpgrade.enchantments = saveData.axeUpgrade.enchantments;
            this.axeUpgrade.stats = saveData.axeUpgrade.stats;
            
            // Save to registry for other scenes
            this.registry.set('playerResources', this.resources);
            this.registry.set('playerStats', saveData.playerStats);
            this.registry.set('axeUpgrade', this.axeUpgrade);
            this.registry.set('buildings', saveData.buildings);
            
            console.log('Game loaded successfully!');
        }
    }

    saveGame() {
        const baseScene = this.scene.get('BaseScene');
        const saveResult = this.saveSystem.saveGame(this, baseScene);
        
        // Show save feedback
        const message = this.add.text(400, 200, saveResult.message, {
            fontSize: '24px',
            fill: saveResult.success ? '#00FF00' : '#FF0000',
            fontWeight: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        if (saveResult.success) {
            this.add.text(400, 230, `Lagret: ${saveResult.timestamp}`, {
                fontSize: '16px',
                fill: '#ffffff',
                fontWeight: 'bold'
            }).setOrigin(0.5).setScrollFactor(0);
        }
        
        // Remove message after 3 seconds
        this.time.delayedCall(3000, () => {
            message.destroy();
        });
        
        return saveResult;
    }
    
    saveGameFromBaseInterface() {
        const saveResult = this.saveGame();
        
        // Close the base interface after saving
        this.closeBaseInterface();
        
        return saveResult;
    }
}