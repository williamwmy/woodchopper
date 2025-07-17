export class ProceduralGeneration {
    constructor(scene) {
        this.scene = scene;
        this.seed = Math.random();
    }

    setSeed(seed) {
        this.seed = seed;
    }

    seededRandom() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    generateForestZones(width, height) {
        const zones = [];
        const zoneSize = 200;
        
        for (let x = 0; x < width; x += zoneSize) {
            for (let y = 0; y < height; y += zoneSize) {
                const zoneType = this.seededRandom() < 0.7 ? 'forest' : 
                                this.seededRandom() < 0.3 ? 'clearing' : 'rare';
                
                zones.push({
                    x,
                    y,
                    width: zoneSize,
                    height: zoneSize,
                    type: zoneType
                });
            }
        }
        
        return zones;
    }

    generateTreesInZone(zone) {
        const trees = [];
        let treeCount;
        
        switch (zone.type) {
            case 'forest':
                treeCount = 8 + Math.floor(this.seededRandom() * 5);
                break;
            case 'clearing':
                treeCount = 2 + Math.floor(this.seededRandom() * 3);
                break;
            case 'rare':
                treeCount = 3 + Math.floor(this.seededRandom() * 2);
                break;
        }
        
        for (let i = 0; i < treeCount; i++) {
            const x = zone.x + this.seededRandom() * zone.width;
            const y = zone.y + this.seededRandom() * zone.height;
            
            const treeType = this.getTreeType(zone.type);
            
            trees.push({
                x,
                y,
                type: treeType,
                health: this.getTreeHealth(treeType),
                resources: this.getTreeResources(treeType)
            });
        }
        
        return trees;
    }

    getTreeType(zoneType) {
        if (zoneType === 'rare') {
            const rareTrees = ['oak', 'maple', 'birch', 'pine'];
            return rareTrees[Math.floor(this.seededRandom() * rareTrees.length)];
        } else {
            return this.seededRandom() < 0.8 ? 'normal' : 'sturdy';
        }
    }

    getTreeHealth(treeType) {
        switch (treeType) {
            case 'normal': return 3;
            case 'sturdy': return 5;
            case 'oak': return 7;
            case 'maple': return 6;
            case 'birch': return 4;
            case 'pine': return 5;
            default: return 3;
        }
    }

    getTreeResources(treeType) {
        switch (treeType) {
            case 'normal': return { wood: 1, requiredPower: 1 };
            case 'sturdy': return { wood: 3, requiredPower: 2 };
            case 'oak': return { wood: 5, requiredPower: 3, special: 'oak_wood' };
            case 'maple': return { wood: 4, requiredPower: 3, special: 'maple_syrup' };
            case 'birch': return { wood: 3, requiredPower: 2, special: 'birch_bark' };
            case 'pine': return { wood: 4, requiredPower: 3, special: 'pine_resin' };
            default: return { wood: 1, requiredPower: 1 };
        }
    }

    generateEnemies(zones) {
        const enemies = [];
        
        zones.forEach(zone => {
            if (zone.type === 'rare' && this.seededRandom() < 0.6) {
                const enemyCount = 1 + Math.floor(this.seededRandom() * 2);
                
                for (let i = 0; i < enemyCount; i++) {
                    const x = zone.x + this.seededRandom() * zone.width;
                    const y = zone.y + this.seededRandom() * zone.height;
                    
                    const enemyType = this.seededRandom() < 0.6 ? 'stump' : 'spirit';
                    
                    enemies.push({
                        x,
                        y,
                        type: enemyType,
                        health: enemyType === 'stump' ? 20 : 15,
                        damage: enemyType === 'stump' ? 5 : 8
                    });
                }
            }
        });
        
        return enemies;
    }
}