export class AxeUpgrade {
    constructor() {
        this.level = 1;
        this.material = 'wood';
        this.enchantments = [];
        this.stats = {
            damage: 10,
            speed: 1,
            power: 1,
            critChance: 0.1,
            doubleResourceChance: 0.05
        };
    }

    getAxeTypes() {
        return [
            { name: 'Wood Axe', material: 'wood', cost: 0, damage: 10, speed: 1, power: 1 },
            { name: 'Stone Axe', material: 'stone', cost: 50, damage: 15, speed: 1.1, power: 2 },
            { name: 'Iron Axe', material: 'iron', cost: 100, damage: 20, speed: 1.2, power: 3 },
            { name: 'Steel Axe', material: 'steel', cost: 200, damage: 25, speed: 1.3, power: 4 },
            { name: 'Mithril Axe', material: 'mithril', cost: 500, damage: 35, speed: 1.5, power: 5 }
        ];
    }

    getEnchantments() {
        return [
            { 
                name: 'Sharpness', 
                cost: 100, 
                effect: 'damage', 
                value: 5, 
                description: 'Increases damage by 5' 
            },
            { 
                name: 'Efficiency', 
                cost: 150, 
                effect: 'speed', 
                value: 0.2, 
                description: 'Increases chopping speed by 20%' 
            },
            { 
                name: 'Fortune', 
                cost: 200, 
                effect: 'doubleResourceChance', 
                value: 0.1, 
                description: 'Increases double resource chance by 10%' 
            },
            { 
                name: 'Unbreaking', 
                cost: 120, 
                effect: 'durability', 
                value: 50, 
                description: 'Increases axe durability' 
            },
            { 
                name: 'Auto-Harvest', 
                cost: 300, 
                effect: 'autoHarvest', 
                value: true, 
                description: 'Automatically collects resources' 
            }
        ];
    }

    upgradeAxe(axeType) {
        const axeData = this.getAxeTypes().find(axe => axe.material === axeType);
        if (axeData) {
            this.material = axeData.material;
            this.stats.damage = axeData.damage;
            this.stats.speed = axeData.speed;
            this.stats.power = axeData.power;
            this.level++;
            return true;
        }
        return false;
    }

    addEnchantment(enchantmentName) {
        const enchantment = this.getEnchantments().find(enc => enc.name === enchantmentName);
        if (enchantment && !this.enchantments.includes(enchantmentName)) {
            this.enchantments.push(enchantmentName);
            
            switch (enchantment.effect) {
                case 'damage':
                    this.stats.damage += enchantment.value;
                    break;
                case 'speed':
                    this.stats.speed += enchantment.value;
                    break;
                case 'doubleResourceChance':
                    this.stats.doubleResourceChance += enchantment.value;
                    break;
                case 'critChance':
                    this.stats.critChance += enchantment.value;
                    break;
            }
            return true;
        }
        return false;
    }

    getAxeInfo() {
        return {
            level: this.level,
            material: this.material,
            enchantments: this.enchantments,
            stats: this.stats
        };
    }

    canUpgrade(axeType, playerResources) {
        const axeData = this.getAxeTypes().find(axe => axe.material === axeType);
        return axeData && playerResources.coins >= axeData.cost;
    }

    canEnchant(enchantmentName, playerResources) {
        const enchantment = this.getEnchantments().find(enc => enc.name === enchantmentName);
        return enchantment && 
               playerResources.coins >= enchantment.cost && 
               !this.enchantments.includes(enchantmentName);
    }
}