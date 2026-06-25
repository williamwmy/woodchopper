import Phaser from 'phaser';
import { loadRoster, getActive, perkCount, generateAvatarTexture } from '../utils/Characters.js';
import { t, getLang, setLang } from '../utils/i18n.js';

let W = 400;
let H = 700;

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        W = this.scale.width;
        H = this.scale.height;

        // Night-forest gradient backdrop
        const g = this.add.graphics();
        g.fillGradientStyle(0x0b1430, 0x0b1430, 0x16331f, 0x16331f, 1);
        g.fillRect(0, 0, W, H);

        // Distant tree silhouettes
        for (let i = 0; i < Math.ceil(W / 45); i++) {
            const x = 20 + i * 45;
            const hgt = 60 + (i % 3) * 30;
            g.fillStyle(0x0a1f12, 1);
            g.fillTriangle(x, H - 90, x + 22, H - 90 - hgt, x + 44, H - 90);
        }
        g.fillStyle(0x0a1f12, 1);
        g.fillRect(0, H - 90, W, 90);

        // Campfire glow
        const glow = this.add.circle(W / 2, 196, 64, 0xff8c32, 0.18);
        this.tweens.add({ targets: glow, scale: 1.15, alpha: 0.28, duration: 1200, yoyo: true, repeat: -1 });
        this.add.circle(W / 2, 196, 12, 0xffd166);
        this.add.text(W / 2, 196, '🔥', { fontSize: '30px' }).setOrigin(0.5);

        this.add.text(W / 2, 92, 'EMBERWOOD', {
            fontSize: '42px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
            color: '#ffd166'
        }).setOrigin(0.5);

        this.add.text(W / 2, 130, t('menu.tagline'), {
            fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0.5);

        // How to play
        const lines = [
            t('menu.how.day'), t('menu.how.night'), t('menu.how.wood'),
            t('menu.how.feed'), t('menu.how.swing'), t('menu.how.build')
        ];
        const info = this.add.text(W / 2, 256, lines.join('\n'), {
            fontSize: '14px', fontFamily: 'Arial', color: '#e8efe9',
            align: 'left', lineSpacing: 8
        }).setOrigin(0.5, 0);

        // Active-character line + small avatar (full editor is in CharacterScene)
        const roster = loadRoster();
        const char = getActive(roster);
        generateAvatarTexture(this, 'menu_avatar', char);
        const cy = info.y + info.height + 22;
        this.add.image(W / 2 - 96, cy, 'menu_avatar').setScale(1.4);
        this.add.text(W / 2 - 72, cy, t('menu.playingAs', { name: char.name, night: char.bestNight }), {
            fontSize: '13px', fontFamily: 'Arial', color: '#ffd166'
        }).setOrigin(0, 0.5);

        // Characters button
        this.makeButton(W / 2, H - 170, t('menu.characters'), 0x2a6b3a, () => {
            this.scene.start('CharacterScene');
        });

        // START anchored above the bottom hint so it can never be clipped
        this.makeButton(W / 2, H - 98, t('menu.start'), 0xc1440e, () => {
            this.scene.start('GameScene');
        });

        this.add.text(W / 2, H - 30, t('menu.controls'), {
            fontSize: '11px', fontFamily: 'Arial', color: '#8aa090'
        }).setOrigin(0.5);

        // Language toggle (top-right) — English / Norsk, persisted
        this.makeLangToggle();
    }

    makeLangToggle() {
        const cur = getLang();
        const mk = (x, code, label) => {
            const on = cur === code;
            const r = this.add.rectangle(x, 26, 50, 26, on ? 0xc1440e : 0x223018, on ? 1 : 0.6)
                .setStrokeStyle(2, on ? 0xffd166 : 0x4a6b3a).setInteractive({ useHandCursor: true });
            this.add.text(x, 26, label, { fontSize: '13px', fontFamily: 'Arial', fontStyle: 'bold', color: on ? '#fff' : '#9fb08a' }).setOrigin(0.5);
            r.on('pointerup', () => { if (getLang() !== code) { setLang(code); this.scene.restart(); } });
        };
        this.add.text(W - 116, 12, t('menu.language'), { fontSize: '10px', fontFamily: 'Arial', color: '#8aa090' }).setOrigin(0, 0);
        mk(W - 86, 'en', 'EN');
        mk(W - 30, 'no', 'NO');
    }

    makeButton(x, y, label, color, onClick) {
        const w = 220, h = 64;
        const btn = this.add.rectangle(x, y, w, h, color).setStrokeStyle(3, 0xffd166);
        btn.setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, label, {
            fontSize: '26px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        btn.on('pointerover', () => btn.setScale(1.05));
        btn.on('pointerout', () => btn.setScale(1));
        btn.on('pointerdown', () => { btn.setScale(0.96); });
        btn.on('pointerup', onClick);
        return { btn, txt };
    }
}
