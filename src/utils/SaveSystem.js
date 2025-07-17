export class SaveSystem {
    constructor() {
        this.saveKey = 'woodchopper_save';
        this.version = '1.1.0';
    }

    // Lager en komplett save-data struktur
    createSaveData(gameScene, baseScene) {
        const saveData = {
            version: this.version,
            timestamp: Date.now(),
            resources: gameScene.resources,
            playerStats: baseScene.playerStats,
            axeUpgrade: {
                level: gameScene.axeUpgrade.level,
                material: gameScene.axeUpgrade.material,
                enchantments: gameScene.axeUpgrade.enchantments,
                stats: gameScene.axeUpgrade.stats
            },
            gameState: {
                health: gameScene.health,
                maxHealth: gameScene.maxHealth,
                stamina: gameScene.stamina,
                maxStamina: gameScene.maxStamina,
                playerX: gameScene.player.x,
                playerY: gameScene.player.y,
                dayNightTime: gameScene.dayNightCycle.timeOfDay
            },
            buildings: this.getBuildingData(baseScene),
            settings: {
                soundEnabled: true,
                musicEnabled: true
            }
        };

        return saveData;
    }

    // Henter bygningsdata
    getBuildingData(baseScene) {
        const buildings = {};
        const buildingTypes = ['warehouse', 'smithy', 'lodge', 'workshop'];
        
        buildingTypes.forEach(type => {
            const info = baseScene.baseBuilding.getBuildingInfo(type);
            buildings[type] = {
                level: info.level,
                unlocked: info.unlocked,
                upgradeCost: info.upgradeCost
            };
        });

        return buildings;
    }

    // Lagrer data til localStorage
    saveGame(gameScene, baseScene) {
        try {
            const saveData = this.createSaveData(gameScene, baseScene);
            localStorage.setItem(this.saveKey, JSON.stringify(saveData));
            
            console.log('Game saved successfully!');
            return {
                success: true,
                message: 'Spillet er lagret!',
                timestamp: new Date(saveData.timestamp).toLocaleString('nb-NO')
            };
        } catch (error) {
            console.error('Failed to save game:', error);
            return {
                success: false,
                message: 'Kunne ikke lagre spillet!',
                error: error.message
            };
        }
    }

    // Laster data fra localStorage
    loadGame() {
        try {
            const savedData = localStorage.getItem(this.saveKey);
            
            if (!savedData) {
                return {
                    success: false,
                    message: 'Ingen lagret data funnet',
                    data: null
                };
            }

            const saveData = JSON.parse(savedData);
            
            // Sjekk versjon-kompatibilitet
            if (saveData.version !== this.version) {
                console.warn(`Save version mismatch: saved ${saveData.version}, current ${this.version}`);
                // Her kan du legge til migrering hvis nødvendig
            }

            return {
                success: true,
                message: 'Spillet er lastet!',
                data: saveData,
                timestamp: new Date(saveData.timestamp).toLocaleString('nb-NO')
            };
        } catch (error) {
            console.error('Failed to load game:', error);
            return {
                success: false,
                message: 'Kunne ikke laste spillet!',
                error: error.message
            };
        }
    }

    // Sjekker om det finnes lagret data
    hasSaveData() {
        return localStorage.getItem(this.saveKey) !== null;
    }

    // Sletter lagret data
    deleteSave() {
        try {
            localStorage.removeItem(this.saveKey);
            return {
                success: true,
                message: 'Lagret data slettet!'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Kunne ikke slette lagret data!',
                error: error.message
            };
        }
    }

    // Lager en backup av lagret data
    createBackup() {
        const saveData = localStorage.getItem(this.saveKey);
        if (saveData) {
            const backupKey = `${this.saveKey}_backup_${Date.now()}`;
            localStorage.setItem(backupKey, saveData);
            return {
                success: true,
                message: 'Backup opprettet!',
                backupKey: backupKey
            };
        }
        return {
            success: false,
            message: 'Ingen data å ta backup av!'
        };
    }

    // Henter save-info uten å laste hele spillet
    getSaveInfo() {
        try {
            const savedData = localStorage.getItem(this.saveKey);
            if (!savedData) return null;

            const saveData = JSON.parse(savedData);
            return {
                version: saveData.version,
                timestamp: new Date(saveData.timestamp).toLocaleString('nb-NO'),
                resources: saveData.resources,
                playerLevel: saveData.axeUpgrade.level,
                axeMaterial: saveData.axeUpgrade.material
            };
        } catch (error) {
            console.error('Failed to get save info:', error);
            return null;
        }
    }
}