export class VirtualJoystick {
    constructor(scene) {
        this.scene = scene;
        this.isPressed = false;
        this.baseSprite = null;
        this.knobSprite = null;
        this.joystickRadius = 60;
        this.deadZone = 0.1;
        this.direction = { x: 0, y: 0 };
        this.force = 0;
        this.baseX = 0;
        this.baseY = 0;
        this.pointer = null;
        this.visible = false;
        this.alpha = 0.6;
        
        this.createJoystickGraphics();
        this.setupInput();
    }
    
    createJoystickGraphics() {
        // Create base circle
        this.baseSprite = this.scene.add.circle(0, 0, this.joystickRadius, 0x333333, this.alpha);
        this.baseSprite.setStrokeStyle(4, 0x555555);
        this.baseSprite.setScrollFactor(0);
        this.baseSprite.setVisible(false);
        
        // Create knob circle
        this.knobSprite = this.scene.add.circle(0, 0, this.joystickRadius * 0.4, 0x666666, this.alpha + 0.2);
        this.knobSprite.setStrokeStyle(3, 0x888888);
        this.knobSprite.setScrollFactor(0);
        this.knobSprite.setVisible(false);
    }
    
    setupInput() {
        this.scene.input.on('pointerdown', (pointer) => {
            this.onPointerDown(pointer);
        });
        
        this.scene.input.on('pointermove', (pointer) => {
            this.onPointerMove(pointer);
        });
        
        this.scene.input.on('pointerup', (pointer) => {
            this.onPointerUp(pointer);
        });
    }
    
    onPointerDown(pointer) {
        // Show joystick at touch position
        this.baseX = pointer.x;
        this.baseY = pointer.y;
        
        this.baseSprite.setPosition(this.baseX, this.baseY);
        this.knobSprite.setPosition(this.baseX, this.baseY);
        
        this.baseSprite.setVisible(true);
        this.knobSprite.setVisible(true);
        
        this.isPressed = true;
        this.pointer = pointer;
        this.visible = true;
    }
    
    onPointerMove(pointer) {
        if (!this.isPressed || pointer.id !== this.pointer.id) return;
        
        const deltaX = pointer.x - this.baseX;
        const deltaY = pointer.y - this.baseY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > this.joystickRadius) {
            // Constrain knob to joystick radius
            const angle = Math.atan2(deltaY, deltaX);
            this.knobSprite.setPosition(
                this.baseX + Math.cos(angle) * this.joystickRadius,
                this.baseY + Math.sin(angle) * this.joystickRadius
            );
            this.force = 1;
        } else {
            // Move knob freely within radius
            this.knobSprite.setPosition(pointer.x, pointer.y);
            this.force = distance / this.joystickRadius;
        }
        
        // Calculate direction (normalized)
        if (distance > this.deadZone * this.joystickRadius) {
            this.direction.x = deltaX / this.joystickRadius;
            this.direction.y = deltaY / this.joystickRadius;
            
            // Normalize if beyond radius
            if (distance > this.joystickRadius) {
                const angle = Math.atan2(deltaY, deltaX);
                this.direction.x = Math.cos(angle);
                this.direction.y = Math.sin(angle);
            }
        } else {
            this.direction.x = 0;
            this.direction.y = 0;
            this.force = 0;
        }
    }
    
    onPointerUp(pointer) {
        if (!this.isPressed || pointer.id !== this.pointer.id) return;
        
        this.isPressed = false;
        this.pointer = null;
        this.visible = false;
        
        // Hide joystick
        this.baseSprite.setVisible(false);
        this.knobSprite.setVisible(false);
        
        // Reset values
        this.direction.x = 0;
        this.direction.y = 0;
        this.force = 0;
    }
    
    getDirection() {
        return this.direction;
    }
    
    getForce() {
        return this.force;
    }
    
    isActive() {
        return this.isPressed && this.force > 0;
    }
    
    destroy() {
        if (this.baseSprite) {
            this.baseSprite.destroy();
        }
        if (this.knobSprite) {
            this.knobSprite.destroy();
        }
    }
}