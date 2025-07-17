export class BaseBuilding {
    constructor(scene) {
        this.scene = scene;
        this.buildings = {
            warehouse: { level: 1, capacity: 100, upgradeCost: 50 },
            smithy: { level: 1, efficiency: 1.0, upgradeCost: 75 },
            lodge: { level: 1, stamina: 1.0, upgradeCost: 60 },
            workshop: { level: 0, unlocked: false, upgradeCost: 150 }
        };
    }

    getBuildingInfo(buildingType) {
        return this.buildings[buildingType];
    }

    canUpgrade(buildingType, playerResources) {
        const building = this.buildings[buildingType];
        if (!building) return false;
        
        if (buildingType === 'workshop' && !building.unlocked) {
            return playerResources.coins >= building.upgradeCost;
        }
        
        return playerResources.coins >= building.upgradeCost;
    }

    upgradeBuilding(buildingType, playerResources) {
        const building = this.buildings[buildingType];
        if (!building || !this.canUpgrade(buildingType, playerResources)) {
            return false;
        }

        playerResources.coins -= building.upgradeCost;
        building.level++;
        building.upgradeCost = Math.floor(building.upgradeCost * 1.5);

        switch (buildingType) {
            case 'warehouse':
                building.capacity += 50;
                break;
            case 'smithy':
                building.efficiency += 0.2;
                break;
            case 'lodge':
                building.stamina += 0.3;
                break;
            case 'workshop':
                if (!building.unlocked) {
                    building.unlocked = true;
                    building.level = 1;
                }
                break;
        }

        return true;
    }

    getBuildingEffects() {
        return {
            storageCapacity: this.buildings.warehouse.capacity,
            smithyEfficiency: this.buildings.smithy.efficiency,
            staminaBonus: this.buildings.lodge.stamina,
            workshopUnlocked: this.buildings.workshop.unlocked
        };
    }

    getBuildingDescriptions() {
        return {
            warehouse: {
                name: 'Warehouse',
                description: 'Increases resource storage capacity',
                currentEffect: `Capacity: ${this.buildings.warehouse.capacity}`,
                nextLevel: `Next: ${this.buildings.warehouse.capacity + 50} capacity`
            },
            smithy: {
                name: 'Smithy',
                description: 'Improves axe crafting efficiency',
                currentEffect: `Efficiency: ${(this.buildings.smithy.efficiency * 100).toFixed(0)}%`,
                nextLevel: `Next: ${((this.buildings.smithy.efficiency + 0.2) * 100).toFixed(0)}% efficiency`
            },
            lodge: {
                name: 'Lodge',
                description: 'Increases stamina regeneration',
                currentEffect: `Stamina: ${(this.buildings.lodge.stamina * 100).toFixed(0)}%`,
                nextLevel: `Next: ${((this.buildings.lodge.stamina + 0.3) * 100).toFixed(0)}% stamina`
            },
            workshop: {
                name: 'Workshop',
                description: 'Unlocks advanced technological upgrades',
                currentEffect: this.buildings.workshop.unlocked ? 'Unlocked' : 'Locked',
                nextLevel: this.buildings.workshop.unlocked ? 'Improved automation' : 'Unlock workshop'
            }
        };
    }
}