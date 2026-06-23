import Phaser from 'phaser';
import { SoundFX } from '../utils/SoundFX.js';
import { loadRoster, saveRoster, getActive, milestonesUnlocked, perkCount, PERKS, generateAvatarTexture } from '../utils/Characters.js';

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
const FEED_CD = 280;       // ms between feeds (button recharges visibly)

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
        // run stats (shown on game over)
        this.stats = { treesChopped: 0, enemiesKilled: 0, woodSpent: 0 };
        this.phase = 'day';            // 'day' | 'night'
        this.phaseEnd = this.time.now + DAY_SECONDS * 1000;
        this.phaseDuration = DAY_SECONDS;

        this.maxHp = 100;
        this.hp = 100;
        this.fuelMax = 100;
        this.fuel = 100;

        this.axeDmg = 6;
        this.moveSpeed = 150;
        this.swingCd = 0;
        this.swingDelay = 460;
        this.swingRange = 56;
        this.treeBonus = 0;       // extra wood per felled tree
        this.killWood = 2;        // wood per killed enemy
        this.critChance = 0;      // 0..1 chance for a critical hit
        this.critMult = 2;        // damage multiplier on a crit
        this.knockback = 7;       // px enemies are shoved on an axe hit
        this.armor = 0;           // flat damage reduction per enemy hit
        this.fuelDrainMult = 1;   // bålmester reduces this
        this.dawnHeal = 0;        // hp restored each dawn
        this.upgLevels = {};      // how many times each upgrade was taken
        this.slashColor = 0xffffff;
        this.slashScale = 1;
        this.dustCd = 0;

        // ---- Active character: appearance + permanent perks ----
        this.roster = loadRoster();
        this.char = getActive(this.roster);
        generateAvatarTexture(this, 'player', this.char);   // player sprite from looks
        const pk = this.char.perks;
        this.axeDmg += pk.axe;
        this.maxHp += pk.hp * 3; this.hp = this.maxHp;
        this.moveSpeed += pk.speed * 4;
        this.fuelMax += pk.fuel * 5; this.fuel = this.fuelMax;
        this.wood += pk.wood * 2;
        this.fuelDrainMult *= Math.max(0.5, 1 - pk.drain * 0.02);
        this.critChance += pk.crit * 0.015;     // +1.5% crit per perk level
        this.knockback += pk.knock * 2;         // +2 knockback per perk level
        this.armor += pk.armor * 1;             // +1 armor per perk level

        this.facing = 1;               // 1 right, -1 left
        this.trees = [];
        this.enemies = [];
        this.structures = [];
        this.buildCounts = { gjerde: 0, taarn: 0, iskanon: 0, bombekaster: 0, piggfelle: 0, hus: 0, sagbruk: 0 };
        this.houseRegen = 0;
        this.spawnTimer = null;
        this.gameIsOver = false;
        this.menuOpen = false;

        // ---- World ----
        this.createGround();
        this.createFire();
        this.createTrees();
        this.createPlayer();

        // Darkness + glow for night
        this.nightOverlay = this.add.rectangle(0, 0, W, H, 0x0a1024)
            .setOrigin(0).setAlpha(0).setDepth(900);
        this.fireGlow = this.add.image(FIRE.x, FIRE.y, 'glow')
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(901).setAlpha(0).setScale(2.4);
        // vignette for a framed, cozy look (under the night overlay)
        this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W + 8, H + 8).setDepth(890);
        // red warning vignette that pulses when the fire is running low at night
        this.lowFuelVignette = this.add.image(W / 2, H / 2, 'vignette')
            .setDisplaySize(W + 8, H + 8).setDepth(905).setTint(0xff2020).setAlpha(0);
        this.lowFuelCd = 0;

        this.createHUD();
        this.createControls();
        this.setupInput();

        this.banner('☀  DAG 1\nHugg ved!', 0xffd166);
    }

    // ---------------------------------------------------------------- textures
    makeTextures() {
        if (this.textures.exists('glow')) return; // already built (e.g. after restart)
        const g = this.add.graphics();

        // (player sprite is generated per-character in create via generateAvatarTexture)

        // tree – layered foliage with highlight/shade
        g.clear();
        g.fillStyle(0x5a3819, 1); g.fillRect(22, 40, 9, 22);                            // trunk shade
        g.fillStyle(0x6b4423, 1); g.fillRect(22, 40, 5, 22);                            // trunk
        g.fillStyle(0x276b32, 1); g.fillCircle(26, 30, 19);                             // base foliage (dark)
        g.fillStyle(0x2f7d3a, 1); g.fillCircle(26, 24, 19);
        g.fillStyle(0x3f9c4c, 1); g.fillCircle(19, 19, 12);
        g.fillStyle(0x57b85f, 1); g.fillCircle(31, 15, 9);                              // highlight
        g.fillStyle(0x73d178, 1); g.fillCircle(24, 12, 5);                              // top glint
        g.generateTexture('tree', 52, 66); g.clear();

        // tough tree (oak) – sturdier trunk, bronze/golden autumn canopy
        g.fillStyle(0x4a2d12, 1); g.fillRect(21, 38, 11, 24);                           // thick trunk shade
        g.fillStyle(0x5e3a1c, 1); g.fillRect(22, 38, 6, 24);                            // trunk
        g.fillStyle(0x6b4a16, 1); g.fillCircle(26, 29, 20);                             // dark bronze base
        g.fillStyle(0x8a6b1e, 1); g.fillCircle(26, 23, 20);
        g.fillStyle(0xb9912b, 1); g.fillCircle(18, 18, 12);                             // golden highlight
        g.fillStyle(0xd8b54a, 1); g.fillCircle(32, 14, 9);
        g.fillStyle(0xf0d873, 1); g.fillCircle(24, 11, 5);                              // top glint
        g.generateTexture('tree_oak', 52, 66); g.clear();

        // ancient tree – dark gnarled pine, deep teal foliage with a frosty crown
        g.fillStyle(0x3a2a14, 1); g.fillRect(20, 36, 13, 26);                           // heavy trunk shade
        g.fillStyle(0x4d3a1e, 1); g.fillRect(21, 36, 7, 26);                            // trunk
        g.fillStyle(0x123a2c, 1); g.fillCircle(26, 30, 21);                             // very dark base
        g.fillStyle(0x18514a, 1); g.fillCircle(26, 22, 21);
        g.fillStyle(0x2f7d72, 1); g.fillCircle(18, 17, 13);                             // teal highlight
        g.fillStyle(0x57b0a3, 1); g.fillCircle(32, 13, 9);
        g.fillStyle(0x9fe6d6, 1); g.fillCircle(24, 10, 5);                              // frosty glint
        g.generateTexture('tree_ancient', 52, 66); g.clear();

        // stump
        g.fillStyle(0x5a3819, 1); g.fillRect(4, 8, 16, 11);
        g.fillStyle(0x6b4423, 1); g.fillRect(4, 6, 16, 4);
        g.fillStyle(0x8a5a30, 1); g.fillEllipse(12, 7, 16, 7);
        g.fillStyle(0x6b4423, 1); g.fillCircle(12, 7, 2);                               // rings
        g.generateTexture('stump', 24, 20); g.clear();

        // enemy – rounded shadow creature with horns + glowing eyes
        g.fillStyle(0x000000, 0.16); g.fillEllipse(16, 33, 24, 7);                      // baked shadow
        g.fillStyle(0x1a0f28, 1); g.fillTriangle(5, 9, 9, -1, 13, 9);                   // horns
        g.fillTriangle(19, 9, 23, -1, 27, 9);
        g.fillStyle(0x2a1840, 1); g.fillCircle(16, 19, 14);                             // body
        g.fillStyle(0x3a2356, 1); g.fillCircle(16, 15, 12);
        g.fillStyle(0x4a2f6e, 1); g.fillCircle(11, 11, 5);                              // highlight
        g.fillStyle(0xff3b6b, 1); g.fillCircle(11, 17, 3); g.fillCircle(21, 17, 3);     // eyes
        g.fillStyle(0xffd0dd, 1); g.fillCircle(10, 16, 1); g.fillCircle(20, 16, 1);     // glints
        g.generateTexture('enemy', 32, 38); g.clear();

        // brute – slow, bulky rock-troll (tanky)
        g.fillStyle(0x000000, 0.18); g.fillEllipse(22, 41, 36, 9);                      // shadow
        g.fillStyle(0x3a4a2e, 1); g.fillRoundedRect(6, 12, 32, 28, 8);                  // bulky body
        g.fillStyle(0x4a5e3a, 1); g.fillRoundedRect(6, 12, 32, 12, 8);                  // lighter top
        g.fillStyle(0x2c3a24, 1); g.fillRect(2, 22, 6, 12); g.fillRect(36, 22, 6, 12);  // arms
        g.fillStyle(0x6b7d52, 1); g.fillCircle(14, 10, 4); g.fillCircle(30, 10, 4);     // mossy lumps
        g.fillStyle(0xffd23b, 1); g.fillRect(14, 22, 5, 4); g.fillRect(26, 22, 5, 4);   // angry eyes
        g.fillStyle(0x9aa882, 1); g.fillRect(15, 32, 14, 3);                            // teeth/jaw
        g.generateTexture('brute', 44, 46); g.clear();

        // flyer – fragile floating wisp with wings
        g.fillStyle(0x9fb8ff, 0.5); g.fillTriangle(2, 8, 14, 12, 4, 20);                // left wing
        g.fillStyle(0x9fb8ff, 0.5); g.fillTriangle(30, 8, 18, 12, 28, 20);             // right wing
        g.fillStyle(0x5b76c8, 1); g.fillCircle(16, 14, 10);                             // body
        g.fillStyle(0x8aa0e6, 1); g.fillCircle(16, 11, 7);
        g.fillStyle(0xffffff, 1); g.fillCircle(13, 13, 2); g.fillCircle(19, 13, 2);     // eyes
        g.fillStyle(0x1a2240, 1); g.fillCircle(13, 13, 1); g.fillCircle(19, 13, 1);
        g.fillStyle(0x5b76c8, 0.7); g.fillTriangle(11, 22, 16, 30, 21, 22);             // wispy tail
        g.generateTexture('flyer', 32, 32); g.clear();

        // revenant – armoured crimson bruiser with burning eyes (night 10+)
        g.fillStyle(0x000000, 0.18); g.fillEllipse(20, 41, 34, 8);                      // shadow
        g.fillStyle(0x20121a, 1); g.fillTriangle(6, 9, 11, -2, 16, 10);                 // horns
        g.fillTriangle(24, 10, 29, -2, 34, 9);
        g.fillStyle(0x3a1420, 1); g.fillRoundedRect(6, 12, 28, 28, 7);                  // dark crimson body
        g.fillStyle(0x5a1e2e, 1); g.fillRoundedRect(6, 12, 28, 12, 7);                  // lighter top
        g.fillStyle(0x7a1010, 1); g.fillRect(11, 26, 4, 11); g.fillRect(25, 26, 4, 11); // glowing cracks
        g.fillStyle(0xff7a1e, 1); g.fillCircle(15, 22, 3); g.fillCircle(25, 22, 3);     // burning eyes
        g.fillStyle(0xffe0b0, 1); g.fillCircle(14, 21, 1); g.fillCircle(24, 21, 1);
        g.fillStyle(0x8a8f99, 1); g.fillRect(13, 33, 14, 3);                            // iron jaw
        g.generateTexture('revenant', 40, 46); g.clear();

        // wraith – fast sickly-green specter that streaks toward the fire (night 15+)
        g.fillStyle(0x000000, 0.12); g.fillEllipse(16, 36, 20, 6);                      // faint shadow
        g.fillStyle(0x1d4a3a, 0.7); g.fillTriangle(6, 30, 16, 40, 26, 30);              // wispy tail
        g.fillStyle(0x247a5a, 1); g.fillCircle(16, 16, 11);                             // body
        g.fillStyle(0x39a878, 1); g.fillCircle(16, 12, 8);
        g.fillStyle(0x39a878, 0.55); g.fillTriangle(3, 11, 12, 16, 5, 23);              // side wisps
        g.fillTriangle(29, 11, 20, 16, 27, 23);
        g.fillStyle(0xaef0c8, 1); g.fillCircle(12, 15, 3); g.fillCircle(20, 15, 3);     // pale eyes
        g.fillStyle(0x062018, 1); g.fillCircle(12, 15, 1.4); g.fillCircle(20, 15, 1.4);
        g.generateTexture('wraith', 32, 40); g.clear();

        // titan – hulking boss with a third eye (night 20+)
        g.fillStyle(0x000000, 0.22); g.fillEllipse(28, 52, 48, 11);                     // big shadow
        g.fillStyle(0x140a22, 1); g.fillTriangle(6, 16, 12, -2, 20, 16);                // big horns
        g.fillTriangle(36, 16, 44, -2, 50, 16);
        g.fillStyle(0x241338, 1); g.fillCircle(28, 30, 22);                             // huge body
        g.fillStyle(0x35205a, 1); g.fillCircle(28, 24, 19);
        g.fillStyle(0x4d2f7e, 1); g.fillCircle(18, 18, 7);                              // highlight
        g.fillStyle(0xff2b5b, 1); g.fillCircle(20, 28, 4); g.fillCircle(36, 28, 4);     // eyes
        g.fillCircle(28, 20, 3);                                                        // third eye
        g.fillStyle(0xffd0dd, 1); g.fillCircle(19, 27, 1.5); g.fillCircle(35, 27, 1.5);
        g.fillStyle(0x6e1830, 1); g.fillRect(20, 40, 16, 4);                            // grim mouth
        g.generateTexture('titan', 56, 58); g.clear();

        // wood chip particle
        g.fillStyle(0xb07a3c, 1); g.fillRect(0, 0, 6, 6);
        g.generateTexture('chip', 6, 6); g.clear();

        // ember particle
        g.fillStyle(0xffb347, 1); g.fillRect(0, 0, 5, 5);
        g.generateTexture('ember', 5, 5); g.clear();

        // slash – a crescent blade trail (centred, opening to the right)
        g.fillStyle(0xffffff, 0.95);
        g.beginPath();
        g.arc(26, 26, 23, Phaser.Math.DegToRad(-62), Phaser.Math.DegToRad(62), false);
        g.arc(26, 26, 13, Phaser.Math.DegToRad(62), Phaser.Math.DegToRad(-62), true);
        g.closePath();
        g.fillPath();
        g.generateTexture('slash', 56, 56); g.clear();

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

        // ice cannon – slows enemies
        g.fillStyle(0x4a6b78, 1); g.fillRect(4, 18, 24, 18);       // base
        g.fillStyle(0x6fb7d4, 1); g.fillRect(10, 8, 14, 14);       // body
        g.fillStyle(0xbfeeff, 1); g.fillCircle(17, 13, 6);         // ice orb
        g.fillStyle(0x9fe6ff, 1); g.fillRect(22, 11, 8, 5);        // barrel
        g.generateTexture('icecannon', 34, 38); g.clear();

        // mortar – lobs explosive shells
        g.fillStyle(0x3a3a44, 1); g.fillRect(4, 22, 24, 14);       // base
        g.fillStyle(0x55555f, 1); g.fillRect(9, 6, 12, 22);        // tube
        g.fillStyle(0x2a2a30, 1); g.fillEllipse(15, 7, 12, 6);     // muzzle
        g.generateTexture('mortar', 32, 38); g.clear();

        // spike trap – damages nearby enemies
        g.fillStyle(0x3a2a18, 1); g.fillRect(2, 18, 30, 8);        // pad
        g.fillStyle(0xb8c0c8, 1);
        g.fillTriangle(4, 18, 10, 2, 16, 18);
        g.fillTriangle(14, 18, 20, 4, 26, 18);
        g.fillTriangle(22, 18, 28, 6, 32, 18);
        g.generateTexture('spiketrap', 34, 26); g.clear();

        // ice bolt + mortar shell projectiles
        g.fillStyle(0xbfeeff, 1); g.fillCircle(4, 4, 4);
        g.generateTexture('icebolt', 8, 8); g.clear();
        g.fillStyle(0x2a2a30, 1); g.fillCircle(5, 5, 5);
        g.generateTexture('shell', 10, 10); g.clear();

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

        // soft drop-shadow blob (placed under entities for depth)
        const sh = this.textures.createCanvas('shadow', 64, 64);
        const sctx = sh.getContext();
        const sg = sctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        sg.addColorStop(0, 'rgba(0,0,0,0.38)');
        sg.addColorStop(0.7, 'rgba(0,0,0,0.18)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = sg;
        sctx.fillRect(0, 0, 64, 64);
        sh.refresh();

        // vignette – darkened edges for a cozier, framed look
        const vg = this.textures.createCanvas('vignette', 256, 256);
        const vctx = vg.getContext();
        const vgr = vctx.createRadialGradient(128, 128, 70, 128, 128, 150);
        vgr.addColorStop(0, 'rgba(8,12,18,0)');
        vgr.addColorStop(1, 'rgba(8,12,18,0.55)');
        vctx.fillStyle = vgr;
        vctx.fillRect(0, 0, 256, 256);
        vg.refresh();
    }

    // ---------------------------------------------------------------- entities
    createGround() {
        // grassy gradient base
        const g = this.add.graphics().setDepth(-10);
        g.fillGradientStyle(0x4a8a52, 0x4a8a52, 0x35723e, 0x2c5f34, 1);
        g.fillRect(0, 0, W, H);

        // scattered grass tufts + a few flowers for texture
        for (let i = 0; i < 90; i++) {
            const x = Phaser.Math.Between(6, W - 6);
            const y = Phaser.Math.Between(PLAY_TOP - 10, H - 6);
            const r = Math.random();
            if (r < 0.12) {
                // flower
                const col = [0xffd166, 0xff8fb0, 0xfff0f5][Phaser.Math.Between(0, 2)];
                this.add.circle(x, y, 2.5, col).setDepth(-9);
                this.add.circle(x, y, 1, 0xffd166).setDepth(-9);
            } else {
                const shade = r < 0.5 ? 0x3f7d47 : 0x55a05d;
                this.add.rectangle(x, y, 2, Phaser.Math.Between(3, 6), shade).setDepth(-9).setAlpha(0.7);
            }
        }

        // dirt clearing around the campfire
        this.add.ellipse(FIRE.x, FIRE.y + 6, 150, 110, 0x6b5436, 0.55).setDepth(-8);
        this.add.ellipse(FIRE.x, FIRE.y + 6, 110, 80, 0x7a5f3c, 0.5).setDepth(-8);
    }

    addShadow(x, y, w, alpha = 0.9, depth = 0) {
        return this.add.image(x, y, 'shadow')
            .setDisplaySize(w, w * 0.42).setAlpha(alpha).setDepth(depth);
    }

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

    // tougher tree variants. As the nights go on, more trees grow in as oaks
    // (sturdier) or ancient pines (toughest) — they take more hits but drop more
    // wood. Returns 0 = normal, 1 = oak, 2 = ancient.
    rollTreeTier() {
        const w = this.wave;
        const ancient = Math.min(0.40, (w - 3) * 0.08);   // toughest, from ~night 4
        const oak = Math.min(0.70, (w - 1) * 0.12);        // sturdy, from night 2
        const r = Math.random();
        if (r < ancient) return 2;
        if (r < oak) return 1;
        return 0;
    }

    applyTreeTier(t, tier) {
        const spec = [
            { tex: 'tree',         hp: 16,  wood: 0 },
            { tex: 'tree_oak',     hp: 42,  wood: 3 },
            { tex: 'tree_ancient', hp: 85,  wood: 7 },
        ][tier];
        t.tier = tier;
        t.woodBonus = spec.wood;
        t.maxHp = spec.hp; t.hp = spec.hp;
        t.setTexture(spec.tex);
    }

    createTrees() {
        this.treeSpots().forEach((spot, i) => {
            this.addShadow(spot.x, spot.y + 28, 40, 0.5, spot.y - 1);
            const t = this.add.image(spot.x, spot.y, 'tree').setDepth(spot.y);
            t.homeX = spot.x; t.homeY = spot.y; t.alive = true;
            this.applyTreeTier(t, this.rollTreeTier());
            // gentle idle sway (anchored near the base so it looks rooted)
            t.setAngle(-1.5);
            this.tweens.add({
                targets: t, angle: 1.5, duration: 1800 + i * 90, yoyo: true, repeat: -1,
                ease: 'Sine.inOut', delay: i * 120
            });
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
        this.playerShadow = this.addShadow(FIRE.x, FIRE.y + 88, 30, 0.6, 498);
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

    // clamp a candidate build spot into the play area
    clampBuild(x, y) {
        return {
            x: Phaser.Math.Clamp(x, 26, W - 26),
            y: Phaser.Math.Clamp(y, PLAY_TOP + 26, PLAY_BOTTOM - 12)
        };
    }

    // snap a point to the build grid (cells centred on the fire), kept in-bounds
    snapToGrid(x, y) {
        const C = GameScene.CELL, ox = FIRE.x, oy = FIRE.y;
        const minIx = Math.ceil((26 - ox) / C), maxIx = Math.floor((W - 26 - ox) / C);
        const minIy = Math.ceil((PLAY_TOP + 26 - oy) / C), maxIy = Math.floor((PLAY_BOTTOM - 12 - oy) / C);
        const ix = Phaser.Math.Clamp(Math.round((x - ox) / C), minIx, maxIx);
        const iy = Phaser.Math.Clamp(Math.round((y - oy) / C), minIy, maxIy);
        return { x: ox + ix * C, y: oy + iy * C };
    }

    // pick a free grid cell to pre-suggest when building — valid (never occupied)
    // and spread out from existing buildings, kept in a useful band near the fire
    suggestCell() {
        const C = GameScene.CELL, ox = FIRE.x, oy = FIRE.y;
        const minIx = Math.ceil((26 - ox) / C), maxIx = Math.floor((W - 26 - ox) / C);
        const minIy = Math.ceil((PLAY_TOP + 26 - oy) / C), maxIy = Math.floor((PLAY_BOTTOM - 12 - oy) / C);
        let best = null, bestScore = -Infinity;
        for (let ix = minIx; ix <= maxIx; ix++) {
            for (let iy = minIy; iy <= maxIy; iy++) {
                const x = ox + ix * C, y = oy + iy * C;
                if (!this.placeValid(x, y)) continue;          // skip fire/buttons/occupied
                let minD = 200;
                for (const s of this.structures) {
                    if (s.dead) continue;
                    minD = Math.min(minD, Phaser.Math.Distance.Between(x, y, s.x, s.y));
                }
                const fire = Phaser.Math.Distance.Between(x, y, ox, oy);
                const score = minD - 0.5 * Math.abs(fire - 120);   // spread, but hug the base
                if (score > bestScore) { bestScore = score; best = { x, y }; }
            }
        }
        return best || this.snapToGrid(ox, oy + 110);
    }

    // is (x,y) a legal place to build? not on the fire, not on top of another
    // build, and not under the control buttons (so taps there stay unambiguous)
    placeValid(x, y) {
        if (Phaser.Math.Distance.Between(x, y, FIRE.x, FIRE.y) < 46) return false;
        if (this.onButton(x, y)) return false;
        for (const s of this.structures) {
            if (!s.dead && Phaser.Math.Distance.Between(x, y, s.x, s.y) < 24) return false;
        }
        return true;
    }

    // ---------------------------------------------------------------- HUD
    createHUD() {
        this.add.rectangle(0, 0, W, PLAY_TOP - 8, 0x10180f, 0.82).setOrigin(0).setDepth(2000);

        // day/night time-remaining bar across the very top
        this.add.rectangle(0, 0, W, 7, 0x000000, 0.55).setOrigin(0, 0).setDepth(2003);
        this.timeBar = this.add.rectangle(0, 0, W, 7, 0xffd166).setOrigin(0, 0).setDepth(2004);

        this.woodText = this.add.text(12, 14, '🪵 12', {
            fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setDepth(2001);

        this.scoreText = this.add.text(W - 12, 14, '0', {
            fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(1, 0).setDepth(2001);

        this.phaseText = this.add.text(W / 2, 16, '', {
            fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5, 0).setDepth(2001);

        // pause / menu button — drawn glyph, in the empty lower-right of the HUD
        const px = W - 28, py = 94;
        this.pauseBtn = this.add.rectangle(px, py, 34, 30, 0x1d2e18, 0.62)
            .setStrokeStyle(2, 0xffd166).setDepth(2004).setInteractive({ useHandCursor: true });
        this.add.rectangle(px - 5, py, 5, 14, 0xffd166).setDepth(2005);
        this.add.rectangle(px + 5, py, 5, 14, 0xffd166).setDepth(2005);
        this.pauseBtn.on('pointerover', () => this.pauseBtn.setScale(1.08));
        this.pauseBtn.on('pointerout', () => this.pauseBtn.setScale(1));
        this.pauseBtn.on('pointerup', () => this.openPause());

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
        // Big swing button, lifted up and in from the corner for the thumb.
        const swingX = W - 78, swingY = H - 130;
        const feedX = W - 58, feedY = H - 235;
        const shopX = W - 58, shopY = H - 315;
        this.swingHeld = false;

        // Swing button — hold to auto-swing (no repeated tapping)
        this.swingBtn = this.add.circle(swingX, swingY, 56, 0xc1440e, 0.6)
            .setStrokeStyle(4, 0xffd166).setScrollFactor(0).setDepth(3000)
            .setInteractive({ useHandCursor: true });
        this.add.text(swingX, swingY, '🪓', { fontSize: '42px' }).setOrigin(0.5).setDepth(3001).setAlpha(0.92);
        this.swingBtn.on('pointerdown', () => { this.swingBtn.setScale(0.92); this.swingHeld = true; this.swing(); });
        this.swingBtn.on('pointerup', () => { this.swingBtn.setScale(1); this.swingHeld = false; });
        this.swingBtn.on('pointerout', () => { this.swingBtn.setScale(1); this.swingHeld = false; });

        // Feed button
        this.feedBtnPos = { x: feedX, y: feedY, r: 34 };
        this.feedBtn = this.add.circle(feedX, feedY, 34, 0x2a6b3a, 0.58)
            .setStrokeStyle(3, 0xffd166).setScrollFactor(0).setDepth(3000)
            .setInteractive({ useHandCursor: true });
        this.feedIcon = this.add.text(feedX, feedY, '🔥', { fontSize: '24px' }).setOrigin(0.5).setDepth(3001).setAlpha(0.92);
        // dark wedge that shrinks as the button recharges after a feed
        this.feedCdG = this.add.graphics().setScrollFactor(0).setDepth(3002);
        this.feedBtn.on('pointerdown', () => { this.feedBtn.setScale(0.9); this.feedFire(); });
        this.feedBtn.on('pointerup', () => this.feedBtn.setScale(1));
        this.feedBtn.on('pointerout', () => this.feedBtn.setScale(1));

        // Shop button (day only)
        this.shopBtn = this.add.circle(shopX, shopY, 30, 0x4a6b3a, 0.58)
            .setStrokeStyle(3, 0xffd166).setScrollFactor(0).setDepth(3000)
            .setInteractive({ useHandCursor: true });
        this.shopBtnIcon = this.add.text(shopX, shopY, '🛒', { fontSize: '22px' }).setOrigin(0.5).setDepth(3001).setAlpha(0.92);
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
        return near(this.swingBtn, 64) || near(this.feedBtn, 44) || near(this.pauseBtn, 26) ||
               (this.shopBtn.visible && near(this.shopBtn, 40)) ||
               Phaser.Math.Distance.Between(px, py, FIRE.x, FIRE.y) < 40;
    }

    // during the day, a tap on an upgradeable tower opens its menu — don't also
    // start the joystick there
    nearStructure(px, py) {
        return this.structures.some(s => !s.dead && (GameScene.SPEC[s.type] || s.type === 'gjerde') &&
            Phaser.Math.Distance.Between(px, py, s.x, s.y) < 22);
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,F,B');
        this.keys.SPACE.on('down', () => { this.sfx.ensure(); this.swing(); });
        this.keys.F.on('down', () => { this.sfx.ensure(); this.feedFire(); });
        this.keys.B.on('down', () => { this.sfx.ensure(); this.openShop(); });

        this.input.on('pointerdown', (p) => {
            this.sfx.ensure();
            if (this.joy.active || this.onButton(p.x, p.y) || this.menuOpen || this.placing) return;
            if (this.phase === 'day' && this.nearStructure(p.x, p.y)) return;
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

        // swing arc — sweeps out from the axe (at the player's hand)
        const dir = this.facing;
        const s = this.slashScale;
        const dur = Math.max(120, this.swingDelay * 0.6);
        const hx = this.player.x + dir * 13;   // axe-hand position
        const hy = this.player.y - 4;
        const arc = this.add.image(hx, hy, 'slash')
            .setDepth(601).setFlipX(dir < 0).setScale(s * 0.5).setAlpha(0.95)
            .setTint(this.slashColor)
            .setAngle(dir > 0 ? -72 : 72);     // blade raised
        this.tweens.add({
            targets: arc, angle: dir > 0 ? 34 : -34, scale: s, alpha: 0,
            duration: dur, ease: 'Cubic.out', onComplete: () => arc.destroy()
        });
        // a little chop-lunge on the lumberjack so the swing reads as his
        if (!this.swingLunge || !this.swingLunge.isPlaying()) {
            this.swingLunge = this.tweens.add({
                targets: this.player, angle: dir * 18, duration: dur * 0.45, yoyo: true,
                onComplete: () => { if (this.player.active) this.player.setAngle(0); }
            });
        }
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
        const { dmg, crit } = this.rollDamage(this.axeDmg);
        t.hp -= dmg;
        this.sfx.chopHit();
        if (crit) this.sfx.crit();
        this.tweens.add({ targets: t, x: t.homeX + Phaser.Math.Between(-4, 4), duration: 50, yoyo: true });
        this.burst(t.x, t.y - 10, 'chip', crit ? 9 : 5);
        if (t.hp <= 0) {
            // sawmills boost wood per tree and speed up regrowth
            const mills = this.buildCounts.sagbruk;
            const yield_ = 3 + this.treeBonus + mills + (t.woodBonus || 0);
            this.wood += yield_;
            this.stats.treesChopped++;
            this.sfx.treeFall();
            this.floatText(t.x, t.y - 20, `+${yield_} 🪵`, '#ffd166');
            t.alive = false;
            t.setTexture('stump').setDepth(t.homeY).setPosition(t.homeX, t.homeY + 16);
            const regrowDelay = 9000 * Math.pow(0.75, mills);   // ~25% faster each
            this.time.delayedCall(regrowDelay, () => this.regrow(t));
            this.updateHUD();
        }
    }

    regrow(t) {
        if (this.gameIsOver) return;
        // re-roll the tier on regrowth so the forest hardens as nights pass
        this.applyTreeTier(t, this.rollTreeTier());
        t.setPosition(t.homeX, t.homeY).setDepth(t.homeY);
        t.alive = true;
        t.setScale(0.2);
        this.tweens.add({ targets: t, scale: 1, duration: 400, ease: 'Back.out' });
    }

    hitEnemy(e) {
        if (e.dead) return;
        const { dmg, crit } = this.rollDamage(this.axeDmg);
        e.hp -= dmg;
        this.dmgNumber(e.x, e.y - 14, dmg, crit);
        if (crit) { this.sfx.crit(); this.cameras.main.shake(70, 0.005); this.burst(e.x, e.y, 'ember', 5); }
        this.sfx.hitEnemy();
        e.setTintFill(crit ? 0xffe66a : 0xffffff);
        this.time.delayedCall(70, () => { if (e.active) e.clearTint(); });
        // knockback away from player — crits hit harder, heavy enemies resist
        const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, e.x, e.y);
        const kb = this.knockback * (e.knockResist || 1) * (crit ? 1.6 : 1);
        e.x = Phaser.Math.Clamp(e.x + Math.cos(a) * kb, 10, W - 10);
        e.y = Phaser.Math.Clamp(e.y + Math.sin(a) * kb, PLAY_TOP, PLAY_BOTTOM);
        e.setDepth(e.y);
        if (e.hp <= 0) this.killEnemy(e);
    }

    killEnemy(e) {
        e.dead = true;
        this.stats.enemiesKilled++;
        this.hitStop(55);
        this.sfx.enemyDie();
        this.score += 10 + this.wave;
        this.wood += this.killWood;
        this.burst(e.x, e.y, 'ember', 8);
        this.floatText(e.x, e.y - 10, `+${this.killWood} 🪵`, '#ffd166');
        this.tweens.add({ targets: e, scale: 0, alpha: 0, duration: 150, onComplete: () => e.destroy() });
        this.enemies = this.enemies.filter(x => x !== e);
        this.updateHUD();
    }

    // disable + visibly recharge the feed button during its cooldown
    updateFeedButton() {
        if (!this.feedCdG) return;
        const { x, y, r } = this.feedBtnPos;
        const remain = (this.feedCd || 0) - this.time.now;
        const g = this.feedCdG;
        g.clear();
        if (remain > 0) {
            const ratio = 1 - remain / FEED_CD;          // 0 → just fed, 1 → ready
            this.feedBtn.setFillStyle(0x223a2b, 0.58);   // dimmed while cooling
            this.feedIcon.setAlpha(0.35);
            // dark wedge over the part not yet recharged (fills clockwise from top)
            g.fillStyle(0x05140a, 0.6);
            g.slice(x, y, r - 2, Phaser.Math.DegToRad(-90 + ratio * 360), Phaser.Math.DegToRad(270), false);
            g.fillPath();
        } else {
            this.feedBtn.setFillStyle(0x2a6b3a, 0.58);    // ready
            this.feedIcon.setAlpha(0.92);
        }
    }

    feedFire() {
        if (this.gameIsOver || this.menuOpen) return;
        if (this.time.now < (this.feedCd || 0)) return;   // small cooldown — no spamming
        if (this.wood < FEED_COST) { this.sfx.deny(); this.floatText(FIRE.x, FIRE.y - 40, 'Mangler ved!', '#ff6b6b'); return; }
        if (this.fuel >= this.fuelMax) { this.floatText(FIRE.x, FIRE.y - 40, 'Bålet er fullt', '#cfe3d4'); return; }
        this.feedCd = this.time.now + FEED_CD;
        this.wood -= FEED_COST;
        this.stats.woodSpent += FEED_COST;
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
            { key: 'regen', icon: '💚', name: 'Helbredende ild', desc: 'Heal nå + 15 liv hvert daggry', apply: () => { this.dawnHeal += 15; this.hp = Math.min(this.maxHp, this.hp + 30); } },
            { key: 'crit', icon: '🎯', name: 'Kritisk treff', desc: '+10% kritisk sjanse', apply: () => { this.critChance = Math.min(1, this.critChance + 0.10); } },
            { key: 'critdmg', icon: '💥', name: 'Dødelig hugg', desc: '+50% kritisk skade', apply: () => { this.critMult += 0.5; } },
            { key: 'knock', icon: '🥊', name: 'Kraftig slag', desc: '+12 tilbakeslag på fiender', apply: () => { this.knockback += 12; } },
            { key: 'armor', icon: '🪖', name: 'Rustning', desc: '+4 rustning (mindre skade per treff)', apply: () => { this.armor += 4; } }
        ];
    }

    openPause() {
        if (this.menuOpen || this.gameIsOver) return;
        this.menuOpen = true;
        this.swingHeld = false;
        this.pauseC = this.add.container(0, 0).setDepth(4500);
        this.buildPauseMenu();
    }

    // rebuild the pause overlay contents (fresh background each time)
    pausePanel(build) {
        this.pauseC.removeAll(true);
        this.pauseC.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.85).setOrigin(0).setInteractive());
        build();
    }

    pauseButton(dy, label, color, fn) {
        const r = this.add.rectangle(W / 2, H / 2 + dy, 250, 54, color)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        const t = this.add.text(W / 2, H / 2 + dy, label, {
            fontSize: '19px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        r.on('pointerover', () => r.setScale(1.03));
        r.on('pointerout', () => r.setScale(1));
        r.on('pointerup', fn);
        this.pauseC.add(r); this.pauseC.add(t);
    }

    buildPauseMenu() {
        this.pausePanel(() => {
            this.pauseC.add(this.add.text(W / 2, H / 2 - 140, 'PAUSE', {
                fontSize: '36px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
            }).setOrigin(0.5));
            this.pauseButton(-72, '▶  FORTSETT', 0xc1440e, () => this.closePause());
            this.pauseButton(0, '↻  START PÅ NYTT', 0x2a6b3a,
                () => this.confirmPause('Starte runden på nytt?\nFremgangen i denne runden går tapt.', () => this.scene.restart()));
            this.pauseButton(72, '🏠  HOVEDMENY', 0x3a4049,
                () => this.confirmPause('Gå til hovedmenyen?\nDenne runden går tapt (rekorder lagres bare ved tap).', () => this.scene.start('MenuScene')));
        });
    }

    confirmPause(message, onYes) {
        this.pausePanel(() => {
            this.pauseC.add(this.add.text(W / 2, H / 2 - 110, '⚠ ER DU SIKKER?', {
                fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ff8c42'
            }).setOrigin(0.5));
            this.pauseC.add(this.add.text(W / 2, H / 2 - 60, message, {
                fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4', align: 'center', lineSpacing: 6,
                wordWrap: { width: W - 60 }
            }).setOrigin(0.5));
            this.pauseButton(20, 'JA', 0x7a2a22, onYes);
            this.pauseButton(86, 'AVBRYT', 0x3a4049, () => this.buildPauseMenu());
        });
    }

    closePause() {
        if (this.pauseC) { this.pauseC.destroy(); this.pauseC = null; }
        this.menuOpen = false;
    }

    offerUpgrades(headline) {
        this.menuOpen = true;
        this.swingHeld = false;   // stop auto-swinging while choosing
        // pick 3 distinct random upgrades
        const pool = Phaser.Utils.Array.Shuffle(this.upgradePool().slice());
        const picks = pool.slice(0, 3);

        const c = this.add.container(0, 0).setDepth(4000);
        c.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.82).setOrigin(0).setInteractive());

        const title = this.add.text(W / 2, 110, headline, {
            fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold',
            color: '#ffd166', align: 'center'
        }).setOrigin(0.5).setScale(0.7).setAlpha(0);
        c.add(title);
        this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 320, ease: 'Back.out' });

        const hint = this.add.text(W / 2, 150, 'Velg én forsterkning', {
            fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0.5).setAlpha(0);
        c.add(hint);

        const select = (it) => {
            it.apply();
            this.upgLevels[it.key] = (this.upgLevels[it.key] || 0) + 1;
            this.sfx.upgrade();
            this.refreshPowerVisuals(it.key);
            this.floatText(this.player.x, this.player.y - 30, it.name, '#ffd166');
            c.destroy();
            this.menuOpen = false;
            this.updateHUD();
        };

        picks.forEach((it, i) => {
            const y = 235 + i * 125;
            // each card is its own container so it can animate as a unit
            const cardC = this.add.container(W / 2, y).setScale(0.5).setAlpha(0);
            const rect = this.add.rectangle(0, 0, 320, 108, 0x1d2e18).setStrokeStyle(3, 0x4a6b3a);
            cardC.add(rect);
            cardC.add(this.add.text(0, -28, it.icon, { fontSize: '38px' }).setOrigin(0.5));
            cardC.add(this.add.text(0, 14, it.name, {
                fontSize: '19px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0.5));
            cardC.add(this.add.text(0, 38, it.desc, {
                fontSize: '13px', fontFamily: 'Arial', color: '#bcd0c0'
            }).setOrigin(0.5));
            c.add(cardC);

            // staggered pop-in; card becomes tappable only once it lands —
            // this doubles as the "anti-misclick" delay
            this.tweens.add({
                targets: cardC, scale: 1, alpha: 1, duration: 360, delay: 340 + i * 240, ease: 'Back.out',
                onComplete: () => {
                    if (!cardC.active) return;
                    if (i === picks.length - 1) this.tweens.add({ targets: hint, alpha: 1, duration: 200 });
                    rect.setInteractive({ useHandCursor: true });
                    rect.on('pointerover', () => rect.setStrokeStyle(3, 0xffd166));
                    rect.on('pointerout', () => rect.setStrokeStyle(3, 0x4a6b3a));
                    rect.on('pointerdown', () => this.tweens.add({ targets: cardC, scale: 0.94, duration: 80, yoyo: true }));
                    rect.on('pointerup', () => select(it));
                }
            });
        });

        this.upgradeContainer = c;
    }

    // ---------------------------------------------------------------- shop / building
    shopItems() {
        return [
            { key: 'gjerde', icon: '🚧', name: 'Gjerde', desc: 'Robust palisade som stopper fiender (fast pris)', base: 100, flat: true, max: 24 },
            { key: 'taarn', icon: '🗼', name: 'Vakttårn', desc: 'Skyter automatisk på fiender', base: 28, max: 16 },
            { key: 'iskanon', icon: '🧊', name: 'Iskanon', desc: 'Fryser fiender så de går saktere', base: 40, max: 12 },
            { key: 'bombekaster', icon: '💣', name: 'Bombekaster', desc: 'Splintskade på klynger av fiender', base: 52, max: 12 },
            { key: 'piggfelle', icon: '🪤', name: 'Piggfelle', desc: 'Skader alle fiender rundt seg', base: 18, max: 14 },
            { key: 'hus', icon: '🏠', name: 'Hytte', desc: 'Heler deg sakte (+3 liv/s)', base: 38, max: 4 },
            { key: 'sagbruk', icon: '🪚', name: 'Sagbruk', desc: '+1 ved per tre & raskere gjenvekst', base: 30, max: 4 }
        ];
    }

    shopCost(item) {
        if (item.flat) return item.base;     // fixed price — fair early and late
        return Math.round(item.base * Math.pow(1.4, this.buildCounts[item.key] || 0));
    }

    openShop() {
        if (this.menuOpen || this.gameIsOver) return;
        if (this.phase !== 'day') { this.floatText(this.player.x, this.player.y - 30, 'Bygg på dagtid', '#ff6b6b'); this.sfx.deny(); return; }
        this.menuOpen = true;
        this.swingHeld = false;
        this.shopArmed = false;          // ignore buys until the panel settles
        this.renderShop();
        // fade the panel in, then arm it — stops a lingering touch from buying
        this.shopContainer.setAlpha(0);
        this.tweens.add({ targets: this.shopContainer, alpha: 1, duration: 220 });
        this.time.delayedCall(420, () => { this.shopArmed = true; });
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

        // lay rows out dynamically so any number of items fits the screen
        const items = this.shopItems();
        const top = 128, bottomPad = 96;
        const spacing = Math.min(96, (H - bottomPad - top) / items.length);
        const rowH = Math.min(84, spacing - 8);

        items.forEach((it, i) => {
            const y = top + spacing * i + spacing / 2;
            const cost = this.shopCost(it);
            const max = it.max;
            const built = this.buildCounts[it.key];
            const full = built >= max;
            const afford = this.wood >= cost && !full;

            const row = this.add.rectangle(W / 2, y, 344, rowH, 0x1d2e18)
                .setStrokeStyle(2, afford ? 0x4a6b3a : 0x33402c)
                .setInteractive({ useHandCursor: true });
            c.add(row);
            c.add(this.add.text(40, y, it.icon, { fontSize: '30px' }).setOrigin(0.5));
            c.add(this.add.text(68, y - 14, `${it.name}  (${built}/${max})`, {
                fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0, 0.5));
            c.add(this.add.text(68, y + 9, it.desc, {
                fontSize: '11px', fontFamily: 'Arial', color: '#bcd0c0', wordWrap: { width: 240 }
            }).setOrigin(0, 0.5));
            c.add(this.add.text(W / 2 + 158, y, full ? 'FULLT' : `🪵 ${cost}`, {
                fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold',
                color: full ? '#888' : (afford ? '#ffd166' : '#ff6b6b')
            }).setOrigin(1, 0.5));
            row.on('pointerup', () => this.startPlacement(it));
        });

        const close = this.add.rectangle(W / 2, H - 52, 220, 52, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(close);
        c.add(this.add.text(W / 2, H - 52, 'FERDIG', {
            fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        close.on('pointerup', () => { c.destroy(); this.shopContainer = null; this.menuOpen = false; });
    }

    // ---- manual placement: drag a ghost around, see its range, tap to build ----
    startPlacement(item) {
        if (!this.shopArmed) return;     // panel still animating in
        if (this.buildCounts[item.key] >= item.max) { this.sfx.deny(); return; }
        if (this.wood < this.shopCost(item)) {
            this.sfx.deny(); this.floatText(W / 2, 130, 'For lite ved!', '#ff6b6b'); return;
        }
        // tear down the shop panel; keep the world paused via menuOpen
        if (this.shopContainer) { this.shopContainer.destroy(); this.shopContainer = null; }
        this.placing = item;

        const c = this.add.container(0, 0).setDepth(4200);
        this.placeC = c;
        // a transparent layer captures the drag/tap across the whole screen
        const layer = this.add.rectangle(0, 0, W, H, 0x000000, 0.01).setOrigin(0).setInteractive();
        c.add(layer);

        // faint dot grid so the snap-to-grid placement reads clearly
        const C = GameScene.CELL, ox = FIRE.x, oy = FIRE.y;
        const minIx = Math.ceil((26 - ox) / C), maxIx = Math.floor((W - 26 - ox) / C);
        const minIy = Math.ceil((PLAY_TOP + 26 - oy) / C), maxIy = Math.floor((PLAY_BOTTOM - 12 - oy) / C);
        const grid = this.add.graphics();
        grid.fillStyle(0xffe08a, 0.16);
        for (let ix = minIx; ix <= maxIx; ix++)
            for (let iy = minIy; iy <= maxIy; iy++)
                grid.fillCircle(ox + ix * C, oy + iy * C, 1.6);
        c.add(grid);

        const tex = this.structTex(item.key);
        const spec = GameScene.SPEC[item.key];
        const start = this.suggestCell();    // pre-suggest a free, spread-out cell
        const ring = this.add.circle(start.x, start.y, spec ? spec.range : 24, 0xffd166, 0.10)
            .setStrokeStyle(2, 0xffe08a, 0.7);
        if (!spec) ring.setVisible(false);
        // a cell highlight makes the targeted grid square obvious
        const cell = this.add.rectangle(start.x, start.y, C - 2, C - 2, 0xffe08a, 0.12)
            .setStrokeStyle(2, 0xffe08a, 0.8);
        const ghost = this.add.image(start.x, start.y, tex).setAlpha(0.65);
        c.add(ring); c.add(cell); c.add(ghost);

        c.add(this.add.text(W / 2, PLAY_TOP + 14, 'Trykk en rute, så «Bygg her»', {
            fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166',
            backgroundColor: '#0008', padding: { x: 8, y: 4 }
        }).setOrigin(0.5));

        // two-step: tap a cell to pick it (finger lifts → you can see it), then confirm
        const buildBtn = this.add.rectangle(W / 2, H - 106, 240, 52, 0x2a6b3a)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        const buildTxt = this.add.text(W / 2, H - 106, '✓ BYGG HER', {
            fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        const doneBtn = this.add.rectangle(W / 2, H - 50, 240, 48, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        const doneTxt = this.add.text(W / 2, H - 50, 'FERDIG', {
            fontSize: '19px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        c.add(buildBtn); c.add(buildTxt); c.add(doneBtn); c.add(doneTxt);
        doneBtn.on('pointerup', () => this.endPlacement());

        let sel = { x: start.x, y: start.y, ok: false };
        const move = (p) => {
            const q = this.snapToGrid(p.x, p.y);
            const ok = this.placeValid(q.x, q.y);
            sel = { x: q.x, y: q.y, ok };
            ghost.setPosition(q.x, q.y).setTint(ok ? 0xffffff : 0xff5555);
            ring.setPosition(q.x, q.y).setStrokeStyle(2, ok ? 0xffe08a : 0xff5555, 0.7);
            cell.setPosition(q.x, q.y).setStrokeStyle(2, ok ? 0xffe08a : 0xff5555, 0.8);
            buildBtn.setFillStyle(ok ? 0x2a6b3a : 0x444a4f);
        };
        // tap/drag anywhere just MOVES the selection — never builds (finger occludes)
        layer.on('pointermove', move);
        layer.on('pointerdown', move);
        layer.on('pointerup', move);

        buildBtn.on('pointerup', () => {
            if (!sel.ok) { this.sfx.deny(); this.floatText(sel.x, sel.y - 20, 'Ugyldig rute', '#ff6b6b'); return; }
            this.tryPlace(sel.x, sel.y);
            if (this.placing) move(this.suggestCell());   // jump to the next free spread-out cell
        });
        move({ x: start.x, y: start.y });
    }

    tryPlace(x, y) {
        const item = this.placing;
        if (!item) return;
        const cost = this.shopCost(item);
        if (this.buildCounts[item.key] >= item.max) { this.sfx.deny(); this.endPlacement(); return; }
        if (this.wood < cost) { this.sfx.deny(); this.floatText(x, y - 20, 'For lite ved!', '#ff6b6b'); return; }
        if (!this.placeValid(x, y)) { this.sfx.deny(); this.floatText(x, y - 20, 'Blokkert!', '#ff6b6b'); return; }

        this.wood -= cost;
        this.stats.woodSpent += cost;
        this.buildCounts[item.key]++;
        this.spawnStructure(item.key, x, y);
        this.sfx.build();
        if (item.key === 'hus') this.houseRegen = this.buildCounts.hus * 3;
        this.updateHUD();

        // keep placing more of the same until out of wood / at the cap
        if (this.buildCounts[item.key] >= item.max || this.wood < this.shopCost(item)) this.endPlacement();
    }

    endPlacement() {
        this.placing = null;
        if (this.placeC) { this.placeC.destroy(); this.placeC = null; }
        this.menuOpen = false;          // hand control back to the player
    }

    structTex(type) {
        return {
            gjerde: 'fence', taarn: 'tower', hus: 'house', sagbruk: 'sawmill',
            iskanon: 'icecannon', bombekaster: 'mortar', piggfelle: 'spiketrap'
        }[type];
    }

    spawnStructure(type, x, y) {
        const p = this.clampBuild(x, y);
        const s = this.add.image(p.x, p.y, this.structTex(type)).setDepth(p.y);
        s.type = type; s.dead = false; s.cd = 0; s.lvl = 1;
        s.buildBase = this.shopItems().find(it => it.key === type).base;
        if (type === 'gjerde') { s.maxHp = 300; s.hp = 300; }   // sturdy palisade
        s.shadow = this.addShadow(p.x, p.y + 14, 32, 0.45, p.y - 1);
        s.setScale(0.2);
        this.tweens.add({ targets: s, scale: 1, duration: 300, ease: 'Back.out' });
        // fences, ranged buildings & traps can be upgraded by tapping them by day
        if (GameScene.SPEC[type] || type === 'gjerde') {
            s.setInteractive({ useHandCursor: true });
            s.on('pointerup', () => this.openUpgrade(s));
        }
        this.structures.push(s);
        return s;
    }

    // ---- tower upgrades: another place to sink wood ----
    structStats(s) {
        const base = GameScene.SPEC[s.type];
        const l = (s.lvl || 1) - 1;
        return {
            ...base,
            dmg: Math.round(base.dmg * (1 + 0.6 * l)),
            range: Math.round(base.range * (1 + 0.08 * l)),
            cd: Math.round(base.cd * Math.pow(0.92, l)),
            splash: base.splash ? Math.round(base.splash * (1 + 0.1 * l)) : base.splash
        };
    }

    upgradeCost(s) {
        return Math.round(s.buildBase * 0.7 * (s.lvl || 1));
    }

    // a fence's max HP grows with its level
    fenceHp(lvl) {
        return Math.round(300 * (1 + 0.7 * (lvl - 1)));
    }

    openUpgrade(s) {
        if (this.menuOpen || this.placing || this.phase !== 'day' || s.dead) return;
        const MAX_LVL = 5;
        const isFence = s.type === 'gjerde';
        this.menuOpen = true;
        this.swingHeld = false;
        const c = this.add.container(0, 0).setDepth(4300);
        c.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.7).setOrigin(0).setInteractive());

        const lvl = s.lvl || 1;
        const maxed = lvl >= MAX_LVL;
        const cost = this.upgradeCost(s);

        const name = { gjerde: 'Gjerde', taarn: 'Vakttårn', iskanon: 'Iskanon', bombekaster: 'Bombekaster', piggfelle: 'Piggfelle' }[s.type];
        c.add(this.add.text(W / 2, H / 2 - 120, `${name} · nivå ${lvl}`, {
            fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));

        let statLine;
        if (isFence) {
            statLine = maxed
                ? `Maks HP ${s.maxHp} (nå ${Math.ceil(Math.max(0, s.hp))})`
                : `Maks HP ${s.maxHp} → ${this.fenceHp(lvl + 1)}\nRepareres helt ved oppgradering`;
        } else {
            const cur = this.structStats(s);
            const next = maxed ? cur : this.structStats({ type: s.type, lvl: lvl + 1 });
            statLine = maxed
                ? `Skade ${cur.dmg} · rekkevidde ${cur.range}`
                : `Skade ${cur.dmg} → ${next.dmg}\nRekkevidde ${cur.range} → ${next.range}\nFyringsrate ${cur.cd} → ${next.cd} ms`;
        }
        c.add(this.add.text(W / 2, H / 2 - 46, statLine, {
            fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4', align: 'center', lineSpacing: 6
        }).setOrigin(0.5));

        const upBtn = this.add.rectangle(W / 2, H / 2 + 40, 260, 56, maxed ? 0x3a4049 : 0x2a6b3a)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(upBtn);
        c.add(this.add.text(W / 2, H / 2 + 40, maxed ? 'MAKS NIVÅ' : `OPPGRADER · 🪵 ${cost}`, {
            fontSize: '19px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));

        const closeUp = () => { c.destroy(); this.menuOpen = false; };
        upBtn.on('pointerup', () => {
            if (maxed) return;
            if (this.wood < cost) { this.sfx.deny(); this.floatText(W / 2, H / 2 + 80, 'For lite ved!', '#ff6b6b'); return; }
            this.wood -= cost; this.stats.woodSpent += cost; s.lvl++;
            if (isFence) { s.maxHp = this.fenceHp(s.lvl); s.hp = s.maxHp; s.setAlpha(1); }   // forsterk + reparer
            this.sfx.upgrade();
            this.burst(s.x, s.y, 'ember', 10);
            this.tweens.add({ targets: s, scale: 1.25, duration: 120, yoyo: true });
            this.updateHUD();
            closeUp();
        });

        const cancel = this.add.rectangle(W / 2, H / 2 + 110, 260, 46, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(cancel);
        c.add(this.add.text(W / 2, H / 2 + 110, 'LUKK', {
            fontSize: '17px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        cancel.on('pointerup', closeUp);
    }

    destroyStructure(s) {
        s.dead = true;
        if (s.type === 'gjerde') this.buildCounts.gjerde--;
        if (s.shadow) s.shadow.destroy();
        this.burst(s.x, s.y, 'chip', 8);
        this.tweens.add({ targets: s, alpha: 0, scaleY: 0, duration: 200, onComplete: () => s.destroy() });
        this.structures = this.structures.filter(x => x !== s);
    }

    static CELL = 34;   // build-grid cell size

    // stats per active building type
    static SPEC = {
        taarn:       { cd: 850,  range: 130, dmg: 12, tex: 'bolt' },
        iskanon:     { cd: 1100, range: 125, dmg: 5,  tex: 'icebolt', slow: 0.45, slowMs: 2500 },
        bombekaster: { cd: 1600, range: 165, dmg: 14, tex: 'shell', splash: 88, arc: true },
        piggfelle:   { cd: 700,  range: 40,  dmg: 8,  trap: true }
    };

    updateStructures(time) {
        this.structures.forEach(s => {
            if (s.dead) return;
            if (!GameScene.SPEC[s.type] || time < (s.cd || 0)) return;
            const spec = this.structStats(s);   // scaled by upgrade level

            if (spec.trap) {
                // damage everything standing on the trap
                let hit = false;
                this.enemies.forEach(e => {
                    if (!e.dead && Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y) < spec.range) {
                        this.hurtEnemy(e, spec.dmg); hit = true;
                    }
                });
                if (hit) { s.cd = time + spec.cd; this.burst(s.x, s.y, 'chip', 5); }
                return;
            }

            // ranged: target nearest living enemy in range
            let target = null, best = spec.range;
            this.enemies.forEach(e => {
                if (e.dead) return;
                const d = Phaser.Math.Distance.Between(s.x, s.y, e.x, e.y);
                if (d < best) { best = d; target = e; }
            });
            if (target) { s.cd = time + spec.cd; this.fireProjectile(s, target, spec); }
        });
    }

    // turret juice: lean toward the target, recoil, and flash the muzzle
    towerFireFx(src, enemy) {
        // face the target (sprites are drawn facing forward; flip for left)
        src.setFlipX(enemy.x < src.x);
        const a = Phaser.Math.Angle.Between(src.x, src.y, enemy.x, enemy.y);
        // a small lean toward the shot, then ease back
        const lean = Phaser.Math.Clamp((enemy.x - src.x) / 80, -1, 1) * 0.22;
        this.tweens.add({ targets: src, rotation: lean, duration: 60, yoyo: true, ease: 'Quad.out' });
        // recoil kick + muzzle flash at the barrel tip
        const mx = src.x + Math.cos(a) * 12, my = src.y - 10 + Math.sin(a) * 12;
        const flash = this.add.image(mx, my, 'glow').setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(1305).setScale(0.5).setAlpha(0.9);
        this.tweens.add({ targets: flash, scale: 0.15, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
    }

    fireProjectile(src, enemy, spec) {
        const p = this.add.image(src.x, src.y - 12, spec.tex).setDepth(1300);
        this.sfx.towerShoot();
        this.towerFireFx(src, enemy);
        this.tweens.add({
            targets: p, x: enemy.x, y: enemy.y, duration: spec.arc ? 340 : 180,
            scale: spec.arc ? 1.4 : 1,
            onComplete: () => {
                const ix = p.x, iy = p.y;
                p.destroy();
                if (spec.splash) {
                    // explosion: damage the whole cluster
                    this.burst(ix, iy, 'ember', 18);
                    this.cameras.main.shake(90, 0.005);
                    this.hitStop(60);
                    // expanding shockwave ring sized to the splash radius
                    const ring = this.add.circle(ix, iy, spec.splash, 0xffae42, 0.28)
                        .setDepth(1290).setScale(0.3);
                    this.tweens.add({
                        targets: ring, scale: 1, alpha: 0, duration: 280,
                        ease: 'Quad.out', onComplete: () => ring.destroy()
                    });
                    this.enemies.forEach(e => {
                        if (!e.dead && Phaser.Math.Distance.Between(ix, iy, e.x, e.y) < spec.splash) {
                            this.hurtEnemy(e, spec.dmg);
                        }
                    });
                } else if (enemy.active && !enemy.dead) {
                    this.hurtEnemy(enemy, spec.dmg);
                    if (spec.slow) {
                        enemy.slowUntil = this.time.now + spec.slowMs;
                        enemy.slowFactor = spec.slow;
                        enemy.setTint(0x9fe6ff);
                        this.burst(enemy.x, enemy.y, 'icebolt', 4);
                    }
                }
            }
        });
    }

    // damage from buildings (no knockback / flash, unlike the player's swing)
    hurtEnemy(e, dmg) {
        if (e.dead) return;
        e.hp -= dmg;
        this.dmgNumber(e.x, e.y - 14, dmg);
        if (e.hp <= 0) this.killEnemy(e);
    }

    // ---------------------------------------------------------------- phases
    startNight() {
        this.phase = 'night';
        const n = this.wave;
        const dur = 16 + (n - 1) * 4;
        this.phaseEnd = this.time.now + dur * 1000;
        this.phaseDuration = dur;
        this.sfx.nightStart();
        this.banner(`🌙  NATT ${n}\nOverlev til daggry!`, 0x8ea0ff);

        this.nightTotal = 4 + Math.round((n - 1) * 2.5);
        this.nightSpawned = 0;
        this.nightEnding = false;
        const interval = Math.max(480, 1500 - n * 110);
        this.spawnTimer = this.time.addEvent({
            delay: interval, loop: true, callback: () => {
                if (this.nightSpawned >= this.nightTotal || this.phase !== 'night') return;
                this.spawnEnemy(); this.nightSpawned++;
            }
        });
    }

    startDay() {
        this.phase = 'day';
        this.nightEnding = false;
        const survived = this.wave;       // the night just survived
        this.wave++;
        this.phaseEnd = this.time.now + DAY_SECONDS * 1000;
        this.phaseDuration = DAY_SECONDS;
        if (this.spawnTimer) { this.spawnTimer.remove(); this.spawnTimer = null; }
        // sweep remaining enemies at dawn
        this.enemies.forEach(e => {
            this.burst(e.x, e.y, 'ember', 6);
            this.tweens.add({ targets: e, alpha: 0, scale: 0, duration: 250, onComplete: () => e.destroy() });
        });
        this.enemies = [];
        this.score += 50 * survived;
        if (this.dawnHeal > 0) this.hp = Math.min(this.maxHp, this.hp + this.dawnHeal);
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

        // pick a type — a tougher variant unlocks at every 5th night, plus the
        // fragile flyer at 7, so the threat keeps escalating instead of plateauing
        const unlocked = ['shade'];
        if (n >= 5) unlocked.push('brute');
        if (n >= 7) unlocked.push('flyer');
        if (n >= 10) unlocked.push('revenant');
        if (n >= 15) unlocked.push('wraith');
        if (n >= 20) unlocked.push('titan');
        let type = 'shade';
        // chance to be a special type grows as the nights wear on
        const specialChance = Math.min(0.72, 0.4 + (n - 5) * 0.025);
        if (unlocked.length > 1 && Math.random() < specialChance) {
            // bias toward the newest (toughest) variants in the later nights
            const specials = unlocked.slice(1);
            const idx = Math.random() < 0.5
                ? specials.length - 1 - Math.floor(Math.random() * Math.min(2, specials.length))
                : Math.floor(Math.random() * specials.length);
            type = specials[idx];
        }

        // base stats ramp harder after night 8 so late game stays threatening
        const base = {
            hp: 10 + (n - 1) * 6 + Math.max(0, n - 8) * 6,
            speed: 28 + (n - 1) * 4,
            dmg: 4 + (n - 1) * 2 + Math.max(0, n - 8) * 1
        };
        const spec = {
            shade:    { tex: 'enemy',    hp: 1,    speed: 1,    dmg: 1,   scale: 1,    knock: 1 },
            brute:    { tex: 'brute',    hp: 2.6,  speed: 0.55, dmg: 1.7, scale: 1.4,  knock: 0.4 },
            flyer:    { tex: 'flyer',    hp: 0.55, speed: 1.5,  dmg: 0.9, scale: 0.95, flies: true, knock: 0.85 },
            revenant: { tex: 'revenant', hp: 3.6,  speed: 0.85, dmg: 2.1, scale: 1.3,  knock: 0.5 },
            wraith:   { tex: 'wraith',   hp: 1.2,  speed: 1.75, dmg: 1.5, scale: 1.05, knock: 0.9 },
            titan:    { tex: 'titan',    hp: 6.5,  speed: 0.5,  dmg: 2.8, scale: 1.7,  knock: 0.22 }
        }[type];

        const e = this.add.image(x, y, spec.tex).setDepth(y);
        e.etype = type;
        e.hp = e.maxHp = Math.round(base.hp * spec.hp);
        e.speed = base.speed * spec.speed;
        e.dmg = Math.round(base.dmg * spec.dmg);
        e.baseScale = spec.scale;
        e.knockResist = spec.knock;
        e.flies = !!spec.flies;
        e.flap = Math.random() * Math.PI * 2;
        e.hitCd = 0;
        e.dead = false;
        e.slowUntil = 0;
        e.slowFactor = 1;
        if (e.flies) e.setAlpha(0.92);
        e.setScale(0);
        this.tweens.add({ targets: e, scale: spec.scale, duration: 250 });
        this.enemies.push(e);
    }

    // ---------------------------------------------------------------- update
    update(time, delta) {
        if (this.gameIsOver) return;
        const dt = delta / 1000;
        this.updateFeedButton();   // recharge visual ticks even while paused

        // pause world while choosing an upgrade card
        if (this.menuOpen) {
            this.phaseEnd += delta;   // don't let the day clock run during the pick
            return;
        }

        // hit-stop: briefly freeze the sim on big impacts (tweens keep playing)
        if (time < (this.hitStopUntil || 0)) {
            this.phaseEnd += delta;   // don't burn the phase clock during the freeze
            return;
        }

        this.handleMovement(dt);
        // hold swing button (or space) to keep swinging automatically
        if (this.swingHeld || this.keys.SPACE.isDown) this.swing();
        this.updateEnemies(dt, time);
        this.updateStructures(time);

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

            // dawn comes early once the whole wave is cleared — no dead air at the
            // end of the night waiting for a timer with nothing left to fight
            if (!this.nightEnding && this.nightSpawned >= this.nightTotal && this.enemies.length === 0) {
                this.nightEnding = true;
                if (this.spawnTimer) { this.spawnTimer.remove(); this.spawnTimer = null; }
                this.banner('☀  NATTA ER KLARERT!', 0xffd166);
                this.time.delayedCall(900, () => { if (this.phase === 'night') this.startDay(); });
            }
        }

        // low-fuel warning: pulsing red vignette + alarm beep when the fire is dying
        const lowFuel = this.phase === 'night' && this.fuel / this.fuelMax < 0.22;
        if (lowFuel) {
            const danger = 1 - (this.fuel / this.fuelMax) / 0.22;          // 0→1 as it empties
            const pulse = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(time / 130)) * danger;
            this.lowFuelVignette.setAlpha(Phaser.Math.Linear(this.lowFuelVignette.alpha, pulse, 0.2));
            const beat = 700 - 450 * danger;                              // beeps quicken as it worsens
            if (time > this.lowFuelCd) { this.lowFuelCd = time + beat; this.sfx.lowFuel(); }
        } else {
            this.lowFuelVignette.setAlpha(Phaser.Math.Linear(this.lowFuelVignette.alpha, 0, 0.15));
        }

        // phase timer
        const remain = Math.max(0, Math.ceil((this.phaseEnd - time) / 1000));
        if (time >= this.phaseEnd && !this.nightEnding) {
            if (this.phase === 'day') this.startNight();
            else this.startDay();
        }

        // day/night time-remaining bar
        const tRatio = Phaser.Math.Clamp((this.phaseEnd - time) / (this.phaseDuration * 1000), 0, 1);
        this.timeBar.width = W * tRatio;
        this.timeBar.setFillStyle(this.phase === 'day' ? 0xffd166 : 0x6f8cff);

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
            const lunging = this.swingLunge && this.swingLunge.isPlaying();
            if (!lunging) this.player.setRotation(Math.sin(this.walkPhase) * 0.08);
            this.player.setDepth(this.player.y);

            // boots upgrade → kick up dust while moving
            const boots = this.upgLevels.boots || 0;
            if (boots > 0 && this.time.now > this.dustCd) {
                this.dustCd = this.time.now + Math.max(70, 180 - boots * 25);
                const d = this.add.image(this.player.x - this.facing * 8, this.player.y + 14, 'dust')
                    .setDepth(this.player.y - 1).setAlpha(0.6).setScale(0.6 + boots * 0.15);
                this.tweens.add({ targets: d, alpha: 0, scale: 0.2, y: d.y + 6, duration: 360, onComplete: () => d.destroy() });
            }
        } else if (!(this.swingLunge && this.swingLunge.isPlaying())) {
            this.player.setRotation(0);
        }

        // power aura + reach ring + shadow follow the player
        this.playerAura.setPosition(this.player.x, this.player.y).setDepth(this.player.depth - 1);
        this.reachRing.setPosition(this.player.x, this.player.y);
        this.playerShadow.setPosition(this.player.x, this.player.y + 18).setDepth(this.player.depth - 2);
    }

    updateEnemies(dt, time) {
        this.enemies.forEach(e => {
            if (e.dead) return;

            // ice-cannon slow → clearly icy light-blue while frozen
            let speed = e.speed;
            const frozen = e.slowUntil && time < e.slowUntil;
            if (frozen) { speed *= e.slowFactor; e.setTintFill(0xaee9ff); }
            else if (e.slowUntil) { e.slowUntil = 0; e.clearTint(); }

            // flying enemies flap their wings (frozen ones hold still)
            if (e.flies) {
                e.flap += dt * 12;
                const f = frozen ? 1 : 1 + Math.sin(e.flap) * 0.12;
                e.setScale(e.baseScale, e.baseScale * f);
            }

            const toFire = Phaser.Math.Distance.Between(e.x, e.y, FIRE.x, FIRE.y);
            const toPlayer = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);

            // a fence in the way must be smashed first — but flyers soar over it
            let fence = null, fd = 42;
            if (!e.flies) this.structures.forEach(s => {
                if (s.type !== 'gjerde' || s.dead) return;
                const d = Phaser.Math.Distance.Between(e.x, e.y, s.x, s.y);
                if (d < fd) { fd = d; fence = s; }
            });

            if (fence) {
                if (time > e.hitCd) {
                    e.hitCd = time + 600;
                    fence.hp -= e.dmg;
                    fence.setTintFill(0xff8888);
                    const f = fence;   // capture for the delayed restore
                    this.time.delayedCall(80, () => {
                        if (f.active) { f.clearTint(); f.setAlpha(0.45 + 0.55 * Math.max(0, f.hp) / f.maxHp); }
                    });
                    this.sfx.hitEnemy();
                    if (fence.hp <= 0) this.destroyStructure(fence);
                }
            } else if (toFire > 38) {
                // move toward fire, or the player if they're in the way
                let tx = FIRE.x, ty = FIRE.y;
                if (toPlayer < 60) { tx = this.player.x; ty = this.player.y; }
                const a = Phaser.Math.Angle.Between(e.x, e.y, tx, ty);
                e.x += Math.cos(a) * speed * dt;
                e.y += Math.sin(a) * speed * dt;
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
        const dmg = Math.max(1, amount - this.armor);   // armor softens each hit (never to 0)
        this.hp = Math.max(0, this.hp - dmg);
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

    // roll the player's axe damage, applying a chance for a critical hit
    rollDamage(base) {
        if (Math.random() < this.critChance) return { dmg: Math.round(base * this.critMult), crit: true };
        return { dmg: base, crit: false };
    }

    // punchy damage number that pops in over an enemy — crits are bigger & gold
    dmgNumber(x, y, amount, crit = false) {
        const t = this.add.text(x + Phaser.Math.Between(-7, 7), y - 6, `${Math.round(amount)}${crit ? '!' : ''}`, {
            fontSize: crit ? '26px' : '18px', fontFamily: 'Arial', fontStyle: 'bold',
            color: crit ? '#ffd83a' : '#ffffff', stroke: crit ? '#a35200' : '#7a1212',
            strokeThickness: crit ? 5 : 4
        }).setOrigin(0.5).setDepth(1600).setScale(0.5);
        this.tweens.add({ targets: t, scale: crit ? 1.3 : 1, duration: 110, ease: 'Back.out' });
        this.tweens.add({ targets: t, y: t.y - (crit ? 40 : 30), alpha: 0, duration: crit ? 760 : 620, delay: 110, onComplete: () => t.destroy() });
    }

    // brief freeze-frame for impact — pauses the sim while juice tweens play on
    hitStop(ms) {
        this.hitStopUntil = Math.max(this.hitStopUntil || 0, this.time.now + ms);
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
        this.gameOverReason = reason;
        if (this.spawnTimer) this.spawnTimer.remove();

        const hi = Number(localStorage.getItem('emberwood_highscore') || 0);
        if (this.score > hi) localStorage.setItem('emberwood_highscore', String(this.score));
        this.finalBest = Math.max(hi, this.score);

        // update character; award a permanent perk for EACH milestone night
        // reached THIS run (5, 10, 15, …) — so every run that gets far rewards you
        const p = this.char;
        p.runs += 1;
        p.bestNight = Math.max(p.bestNight, this.wave);
        this.toClaim = milestonesUnlocked(this.wave);   // floor(night / 5)
        saveRoster(this.roster);

        // play a clear death animation + sound BEFORE any reward screen
        this.deathSequence();
    }

    deathSequence() {
        this.sfx.gameOver();
        this.sfx.hurt();
        this.cameras.main.shake(450, 0.014);
        this.cameras.main.flash(320, 140, 20, 20);

        // the lumberjack falls
        this.tweens.add({
            targets: this.player, angle: this.facing * 90, alpha: 0.15,
            scaleX: this.player.scaleX * 0.7, scaleY: this.player.scaleY * 0.7,
            y: this.player.y + 12, duration: 700, ease: 'Cubic.in'
        });
        this.burst(this.player.x, this.player.y, 'ember', 10);

        const c = this.add.container(0, 0).setDepth(4900);
        c.add(this.add.rectangle(0, 0, W, H, 0x12060a, 0).setOrigin(0));
        this.tweens.add({ targets: c.list[0], alpha: 0.78, duration: 600 });

        const big = this.add.text(W / 2, H / 2 - 30, 'GAME OVER', {
            fontSize: '54px', fontFamily: 'Arial', fontStyle: 'bold',
            color: '#ff4040', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setScale(2.4).setAlpha(0);
        c.add(big);
        this.tweens.add({ targets: big, scale: 1, alpha: 1, duration: 480, ease: 'Back.out' });
        this.tweens.add({ targets: big, angle: { from: -3, to: 3 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 480 });

        const sub = this.add.text(W / 2, H / 2 + 28, this.gameOverReason, {
            fontSize: '17px', fontFamily: 'Arial', color: '#ffb0b0'
        }).setOrigin(0.5).setAlpha(0);
        c.add(sub);
        this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 500 });

        // then move on to rewards / results
        this.time.delayedCall(3200, () => {
            c.destroy();
            if (this.toClaim > 0) this.claimMilestone(1, this.toClaim);
            else this.showGameOver(this.gameOverReason);
        });
    }

    claimMilestone(index, total) {
        const p = this.char;
        const milestoneNight = index * 5;
        const picks = Phaser.Utils.Array.Shuffle(PERKS.slice()).slice(0, 3);

        const c = this.add.container(0, 0).setDepth(5200);
        c.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.9).setOrigin(0).setInteractive());
        c.add(this.add.text(W / 2, 120, `🏆 MILEPÆL ${index}/${total}`, {
            fontSize: '28px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 158, `Du nådde natt ${milestoneNight}\nVelg en permanent forsterkning`, {
            fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4', align: 'center', lineSpacing: 6
        }).setOrigin(0.5));

        picks.forEach((perk, i) => {
            const y = 250 + i * 120;
            const card = this.add.rectangle(W / 2, y, 320, 104, 0x1d2e18)
                .setStrokeStyle(3, 0x4a6b3a).setInteractive({ useHandCursor: true });
            c.add(card);
            c.add(this.add.text(W / 2, y - 26, perk.icon, { fontSize: '36px' }).setOrigin(0.5));
            c.add(this.add.text(W / 2, y + 12, perk.name, {
                fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0.5));
            const lvl = p.perks[perk.key] || 0;
            c.add(this.add.text(W / 2, y + 36, `${perk.desc}  (nivå ${lvl} → ${lvl + 1})`, {
                fontSize: '12px', fontFamily: 'Arial', color: '#bcd0c0'
            }).setOrigin(0.5));
            card.on('pointerover', () => card.setStrokeStyle(3, 0xffd166));
            card.on('pointerout', () => card.setStrokeStyle(3, 0x4a6b3a));
            card.on('pointerup', () => {
                p.perks[perk.key] = (p.perks[perk.key] || 0) + 1;
                p.claimed += 1;
                saveRoster(this.roster);
                this.sfx.upgrade();
                c.destroy();
                if (index < total) this.claimMilestone(index + 1, total);
                else this.showGameOver(this.gameOverReason || 'Spillet er slutt');
            });
        });
    }

    showGameOver(reason) {
        const p = this.char;
        const c = this.add.container(0, 0).setDepth(5000);
        c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.8).setOrigin(0).setInteractive());
        c.add(this.add.text(W / 2, 170, 'SLUTT', {
            fontSize: '48px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ff5050'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 218, reason, {
            fontSize: '16px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0.5));
        c.add(this.add.text(W / 2, 286,
            `Du nådde natt ${this.wave}\nPoeng: ${this.score}\nBeste: ${this.finalBest}`, {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', align: 'center', lineSpacing: 8
        }).setOrigin(0.5));
        const s = this.stats;
        c.add(this.add.text(W / 2, 348,
            `🌲 ${s.treesChopped} trær hugget   ⚔ ${s.enemiesKilled} fiender felt\n🪵 ${s.woodSpent} ved brukt`, {
            fontSize: '14px', fontFamily: 'Arial', color: '#ffd9a0', align: 'center', lineSpacing: 6
        }).setOrigin(0.5));
        const nextAt = (milestonesUnlocked(this.wave) + 1) * 5;
        c.add(this.add.text(W / 2, 392,
            `👤 ${p.name} · ${p.runs} runder · ${perkCount(p)} boosts\nNeste belønning: nå natt ${nextAt}`, {
            fontSize: '13px', fontFamily: 'Arial', color: '#9fd0ff', align: 'center', lineSpacing: 5
        }).setOrigin(0.5));

        const restart = this.add.rectangle(W / 2, 460, 220, 60, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(restart);
        c.add(this.add.text(W / 2, 460, 'SPILL IGJEN', {
            fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        restart.on('pointerup', () => this.scene.restart());

        const menu = this.add.rectangle(W / 2, 532, 220, 50, 0x2a6b3a)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        c.add(menu);
        c.add(this.add.text(W / 2, 532, 'MENY', {
            fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        menu.on('pointerup', () => this.scene.start('MenuScene'));
    }
}
