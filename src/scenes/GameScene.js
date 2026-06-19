import Phaser from 'phaser';
import { SoundFX } from '../utils/SoundFX.js';

// W/H/FIRE/PLAY_BOTTOM are recomputed from the real canvas size in create()
let W = 400;
let H = 700;
const FIRE = { x: 200, y: 300 };

// Tuning knobs
const DAY_SECONDS = 10;
const PLAY_TOP = 120;      // play area starts below HUD
let PLAY_BOTTOM = 610;     // ...and ends above controls (set in create)
const FEED_COST = 5;
const FEED_FUEL = 18;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // adapt layout to the actual canvas size
        W = this.scale.width;
        H = this.scale.height;
        FIRE.x = Math.round(W / 2);
        FIRE.y = Math.round(H * 0.40);
        PLAY_BOTTOM = H - 96;
        this.input.addPointer(2);   // allow move + tap simultaneously

        this.makeTextures();
        this.sfx = new SoundFX();

        // ---- State ----
        this.wood = 12;
        this.score = 0;
        this.wave = 1;
        this.phase = 'day';            // 'day' | 'night'
        this.phaseEnd = this.time.now + DAY_SECONDS * 1000;

        this.maxHp = 100;
        this.hp = 100;
        this.fuelMax = 100;
        this.fuel = 100;

        this.axeDmg = 6;
        this.moveSpeed = 150;
        this.swingCd = 0;
        this.swingDelay = 280;
        this.swingRange = 56;
        this.treeBonus = 0;       // extra wood per felled tree
        this.killWood = 2;        // wood per killed enemy
        this.fuelDrainMult = 1;   // bålmester reduces this
        this.dawnHeal = 0;        // hp restored each dawn
        this.upgLevels = {};      // how many times each upgrade was taken
        this.slashColor = 0xffffff;
        this.slashScale = 1;
        this.dustCd = 0;

        this.facing = 1;               // 1 right, -1 left
        this.trees = [];
        this.enemies = [];
        this.structures = [];
        this.buildCounts = { gjerde: 0, taarn: 0, hus: 0, sagbruk: 0 };
        this.houseRegen = 0;
        this.spawnTimer = null;
        this.gameIsOver = false;
        this.menuOpen = false;

        // ---- World ----
        this.ground = this.add.rectangle(0, 0, W, H, 0x3f7d4a).setOrigin(0);
        for (let i = 0; i < 60; i++) {
            const x = Phaser.Math.Between(0, W);
            const y = Phaser.Math.Between(PLAY_TOP - 20, H);
            this.add.rectangle(x, y, 3, 3, 0x356b40).setDepth(0);
        }

        this.createFire();
        this.createTrees();
        this.createPlayer();
        this.createSlots();

        // Darkness + glow for night
        this.nightOverlay = this.add.rectangle(0, 0, W, H, 0x0a1024)
            .setOrigin(0).setAlpha(0).setDepth(900);
        this.fireGlow = this.add.image(FIRE.x, FIRE.y, 'glow')
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(901).setAlpha(0).setScale(2.4);

        this.createHUD();
        this.createControls();
        this.setupInput();

        this.banner('☀  DAG 1\nHugg ved!', 0xffd166);
    }

    // ---------------------------------------------------------------- textures
    makeTextures() {
        if (this.textures.exists('glow')) return; // already built (e.g. after restart)
        const g = this.add.graphics();

        // player – little lumberjack facing right
        g.clear();
        g.fillStyle(0x5b3a1d, 1); g.fillRect(8, 20, 14, 14);        // body
        g.fillStyle(0xc1440e, 1); g.fillRect(8, 14, 14, 8);         // shirt
        g.fillStyle(0xf2c9a0, 1); g.fillRect(11, 4, 10, 10);        // head
        g.fillStyle(0x3a2a18, 1); g.fillRect(11, 2, 10, 4);         // hat
        g.fillStyle(0x8a8a8a, 1); g.fillRect(22, 8, 4, 16);         // axe handle
        g.fillStyle(0xcfd6dd, 1); g.fillRect(22, 6, 7, 5);          // axe head
        g.generateTexture('player', 30, 36); g.clear();

        // tree
        g.fillStyle(0x6b4423, 1); g.fillRect(16, 34, 10, 18);       // trunk
        g.fillStyle(0x2f7d3a, 1); g.fillCircle(21, 22, 20);
        g.fillStyle(0x3f9c4c, 1); g.fillCircle(15, 18, 12);
        g.fillStyle(0x49b259, 1); g.fillCircle(27, 16, 11);
        g.generateTexture('tree', 44, 54); g.clear();

        // stump
        g.fillStyle(0x6b4423, 1); g.fillRect(4, 6, 16, 12);
        g.fillStyle(0x8a5a30, 1); g.fillEllipse(12, 7, 16, 7);
        g.generateTexture('stump', 24, 20); g.clear();

        // enemy – shadow creature
        g.fillStyle(0x241633, 1); g.fillCircle(16, 18, 15);
        g.fillStyle(0x3a2352, 1); g.fillCircle(16, 14, 12);
        g.fillStyle(0xff3b6b, 1); g.fillCircle(11, 13, 3); g.fillCircle(21, 13, 3);
        g.generateTexture('enemy', 32, 34); g.clear();

        // wood chip particle
        g.fillStyle(0xb07a3c, 1); g.fillRect(0, 0, 6, 6);
        g.generateTexture('chip', 6, 6); g.clear();

        // ember particle
        g.fillStyle(0xffb347, 1); g.fillRect(0, 0, 5, 5);
        g.generateTexture('ember', 5, 5); g.clear();

        // slash arc
        g.fillStyle(0xffffff, 0.9);
        g.slice(0, 0, 46, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false);
        g.fillPath();
        g.generateTexture('slash', 52, 52); g.clear();

        // fence – wooden palisade
        g.fillStyle(0x8a5a2b, 1);
        g.fillRect(2, 6, 6, 26); g.fillRect(13, 2, 6, 30); g.fillRect(24, 6, 6, 26);
        g.fillStyle(0x6b4423, 1);
        g.fillRect(0, 12, 32, 4); g.fillRect(0, 24, 32, 4);
        g.generateTexture('fence', 32, 34); g.clear();

        // tower – stone base + crenellated top
        g.fillStyle(0x6b6b76, 1); g.fillRect(4, 14, 24, 22);
        g.fillStyle(0x55555f, 1); g.fillRect(2, 8, 28, 8);
        g.fillStyle(0x6b6b76, 1);
        g.fillRect(2, 2, 6, 8); g.fillRect(13, 2, 6, 8); g.fillRect(24, 2, 6, 8);
        g.fillStyle(0x2a2a30, 1); g.fillRect(12, 20, 8, 10);
        g.generateTexture('tower', 32, 38); g.clear();

        // house – hut with roof (buff building)
        g.fillStyle(0xb5651d, 1); g.fillRect(4, 18, 32, 22);
        g.fillStyle(0x7a3b12, 1); g.fillTriangle(0, 18, 20, 0, 40, 18);
        g.fillStyle(0x3a2410, 1); g.fillRect(15, 26, 10, 14);
        g.generateTexture('house', 40, 40); g.clear();

        // sawmill – building with saw blade (wood income)
        g.fillStyle(0x5b7d8a, 1); g.fillRect(2, 14, 32, 24);
        g.fillStyle(0x3f5a64, 1); g.fillRect(2, 10, 32, 6);
        g.fillStyle(0xd0d6dd, 1); g.fillCircle(24, 26, 9);
        g.fillStyle(0x5b7d8a, 1); g.fillCircle(24, 26, 3);
        g.generateTexture('sawmill', 38, 40); g.clear();

        // bolt – tower projectile
        g.fillStyle(0xfff2a0, 1); g.fillCircle(4, 4, 4);
        g.generateTexture('bolt', 8, 8); g.clear();

        // dust puff (boots upgrade)
        g.fillStyle(0xd8cdb0, 1); g.fillCircle(4, 4, 4);
        g.generateTexture('dust', 8, 8); g.clear();

        g.destroy();

        // radial glow (canvas gradient)
        const size = 256;
        const tex = this.textures.createCanvas('glow', size, size);
        const ctx = tex.getContext();
        const grd = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
        grd.addColorStop(0, 'rgba(255,180,90,0.9)');
        grd.addColorStop(0.45, 'rgba(255,140,60,0.35)');
        grd.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
    }

    // ---------------------------------------------------------------- entities
    createFire() {
        this.add.ellipse(FIRE.x, FIRE.y + 14, 46, 16, 0x000000, 0.18).setDepth(1);
        this.add.rectangle(FIRE.x - 8, FIRE.y + 8, 26, 7, 0x5b3a1d).setAngle(20).setDepth(2);
        this.add.rectangle(FIRE.x + 8, FIRE.y + 8, 26, 7, 0x5b3a1d).setAngle(-20).setDepth(2);
        this.flame = this.add.text(FIRE.x, FIRE.y, '🔥', { fontSize: '40px' }).setOrigin(0.5).setDepth(3);
        this.tweens.add({ targets: this.flame, scaleX: 1.12, scaleY: 0.92, duration: 380, yoyo: true, repeat: -1 });
    }

    treeSpots() {
        // scattered around the play area, mapped to the real canvas size and
        // kept clear of the campfire
        const top = PLAY_TOP + 30, bot = PLAY_BOTTOM - 10;
        const cand = [
            [0.14, 0.05], [0.40, 0.0], [0.62, 0.01], [0.86, 0.06],
            [0.07, 0.33], [0.93, 0.31],
            [0.09, 0.62], [0.92, 0.60],
            [0.16, 0.95], [0.42, 1.0], [0.62, 0.99], [0.85, 0.94],
            [0.30, 0.5], [0.72, 0.5]
        ];
        return cand
            .map(([fx, fy]) => ({ x: Math.round(20 + fx * (W - 40)), y: Math.round(top + fy * (bot - top)) }))
            .filter(p => Phaser.Math.Distance.Between(p.x, p.y, FIRE.x, FIRE.y) > 95);
    }

    createTrees() {
        this.treeSpots().forEach(spot => {
            const t = this.add.image(spot.x, spot.y, 'tree').setDepth(spot.y);
            t.homeX = spot.x; t.homeY = spot.y;
            t.maxHp = 8; t.hp = 8; t.alive = true;
            this.trees.push(t);
        });
    }

    createPlayer() {
        // reach indicator – shows how far a swing can hit (grows with upgrades)
        this.reachRing = this.add.circle(FIRE.x, FIRE.y + 70, this.swingRange, 0xffffff, 0)
            .setStrokeStyle(2, 0xffe08a, 0.9).setDepth(480).setAlpha(0.18);
        // power aura – brightens/grows as the axe gets stronger
        this.playerAura = this.add.image(FIRE.x, FIRE.y + 70, 'glow')
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(499).setAlpha(0).setScale(0.4);
        this.player = this.add.image(FIRE.x, FIRE.y + 70, 'player').setDepth(500);
        this.walkPhase = 0;
        this.refreshPowerVisuals();
    }

    tierColor(level) {
        return [0xffffff, 0xffe08a, 0xffae42, 0xff7a2b][Math.min(level, 3)];
    }

    refreshPowerVisuals(changed) {
        const axe = this.upgLevels.axe || 0;
        const color = this.tierColor(axe);

        // reach ring follows swingRange
        this.reachRing.setRadius(this.swingRange);
        this.reachRing.setStrokeStyle(2, color, 0.9);
        this.reachRing.setAlpha(0.18);

        // power aura grows + tints with axe strength
        this.playerAura.setTint(color);
        this.playerAura.setAlpha(Math.min(0.55, axe * 0.13));
        this.playerAura.setScale(0.32 + axe * 0.1);

        // the lumberjack himself bulks up a little
        this.player.setScale(1 + Math.min(0.22, axe * 0.05));

        // slash visuals
        this.slashColor = color;
        this.slashScale = (this.swingRange / 46) * (1 + axe * 0.05);

        // feedback pulse on the thing that changed
        if (changed === 'reach') {
            const r = this.add.circle(this.player.x, this.player.y, this.swingRange, color, 0.18).setDepth(481);
            this.tweens.add({ targets: r, alpha: 0, scale: 1.2, duration: 500, onComplete: () => r.destroy() });
        } else if (changed === 'axe') {
            this.tweens.add({ targets: this.player, scaleX: this.player.scaleX * 1.25, scaleY: this.player.scaleY * 1.25,
                duration: 130, yoyo: true });
        }
    }

    createSlots() {
        // Fence ring around the fire
        const fence = [];
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            fence.push({ x: FIRE.x + Math.cos(a) * 70, y: FIRE.y + Math.sin(a) * 70, taken: false });
        }
        // Towers on diagonals, a bit further out (relative to the fire)
        const taarn = [
            { x: FIRE.x - 81, y: FIRE.y - 81 }, { x: FIRE.x + 81, y: FIRE.y - 81 },
            { x: FIRE.x - 81, y: FIRE.y + 81 }, { x: FIRE.x + 81, y: FIRE.y + 81 }
        ].map(p => ({ ...p, taken: false }));
        const hus = [
            { x: Math.max(44, FIRE.x - 144), y: FIRE.y },
            { x: Math.min(W - 44, FIRE.x + 144), y: FIRE.y }
        ].map(p => ({ ...p, taken: false }));
        const sagbruk = [
            { x: FIRE.x, y: Math.max(PLAY_TOP + 30, FIRE.y - 150) },
            { x: FIRE.x, y: Math.min(PLAY_BOTTOM - 20, FIRE.y + 150) }
        ].map(p => ({ ...p, taken: false }));
        this.slots = { gjerde: fence, taarn, hus, sagbruk };
    }

    // ---------------------------------------------------------------- HUD
    createHUD() {
        this.add.rectangle(0, 0, W, PLAY_TOP - 8, 0x10180f, 0.82).setOrigin(0).setDepth(2000);

        this.woodText = this.add.text(12, 10, '🪵 12', {
            fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setDepth(2001);

        this.scoreText = this.add.text(W - 12, 10, '0', {
            fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(1, 0).setDepth(2001);

        this.phaseText = this.add.text(W / 2, 12, '', {
            fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5, 0).setDepth(2001);

        // Health bar
        this.add.text(12, 44, '❤', { fontSize: '14px' }).setDepth(2001);
        this.add.rectangle(34, 52, 150, 12, 0x40121a).setOrigin(0, 0.5).setDepth(2001);
        this.hpBar = this.add.rectangle(34, 52, 150, 12, 0xe23b53).setOrigin(0, 0.5).setDepth(2002);

        // Fire fuel bar
        this.add.text(12, 66, '🔥', { fontSize: '14px' }).setDepth(2001);
        this.add.rectangle(34, 74, 150, 12, 0x4a2a0e).setOrigin(0, 0.5).setDepth(2001);
        this.fuelBar = this.add.rectangle(34, 74, 150, 12, 0xff9e2c).setOrigin(0, 0.5).setDepth(2002);

        this.hintText = this.add.text(W - 12, 44, '', {
            fontSize: '12px', fontFamily: 'Arial', color: '#cfe3d4', align: 'right'
        }).setOrigin(1, 0).setDepth(2001);
    }

    // ---------------------------------------------------------------- controls
    createControls() {
        const bx = W - 62;
        const swingY = H - 64, feedY = H - 156, shopY = H - 238;

        // Swing button
        this.swingBtn = this.add.circle(bx, swingY, 44, 0xc1440e, 0.9)
            .setStrokeStyle(4, 0xffd166).setScrollFactor(0).setDepth(3000)
            .setInteractive({ useHandCursor: true });
        this.add.text(bx, swingY, '🪓', { fontSize: '34px' }).setOrigin(0.5).setDepth(3001);
        this.swingBtn.on('pointerdown', () => { this.swingBtn.setScale(0.9); this.swing(); });
        this.swingBtn.on('pointerup', () => this.swingBtn.setScale(1));
        this.swingBtn.on('pointerout', () => this.swingBtn.setScale(1));

        // Feed button
        this.feedBtn = this.add.circle(bx, feedY, 34, 0x2a6b3a, 0.9)
            .setStrokeStyle(3, 0xffd166).setScrollFactor(0).setDepth(3000)
            .setInteractive({ useHandCursor: true });
        this.add.text(bx, feedY, '🔥', { fontSize: '24px' }).setOrigin(0.5).setDepth(3001);
        this.feedBtn.on('pointerdown', () => { this.feedBtn.setScale(0.9); this.feedFire(); });
        this.feedBtn.on('pointerup', () => this.feedBtn.setScale(1));
        this.feedBtn.on('pointerout', () => this.feedBtn.setScale(1));

        // Shop button (day only)
        this.shopBtn = this.add.circle(bx, shopY, 30, 0x4a6b3a, 0.9)
            .setStrokeStyle(3, 0xffd166).setScrollFactor(0).setDepth(3000)
            .setInteractive({ useHandCursor: true });
        this.shopBtnIcon = this.add.text(bx, shopY, '🛒', { fontSize: '22px' }).setOrigin(0.5).setDepth(3001);
        this.shopBtn.on('pointerdown', () => { this.shopBtn.setScale(0.9); this.openShop(); });
        this.shopBtn.on('pointerup', () => this.shopBtn.setScale(1));
        this.shopBtn.on('pointerout', () => this.shopBtn.setScale(1));

        // Dynamic joystick visuals
        this.joyBase = this.add.circle(0, 0, 50, 0x000000, 0.25).setDepth(2900).setVisible(false);
        this.joyKnob = this.add.circle(0, 0, 22, 0xffffff, 0.35).setDepth(2901).setVisible(false);
        this.joy = { active: false, id: null, ox: 0, oy: 0, vx: 0, vy: 0 };
    }

    onButton(px, py) {
        const near = (b, r) => Phaser.Math.Distance.Between(px, py, b.x, b.y) < r;
        return near(this.swingBtn, 54) || near(this.feedBtn, 44) ||
               (this.shopBtn.visible && near(this.shopBtn, 40)) ||
               Phaser.Math.Distance.Between(px, py, FIRE.x, FIRE.y) < 40;
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,F,B');
        this.keys.SPACE.on('down', () => { this.sfx.ensure(); this.swing(); });
        this.keys.F.on('down', () => { this.sfx.ensure(); this.feedFire(); });
        this.keys.B.on('down', () => { this.sfx.ensure(); this.openShop(); });

        this.input.on('pointerdown', (p) => {
            this.sfx.ensure();
            if (this.joy.active || this.onButton(p.x, p.y) || this.menuOpen) return;
            this.joy.active = true; this.joy.id = p.id;
            this.joy.ox = p.x; this.joy.oy = p.y;
            this.joyBase.setPosition(p.x, p.y).setVisible(true);
            this.joyKnob.setPosition(p.x, p.y).setVisible(true);
        });
        this.input.on('pointermove', (p) => {
            if (!this.joy.active || p.id !== this.joy.id) return;
            let dx = p.x - this.joy.ox, dy = p.y - this.joy.oy;
            const dist = Math.hypot(dx, dy);
            const max = 50;
            if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
            this.joyKnob.setPosition(this.joy.ox + dx, this.joy.oy + dy);
            this.joy.vx = dx / max; this.joy.vy = dy / max;
        });
        const end = (p) => {
            if (p.id !== this.joy.id) return;
            this.joy.active = false; this.joy.vx = 0; this.joy.vy = 0;
            this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
        };
        this.input.on('pointerup', end);
        this.input.on('pointerupoutside', end);
    }

    // ---------------------------------------------------------------- actions
    swing() {
        if (this.gameIsOver || this.menuOpen) return;
        if (this.time.now < this.swingCd) return;
        this.swingCd = this.time.now + this.swingDelay;
        this.sfx.swing();

        // visual arc – size matches reach, colour matches axe power
        const s = this.slashScale;
        const dur = Math.max(110, this.swingDelay * 0.7);
        const arc = this.add.image(this.player.x + this.facing * 16, this.player.y, 'slash')
            .setDepth(600).setFlipX(this.facing < 0).setScale(s * 0.6).setAlpha(0.95)
            .setTint(this.slashColor);
        this.tweens.add({ targets: arc, scale: s, alpha: 0, duration: dur, onComplete: () => arc.destroy() });
        // flash the reach ring so range is obvious
        this.reachRing.setAlpha(0.4);
        this.tweens.add({ targets: this.reachRing, alpha: 0.18, duration: 260 });

        const R = this.swingRange;
        let hitSomething = false;

        // chop trees
        this.trees.forEach(t => {
            if (!t.alive) return;
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y) < R) {
                this.chopTree(t); hitSomething = true;
            }
        });
        // hit enemies
        this.enemies.forEach(e => {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) < R) {
                this.hitEnemy(e); hitSomething = true;
            }
        });

        if (hitSomething) this.cameras.main.shake(80, 0.006);
    }

    chopTree(t) {
        t.hp -= this.axeDmg;
        this.sfx.chopHit();
        this.tweens.add({ targets: t, x: t.homeX + Phaser.Math.Between(-4, 4), duration: 50, yoyo: true });
        this.burst(t.x, t.y - 10, 'chip', 5);
        if (t.hp <= 0) {
            const yield_ = 3 + this.treeBonus;
            this.wood += yield_;
            this.sfx.treeFall();
            this.floatText(t.x, t.y - 20, `+${yield_} 🪵`, '#ffd166');
            t.alive = false;
            t.setTexture('stump').setDepth(t.homeY).setPosition(t.homeX, t.homeY + 16);
            // regrow
            this.time.delayedCall(9000, () => this.regrow(t));
            this.updateHUD();
        }
    }

    regrow(t) {
        if (this.gameIsOver) return;
        t.setTexture('tree').setPosition(t.homeX, t.homeY).setDepth(t.homeY);
        t.hp = t.maxHp; t.alive = true;
        t.setScale(0.2);
        this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.out' });
    }

    hitEnemy(e) {
        if (e.dead) return;
        e.hp -= this.axeDmg;
        this.sfx.hitEnemy();
        e.setTintFill(0xffffff);
        this.time.delayedCall(70, () => { if (e.active) e.clearTint(); });
        // knockback away from player
        const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, e.x, e.y);
        e.x += Math.cos(a) * 14; e.y += Math.sin(a) * 14;
        if (e.hp <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
        e.dead = true;
        this.sfx.enemyDie();
        this.score += 10 + this.wave;
        this.wood += this.killWood;
        this.burst(e.x, e.y, 'ember', 8);
        this.floatText(e.x, e.y - 10, `+${this.killWood} 🪵`, '#ffd166');
        this.tweens.add({ targets: e, scale: 0, alpha: 0, duration: 150, onComplete: () => e.destroy() });
        this.enemies = this.enemies.filter(x => x !== e);
        this.updateHUD();
    }

    feedFire() {
        if (this.gameIsOver || this.menuOpen) return;
        if (this.wood < FEED_COST) { this.sfx.deny(); this.floatText(FIRE.x, FIRE.y - 40, 'Mangler ved!', '#ff6b6b'); return; }
        if (this.fuel >= this.fuelMax) { this.floatText(FIRE.x, FIRE.y - 40, 'Bålet er fullt', '#cfe3d4'); return; }
        this.wood -= FEED_COST;
        this.fuel = Math.min(this.fuelMax, this.fuel + FEED_FUEL);
        this.sfx.feed();
        this.burst(FIRE.x, FIRE.y, 'ember', 10);
        this.floatText(FIRE.x, FIRE.y - 40, `+${FEED_FUEL} 🔥`, '#ff9e2c');
        this.cameras.main.flash(120, 80, 40, 0);
        this.updateHUD();
    }

    // ---------------------------------------------------------------- upgrades
    upgradePool() {
        return [
            { key: 'axe', icon: '🪓', name: 'Skarpere øks', desc: '+6 skade', apply: () => { this.axeDmg += 6; } },
            { key: 'boots', icon: '👢', name: 'Raske støvler', desc: '+22 fart', apply: () => { this.moveSpeed += 22; } },
            { key: 'vit', icon: '❤️', name: 'Vitalitet', desc: '+30 maks liv & full heal', apply: () => { this.maxHp += 30; this.hp = this.maxHp; } },
            { key: 'fire', icon: '🔥', name: 'Større bål', desc: '+40 brensel (fylles opp)', apply: () => { this.fuelMax += 40; this.fuel = Math.min(this.fuelMax, this.fuel + 40); } },
            { key: 'reach', icon: '🌀', name: 'Lang rekkevidde', desc: '+18 sving-rekkevidde', apply: () => { this.swingRange += 18; } },
            { key: 'swift', icon: '⚡', name: 'Hurtige hugg', desc: 'Sving raskere', apply: () => { this.swingDelay = Math.max(120, this.swingDelay - 50); } },
            { key: 'lumber', icon: '🪵', name: 'Effektiv hugger', desc: '+2 ved per tre', apply: () => { this.treeBonus += 2; } },
            { key: 'hunter', icon: '🩸', name: 'Rovdyr', desc: '+3 ved per drepte fiende', apply: () => { this.killWood += 3; } },
            { key: 'ember', icon: '🛡️', name: 'Bålmester', desc: '-25% brenselforbruk', apply: () => { this.fuelDrainMult *= 0.75; } },
            { key: 'regen', icon: '💚', name: 'Helbredende ild', desc: 'Heal nå + 15 liv hvert daggry', apply: () => { this.dawnHeal += 15; this.hp = Math.min(this.maxHp, this.hp + 30); } }
        ];
    }

    offerUpgrades(headline) {
        this.menuOpen = true;
        // pick 3 distinct random upgrades
        const pool = Phaser.Utils.Array.Shuffle(this.upgradePool().slice());
        const picks = pool.slice(0, 3);

        const c = this.add.container(0, 0).setDepth(4000);
        c.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.82).setOrigin(0).setInteractive());
        c.add(this.add.text(W / 2, 110, headline, {
            fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold',
            color: '#ffd166', align: 'center'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 150, 'Velg én forsterkning', {
            fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0.5));

        picks.forEach((it, i) => {
            const y = 235 + i * 125;
            const card = this.add.rectangle(W / 2, y, 320, 108, 0x1d2e18)
                .setStrokeStyle(3, 0x4a6b3a).setInteractive({ useHandCursor: true });
            c.add(card);
            c.add(this.add.text(W / 2, y - 28, it.icon, { fontSize: '38px' }).setOrigin(0.5));
            c.add(this.add.text(W / 2, y + 14, it.name, {
                fontSize: '19px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0.5));
            c.add(this.add.text(W / 2, y + 38, it.desc, {
                fontSize: '13px', fontFamily: 'Arial', color: '#bcd0c0'
            }).setOrigin(0.5));
            card.on('pointerover', () => card.setStrokeStyle(3, 0xffd166));
            card.on('pointerout', () => card.setStrokeStyle(3, 0x4a6b3a));
            card.on('pointerup', () => {
                it.apply();
                this.upgLevels[it.key] = (this.upgLevels[it.key] || 0) + 1;
                this.sfx.upgrade();
                this.refreshPowerVisuals(it.key);
                this.floatText(this.player.x, this.player.y - 30, it.name, '#ffd166');
                c.destroy();
                this.menuOpen = false;
                this.updateHUD();
            });
        });

        this.upgradeContainer = c;
    }

    // ---------------------------------------------------------------- shop / building
    shopItems() {
        return [
            { key: 'gjerde', icon: '🚧', name: 'Gjerde', desc: 'Stopper fiender på vei mot bålet', base: 8 },
            { key: 'taarn', icon: '🗼', name: 'Vakttårn', desc: 'Skyter automatisk på fiender', base: 28 },
            { key: 'hus', icon: '🏠', name: 'Hytte', desc: 'Heler deg sakte (+3 liv/s)', base: 38 },
            { key: 'sagbruk', icon: '🪚', name: 'Sagbruk', desc: '+6 ved hvert daggry', base: 34 }
        ];
    }

    shopCost(item) {
        return Math.round(item.base * Math.pow(1.4, this.buildCounts[item.key]));
    }

    openShop() {
        if (this.menuOpen || this.gameIsOver) return;
        if (this.phase !== 'day') { this.floatText(this.player.x, this.player.y - 30, 'Bygg på dagtid', '#ff6b6b'); this.sfx.deny(); return; }
        this.menuOpen = true;
        this.renderShop();
    }

    renderShop() {
        if (this.shopContainer) this.shopContainer.destroy();
        const c = this.add.container(0, 0).setDepth(4000);
        this.shopContainer = c;

        c.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.85).setOrigin(0).setInteractive());
        c.add(this.add.text(W / 2, 70, '🛒 BYGGEBUTIKK', {
            fontSize: '26px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 102, `Du har 🪵 ${this.wood}`, {
            fontSize: '16px', fontFamily: 'Arial', color: '#ffffff'
        }).setOrigin(0.5));

        this.shopItems().forEach((it, i) => {
            const y = 160 + i * 100;
            const cost = this.shopCost(it);
            const max = this.slots[it.key].length;
            const built = this.buildCounts[it.key];
            const full = built >= max;
            const afford = this.wood >= cost && !full;

            const row = this.add.rectangle(W / 2, y, 340, 88, 0x1d2e18)
                .setStrokeStyle(2, afford ? 0x4a6b3a : 0x33402c)
                .setInteractive({ useHandCursor: true });
            c.add(row);
            c.add(this.add.text(42, y, it.icon, { fontSize: '32px' }).setOrigin(0.5));
            c.add(this.add.text(72, y - 22, `${it.name}  (${built}/${max})`, {
                fontSize: '17px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0, 0.5));
            c.add(this.add.text(72, y + 2, it.desc, {
                fontSize: '12px', fontFamily: 'Arial', color: '#bcd0c0', wordWrap: { width: 250 }
            }).setOrigin(0, 0.5));
            c.add(this.add.text(W / 2 + 152, y, full ? 'FULLT' : `🪵 ${cost}`, {
                fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold',
                color: full ? '#888' : (afford ? '#ffd166' : '#ff6b6b')
            }).setOrigin(1, 0.5));
            row.on('pointerup', () => this.buyStructure(it));
        });

        const close = this.add.rectangle(W / 2, H - 70, 220, 56, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(close);
        c.add(this.add.text(W / 2, H - 70, 'FERDIG', {
            fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        close.on('pointerup', () => { c.destroy(); this.shopContainer = null; this.menuOpen = false; });
    }

    buyStructure(item) {
        const cost = this.shopCost(item);
        const slot = this.slots[item.key].find(s => !s.taken);
        if (!slot) { this.sfx.deny(); return; }
        if (this.wood < cost) { this.sfx.deny(); this.floatText(W / 2, 130, 'For lite ved!', '#ff6b6b'); return; }

        this.wood -= cost;
        this.buildCounts[item.key]++;
        slot.taken = true;
        this.spawnStructure(item.key, slot);
        this.sfx.build();
        if (item.key === 'hus') this.houseRegen = this.buildCounts.hus * 3;
        this.renderShop();   // refresh counts/costs
    }

    spawnStructure(type, slot) {
        const tex = { gjerde: 'fence', taarn: 'tower', hus: 'house', sagbruk: 'sawmill' }[type];
        const s = this.add.image(slot.x, slot.y, tex).setDepth(slot.y);
        s.type = type; s.slot = slot; s.dead = false;
        if (type === 'gjerde') { s.maxHp = 40; s.hp = 40; }
        if (type === 'taarn') { s.cd = 0; }
        s.setScale(0.2);
        this.tweens.add({ targets: s, scale: 1, duration: 300, ease: 'Back.out' });
        this.structures.push(s);
        return s;
    }

    destroyStructure(s) {
        s.dead = true;
        if (s.slot) s.slot.taken = false;
        if (s.type === 'gjerde') this.buildCounts.gjerde--;
        this.burst(s.x, s.y, 'chip', 8);
        this.tweens.add({ targets: s, alpha: 0, scaleY: 0, duration: 200, onComplete: () => s.destroy() });
        this.structures = this.structures.filter(x => x !== s);
    }

    updateTowers(time) {
        this.structures.forEach(s => {
            if (s.type !== 'taarn' || s.dead) return;
            if (time < (s.cd || 0)) return;
            // nearest living enemy in range
            let target = null, best = 130;
            this.enemies.forEach(e => {
                if (e.dead) return;
                const d = Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y);
                if (d < best) { best = d; target = e; }
            });
            if (target) {
                s.cd = time + 850;
                this.fireBolt(s, target);
            }
        });
    }

    fireBolt(tower, enemy) {
        const bolt = this.add.image(tower.x, tower.y - 12, 'bolt').setDepth(1300);
        this.sfx.towerShoot();
        this.tweens.add({
            targets: bolt, x: enemy.x, y: enemy.y, duration: 180,
            onComplete: () => {
                bolt.destroy();
                if (enemy.active && !enemy.dead) {
                    enemy.hp -= 12;
                    enemy.setTintFill(0xfff2a0);
                    this.time.delayedCall(60, () => { if (enemy.active) enemy.clearTint(); });
                    if (enemy.hp <= 0) this.killEnemy(enemy);
                }
            }
        });
    }

    // ---------------------------------------------------------------- phases
    startNight() {
        this.phase = 'night';
        const n = this.wave;
        const dur = 16 + (n - 1) * 4;
        this.phaseEnd = this.time.now + dur * 1000;
        this.sfx.nightStart();
        this.banner(`🌙  NATT ${n}\nOverlev til daggry!`, 0x8ea0ff);

        const total = 4 + (n - 1) * 2;
        let spawned = 0;
        const interval = Math.max(600, 1500 - n * 110);
        this.spawnTimer = this.time.addEvent({
            delay: interval, loop: true, callback: () => {
                if (spawned >= total || this.phase !== 'night') return;
                this.spawnEnemy(); spawned++;
            }
        });
    }

    startDay() {
        this.phase = 'day';
        const survived = this.wave;       // the night just survived
        this.wave++;
        this.phaseEnd = this.time.now + DAY_SECONDS * 1000;
        if (this.spawnTimer) { this.spawnTimer.remove(); this.spawnTimer = null; }
        // sweep remaining enemies at dawn
        this.enemies.forEach(e => {
            this.burst(e.x, e.y, 'ember', 6);
            this.tweens.add({ targets: e, alpha: 0, scale: 0, duration: 250, onComplete: () => e.destroy() });
        });
        this.enemies = [];
        this.score += 50 * survived;
        if (this.dawnHeal > 0) this.hp = Math.min(this.maxHp, this.hp + this.dawnHeal);
        // sawmill wood income
        const mills = this.buildCounts.sagbruk;
        if (mills > 0) {
            this.wood += mills * 6;
            this.floatText(FIRE.x, FIRE.y - 50, `🪚 +${mills * 6} 🪵`, '#9fd0ff');
        }
        this.sfx.dayStart();
        // reward: choose one of three random upgrades
        this.offerUpgrades(`☀  Natt ${survived} overlevd!`);
    }

    spawnEnemy() {
        // spawn at a random edge of the play area
        const edge = Phaser.Math.Between(0, 3);
        let x, y;
        if (edge === 0) { x = Phaser.Math.Between(20, W - 20); y = PLAY_TOP; }
        else if (edge === 1) { x = Phaser.Math.Between(20, W - 20); y = PLAY_BOTTOM; }
        else if (edge === 2) { x = 16; y = Phaser.Math.Between(PLAY_TOP, PLAY_BOTTOM); }
        else { x = W - 16; y = Phaser.Math.Between(PLAY_TOP, PLAY_BOTTOM); }

        const n = this.wave;
        const e = this.add.image(x, y, 'enemy').setDepth(y);
        e.hp = 10 + (n - 1) * 6;
        e.speed = 28 + (n - 1) * 4;
        e.dmg = 4 + (n - 1) * 2;
        e.hitCd = 0;
        e.dead = false;
        e.setScale(0).setAlpha(0);
        this.tweens.add({ targets: e, scale: 1, alpha: 1, duration: 250 });
        this.enemies.push(e);
    }

    // ---------------------------------------------------------------- update
    update(time, delta) {
        if (this.gameIsOver) return;
        const dt = delta / 1000;

        // pause world while choosing an upgrade card
        if (this.menuOpen) {
            this.phaseEnd += delta;   // don't let the day clock run during the pick
            return;
        }

        this.handleMovement(dt);
        this.updateEnemies(dt, time);
        this.updateTowers(time);

        // house passive healing
        if (this.houseRegen > 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.maxHp, this.hp + this.houseRegen * dt);
        }

        // standing in the fire burns you — no safe camping spot
        if (this.fuel > 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, FIRE.x, FIRE.y) < 30
            && time > (this.burnCd || 0)) {
            this.burnCd = time + 350;
            this.hp = Math.max(0, this.hp - 6);
            this.burst(this.player.x, this.player.y - 8, 'ember', 4);
            this.player.setTintFill(0xff7a2b);
            this.time.delayedCall(120, () => { if (this.player.active) this.player.clearTint(); });
            this.floatText(this.player.x, this.player.y - 28, '🔥', '#ff7a2b');
            if (this.hp <= 0) { this.gameOver('Du brant opp i bålet'); return; }
            this.updateHUD();
        }

        // fuel drain at night
        if (this.phase === 'night') {
            const drain = (1.1 + (this.wave - 1) * 0.45) * this.fuelDrainMult;
            this.fuel = Math.max(0, this.fuel - drain * dt);
            if (this.fuel <= 0) { this.gameOver('Bålet slukna i mørket'); return; }
        }

        // phase timer
        const remain = Math.max(0, Math.ceil((this.phaseEnd - time) / 1000));
        if (time >= this.phaseEnd) {
            if (this.phase === 'day') this.startNight();
            else this.startDay();
        }

        // fire/darkness visuals
        const fuelRatio = this.fuel / this.fuelMax;
        let nightAlpha = 0;
        if (this.phase === 'night') nightAlpha = 0.62 * (1 - 0.35 * fuelRatio);
        this.nightOverlay.setAlpha(Phaser.Math.Linear(this.nightOverlay.alpha, nightAlpha, 0.05));
        const glowA = this.phase === 'night' ? (0.5 + 0.5 * fuelRatio) : 0.18 * fuelRatio;
        this.fireGlow.setAlpha(Phaser.Math.Linear(this.fireGlow.alpha, glowA, 0.05));
        this.fireGlow.setScale(1.4 + 1.6 * fuelRatio);
        this.flame.setScale(0.6 + 0.7 * fuelRatio, 0.6 + 0.7 * fuelRatio);

        this.updateHUD(remain);
    }

    handleMovement(dt) {
        let vx = 0, vy = 0;
        if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
        if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
        if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
        if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
        if (vx === 0 && vy === 0 && this.joy.active) { vx = this.joy.vx; vy = this.joy.vy; }

        const mag = Math.hypot(vx, vy);
        if (mag > 0.12) {
            vx /= (mag > 1 ? mag : 1); vy /= (mag > 1 ? mag : 1);
            this.player.x = Phaser.Math.Clamp(this.player.x + vx * this.moveSpeed * dt, 16, W - 16);
            this.player.y = Phaser.Math.Clamp(this.player.y + vy * this.moveSpeed * dt, PLAY_TOP + 10, PLAY_BOTTOM);
            if (vx < -0.05) this.facing = -1; else if (vx > 0.05) this.facing = 1;
            this.player.setFlipX(this.facing < 0);
            this.walkPhase += dt * 12;
            this.player.setRotation(Math.sin(this.walkPhase) * 0.08);
            this.player.setDepth(this.player.y);

            // boots upgrade → kick up dust while moving
            const boots = this.upgLevels.boots || 0;
            if (boots > 0 && this.time.now > this.dustCd) {
                this.dustCd = this.time.now + Math.max(70, 180 - boots * 25);
                const d = this.add.image(this.player.x - this.facing * 8, this.player.y + 14, 'dust')
                    .setDepth(this.player.y - 1).setAlpha(0.6).setScale(0.6 + boots * 0.15);
                this.tweens.add({ targets: d, alpha: 0, scale: 0.2, y: d.y + 6, duration: 360, onComplete: () => d.destroy() });
            }
        } else {
            this.player.setRotation(0);
        }

        // power aura + reach ring follow the player
        this.playerAura.setPosition(this.player.x, this.player.y).setDepth(this.player.depth - 1);
        this.reachRing.setPosition(this.player.x, this.player.y);
    }

    updateEnemies(dt, time) {
        this.enemies.forEach(e => {
            if (e.dead) return;
            const toFire = Phaser.Math.Distance.Between(e.x, e.y, FIRE.x, FIRE.y);
            const toPlayer = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);

            // a fence in the way must be smashed first
            let fence = null, fd = 32;
            this.structures.forEach(s => {
                if (s.type !== 'gjerde' || s.dead) return;
                const d = Phaser.Math.Distance.Between(e.x, e.y, s.x, s.y);
                if (d < fd) { fd = d; fence = s; }
            });

            if (fence) {
                if (time > e.hitCd) {
                    e.hitCd = time + 600;
                    fence.hp -= e.dmg;
                    fence.setTintFill(0xff8888);
                    this.time.delayedCall(80, () => { if (fence.active) fence.clearTint(); });
                    this.sfx.hitEnemy();
                    if (fence.hp <= 0) this.destroyStructure(fence);
                }
            } else if (toFire > 38) {
                // move toward fire, or the player if they're in the way
                let tx = FIRE.x, ty = FIRE.y;
                if (toPlayer < 60) { tx = this.player.x; ty = this.player.y; }
                const a = Phaser.Math.Angle.Between(e.x, e.y, tx, ty);
                e.x += Math.cos(a) * e.speed * dt;
                e.y += Math.sin(a) * e.speed * dt;
                e.setDepth(e.y);
            } else if (time > e.hitCd) {
                // gnawing the fire
                e.hitCd = time + 600;
                this.fuel = Math.max(0, this.fuel - 3);
                this.burst(e.x, e.y, 'ember', 3);
            }

            // damage player on contact
            if (toPlayer < 24 && time > e.hitCd) {
                e.hitCd = time + 600;
                this.damagePlayer(e.dmg);
            }
        });
    }

    damagePlayer(amount) {
        this.hp = Math.max(0, this.hp - amount);
        this.sfx.hurt();
        this.cameras.main.shake(120, 0.01);
        this.player.setTintFill(0xff5050);
        this.time.delayedCall(120, () => { if (this.player.active) this.player.clearTint(); });
        this.updateHUD();
        if (this.hp <= 0) this.gameOver('Du falt i mørket');
    }

    // ---------------------------------------------------------------- ui helpers
    updateHUD(remain) {
        this.woodText.setText(`🪵 ${this.wood}`);
        this.scoreText.setText(`${this.score}`);
        this.hpBar.width = 150 * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
        this.fuelBar.width = 150 * Phaser.Math.Clamp(this.fuel / this.fuelMax, 0, 1);
        if (remain !== undefined) {
            const day = this.phase === 'day';
            if (day) {
                this.phaseText.setText(`☀ Dag ${this.wave} · ${remain}s`).setColor('#ffd166');
                this.hintText.setText('Hugg ved • 🛒 bygg');
            } else {
                this.phaseText.setText(`🌙 Natt ${this.wave} · ${remain}s`).setColor('#9fb0ff');
                this.hintText.setText('Mat bålet • slåss');
            }
            if (this.shopBtn.visible !== day) {
                this.shopBtn.setVisible(day);
                this.shopBtnIcon.setVisible(day);
            }
        }
    }

    floatText(x, y, msg, color) {
        const t = this.add.text(x, y, msg, {
            fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold', color
        }).setOrigin(0.5).setDepth(1500);
        this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }

    burst(x, y, key, count) {
        for (let i = 0; i < count; i++) {
            const p = this.add.image(x, y, key).setDepth(1400);
            const a = Math.random() * Math.PI * 2;
            const d = 12 + Math.random() * 26;
            this.tweens.add({
                targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 8,
                alpha: 0, scale: 0.3, duration: 350 + Math.random() * 250,
                onComplete: () => p.destroy()
            });
        }
    }

    banner(msg, color) {
        const t = this.add.text(W / 2, 250, msg, {
            fontSize: '26px', fontFamily: 'Arial', fontStyle: 'bold',
            color: '#ffffff', align: 'center', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(2500).setAlpha(0).setScale(0.8);
        this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 250, yoyo: true, hold: 900,
            onComplete: () => t.destroy() });
    }

    gameOver(reason) {
        if (this.gameIsOver) return;
        this.gameIsOver = true;
        this.sfx.gameOver();
        if (this.spawnTimer) this.spawnTimer.remove();

        const hi = Number(localStorage.getItem('emberwood_highscore') || 0);
        if (this.score > hi) localStorage.setItem('emberwood_highscore', String(this.score));
        const best = Math.max(hi, this.score);

        const c = this.add.container(0, 0).setDepth(5000);
        c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0).setInteractive());
        c.add(this.add.text(W / 2, 200, 'SLUTT', {
            fontSize: '48px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ff5050'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 250, reason, {
            fontSize: '16px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 320,
            `Du nådde natt ${this.wave}\nPoeng: ${this.score}\nBeste: ${best}`, {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', align: 'center', lineSpacing: 8
        }).setOrigin(0.5));

        const restart = this.add.rectangle(W / 2, 440, 220, 60, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(restart);
        c.add(this.add.text(W / 2, 440, 'SPILL IGJEN', {
            fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        restart.on('pointerup', () => this.scene.restart());

        const menu = this.add.rectangle(W / 2, 515, 220, 50, 0x2a6b3a)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(menu);
        c.add(this.add.text(W / 2, 515, 'MENY', {
            fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        menu.on('pointerup', () => this.scene.start('MenuScene'));
    }
}
