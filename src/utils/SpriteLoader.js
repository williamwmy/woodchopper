export class SpriteLoader {
    constructor(scene) {
        this.scene = scene;
        this.sprites = new Map();
        this.useCustomSprites = false;
        this.spriteConfig = {
            player: { width: 32, height: 32, color: 0x8B4513 },
            tree: { width: 16, height: 40, trunk: 0x8B4513, leaves: 0x228B22 },
            sturdy_tree: { width: 18, height: 42, trunk: 0x8B4513, leaves: 0x006400 },
            oak_tree: { width: 20, height: 45, trunk: 0x654321, leaves: 0x228B22 },
            maple_tree: { width: 18, height: 42, trunk: 0x8B4513, leaves: 0xFF6347 },
            birch_tree: { width: 16, height: 40, trunk: 0xF5DEB3, leaves: 0x90EE90 },
            pine_tree: { width: 18, height: 45, trunk: 0x8B4513, leaves: 0x006400 },
            stump_enemy: { width: 24, height: 16, color: 0x8B4513 },
            spirit_enemy: { width: 24, height: 24, color: 0x9370DB },
            mountain: { width: 100, height: 150, color: 0x696969 },
            base_building: { width: 150, height: 80, color: 0x8B4513 },
            base_marker: { width: 50, height: 50, color: 0xFFD700 },
            ground: { width: 800, height: 100, color: 0x228B22 }
        };
    }

    // Load custom sprites from files
    loadCustomSprites() {
        const spritePaths = [
            'player', 'tree', 'sturdy_tree', 'oak_tree', 'maple_tree', 
            'birch_tree', 'pine_tree', 'stump_enemy', 'spirit_enemy', 
            'mountain', 'base_building', 'base_marker', 'ground'
        ];
        
        spritePaths.forEach(key => {
            this.loadSpriteIfExists(key, `assets/sprites/${key}.png`);
        });
    }

    loadSpriteIfExists(key, path) {
        // Try to load custom sprite, but don't fail if it doesn't exist
        this.scene.load.image(key, path);
        
        this.scene.load.on('filecomplete-image-' + key, () => {
            // If custom sprite loaded successfully, mark it
            this.sprites.set(key, { type: 'custom', path: path });
            console.log(`Loaded custom sprite: ${key}`);
        });
        
        this.scene.load.on('loaderror', (file) => {
            if (file.key === key) {
                console.log(`Custom sprite ${key} not found, will use generated fallback`);
                // Remove the failed entry so fallback will be generated
                this.sprites.delete(key);
            }
        });
    }

    // Generate simple sprites programmatically
    generateSimpleSprites() {
        const graphics = this.scene.add.graphics();
        
        // Generate fallback sprites for all types
        const spriteTypes = [
            'player', 'tree', 'sturdy_tree', 'oak_tree', 'maple_tree', 
            'birch_tree', 'pine_tree', 'stump_enemy', 'spirit_enemy', 
            'mountain', 'base_building', 'base_marker', 'ground'
        ];
        
        spriteTypes.forEach(key => {
            this.generateFallbackSprite(graphics, key);
        });
        
        graphics.destroy();
    }
    
    generateFallbackSprite(graphics, key) {
        // Only generate if no custom sprite was loaded
        if (!this.sprites.has(key) || this.sprites.get(key).type !== 'custom') {
            switch (key) {
                case 'player':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.player;
                        graphics.fillStyle(config.color);
                        graphics.fillRect(0, 0, config.width, config.height);
                    });
                    break;
                    
                case 'tree':
                case 'sturdy_tree':
                case 'oak_tree':
                case 'maple_tree':
                case 'birch_tree':
                case 'pine_tree':
                    this.generateTreeSprite(graphics, key, this.spriteConfig[key]);
                    break;
                    
                case 'stump_enemy':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.stump_enemy;
                        graphics.fillStyle(config.color);
                        graphics.fillRect(0, 0, config.width, config.height);
                        graphics.fillStyle(0x654321);
                        graphics.fillRect(8, 4, 8, 8);
                    });
                    break;
                    
                case 'spirit_enemy':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.spirit_enemy;
                        graphics.fillStyle(config.color);
                        graphics.fillCircle(12, 12, 12);
                        graphics.fillStyle(0x800080);
                        graphics.fillCircle(8, 8, 4);
                        graphics.fillCircle(16, 8, 4);
                    });
                    break;
                    
                case 'mountain':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.mountain;
                        graphics.fillStyle(config.color);
                        graphics.fillRect(0, 0, config.width, config.height);
                        graphics.fillStyle(0x808080);
                        graphics.fillRect(10, 10, config.width - 20, config.height - 20);
                    });
                    break;
                    
                case 'base_building':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.base_building;
                        graphics.fillStyle(config.color);
                        graphics.fillRect(0, 0, config.width, config.height);
                        graphics.fillStyle(0x654321);
                        graphics.fillRect(10, 10, config.width - 20, config.height - 20);
                    });
                    break;
                    
                case 'base_marker':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.base_marker;
                        graphics.fillStyle(config.color);
                        graphics.fillCircle(25, 25, 20);
                        graphics.fillStyle(0xFFA500);
                        graphics.fillCircle(25, 25, 15);
                    });
                    break;
                    
                case 'ground':
                    this.generateSprite(graphics, key, () => {
                        const config = this.spriteConfig.ground;
                        graphics.fillStyle(config.color);
                        graphics.fillRect(0, 0, config.width, config.height);
                    });
                    break;
            }
        }
    }

    generateSprite(graphics, key, drawFunction) {
        // Always generate fallback sprite with the main key name
        graphics.clear();
        drawFunction();
        graphics.generateTexture(key, this.spriteConfig[key].width, this.spriteConfig[key].height);
        
        // Only mark as generated if no custom sprite exists
        if (!this.sprites.has(key) || this.sprites.get(key).type !== 'custom') {
            this.sprites.set(key, { type: 'generated' });
        }
    }

    generateTreeSprite(graphics, key, config) {
        this.generateSprite(graphics, key, () => {
            // Tree trunk
            graphics.fillStyle(config.trunk);
            graphics.fillRect(0, 0, config.width, config.height);
            // Tree leaves
            graphics.fillStyle(config.leaves);
            graphics.fillCircle(config.width / 2, config.width / 2, config.width / 2 + 2);
        });
    }

    // Check if a sprite exists
    hasSprite(key) {
        return this.sprites.has(key);
    }

    // Get sprite info
    getSpriteInfo(key) {
        return this.sprites.get(key);
    }

    // Add custom sprite configuration
    addSpriteConfig(key, config) {
        this.spriteConfig[key] = config;
    }

    // Enable/disable custom sprites
    setUseCustomSprites(enabled) {
        this.useCustomSprites = enabled;
    }
}