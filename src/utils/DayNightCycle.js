export class DayNightCycle {
    constructor(scene) {
        this.scene = scene;
        this.timeOfDay = 0; // 0 = midnight, 0.5 = noon, 1 = midnight again
        this.dayLength = 120000; // 2 minutes per day
        this.isNight = false;
        this.overlay = null;
        this.sunMoon = null;
        this.cycleStartTime = 0;
    }

    create() {
        this.cycleStartTime = this.scene.time.now;
        
        // Create day/night overlay
        this.overlay = this.scene.add.rectangle(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height, 0x000080, 0);
        this.overlay.setOrigin(0, 0);
        this.overlay.setScrollFactor(0);
        this.overlay.setDepth(1000);
        
        // Create sun/moon indicator
        this.sunMoon = this.scene.add.circle(100, 100, 20, 0xFFD700);
        this.sunMoon.setScrollFactor(0);
        this.sunMoon.setDepth(999);
        
        this.updateCycle();
    }

    update() {
        this.updateCycle();
    }

    updateCycle() {
        const currentTime = this.scene.time.now;
        const elapsed = (currentTime - this.cycleStartTime) % this.dayLength;
        this.timeOfDay = elapsed / this.dayLength;
        
        // Update sky color and overlay
        this.updateSkyColor();
        this.updateSunMoon();
        
        // Check if it's night time
        const wasNight = this.isNight;
        this.isNight = this.timeOfDay > 0.75 || this.timeOfDay < 0.25;
        
        if (wasNight !== this.isNight) {
            this.onTimeChange();
        }
    }

    updateSkyColor() {
        let skyColor;
        let overlayAlpha = 0;
        
        if (this.timeOfDay < 0.25) {
            // Night to Dawn
            const progress = this.timeOfDay / 0.25;
            skyColor = this.lerpColor(0x000022, 0x4169E1, progress);
            overlayAlpha = 0.7 * (1 - progress);
        } else if (this.timeOfDay < 0.5) {
            // Dawn to Noon
            const progress = (this.timeOfDay - 0.25) / 0.25;
            skyColor = this.lerpColor(0x4169E1, 0x87CEEB, progress);
        } else if (this.timeOfDay < 0.75) {
            // Noon to Dusk
            const progress = (this.timeOfDay - 0.5) / 0.25;
            skyColor = this.lerpColor(0x87CEEB, 0xFF4500, progress);
        } else {
            // Dusk to Night
            const progress = (this.timeOfDay - 0.75) / 0.25;
            skyColor = this.lerpColor(0xFF4500, 0x000022, progress);
            overlayAlpha = 0.7 * progress;
        }
        
        this.scene.cameras.main.setBackgroundColor(skyColor);
        this.overlay.setAlpha(overlayAlpha);
    }

    updateSunMoon() {
        // Sun/Moon position follows an arc across the sky
        const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2; // Start at top
        const radius = 150;
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        this.sunMoon.setPosition(x, y);
        
        // Change color based on time
        if (this.isNight) {
            this.sunMoon.setFillStyle(0xC0C0C0); // Silver moon
        } else {
            this.sunMoon.setFillStyle(0xFFD700); // Golden sun
        }
    }

    lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }

    onTimeChange() {
        // Different spawn rates and enemy behavior based on time
        if (this.isNight) {
            // Night time: more enemies, different resources
            this.scene.enemySpawnRate = 1.5;
            this.scene.nightBonus = true;
        } else {
            // Day time: normal spawn rates
            this.scene.enemySpawnRate = 1.0;
            this.scene.nightBonus = false;
        }
    }

    getTimeOfDay() {
        return this.timeOfDay;
    }

    isNightTime() {
        return this.isNight;
    }

    getTimeString() {
        const hour = Math.floor(this.timeOfDay * 24);
        const minute = Math.floor((this.timeOfDay * 24 * 60) % 60);
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    setTimeOfDay(time) {
        this.timeOfDay = time;
        this.cycleStartTime = this.scene.time.now - (time * this.dayLength);
        this.updateCycle();
    }
}