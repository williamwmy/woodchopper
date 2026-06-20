import Phaser from 'phaser';
import {
    loadRoster, saveRoster, getActive, addCharacter, deleteCharacter,
    GENDERS, SKINS, HAIRS, SHIRTS, PERKS, attributes, perkCount, nextMilestone,
    generateAvatarTexture
} from '../utils/Characters.js';

let W = 400;
let H = 700;

export default class CharacterScene extends Phaser.Scene {
    constructor() { super({ key: 'CharacterScene' }); }

    create() {
        W = this.scale.width;
        H = this.scale.height;
        this.roster = loadRoster();
        this.layer = null;
        this.showRoster();
    }

    bg() {
        const g = this.add.graphics();
        g.fillGradientStyle(0x0b1430, 0x0b1430, 0x16331f, 0x16331f, 1);
        g.fillRect(0, 0, W, H);
    }

    reset() {
        if (this.nameInput) { this.nameInput.destroy(); this.nameInput = null; }
        if (this.layer) this.layer.destroy();
        this.children.removeAll();
        this.bg();
        this.layer = this.add.container(0, 0);
        return this.layer;
    }

    title(text) {
        this.layer.add(this.add.text(W / 2, 46, text, {
            fontSize: '26px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));
    }

    button(x, y, w, h, label, color, onClick, fontSize = '18px') {
        const r = this.add.rectangle(x, y, w, h, color).setStrokeStyle(2, 0xffd166)
            .setInteractive({ useHandCursor: true });
        const t = this.add.text(x, y, label, {
            fontSize, fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        r.on('pointerover', () => r.setScale(1.04));
        r.on('pointerout', () => r.setScale(1));
        r.on('pointerup', onClick);
        this.layer.add(r); this.layer.add(t);
        return r;
    }

    avatar(x, y, ch, scale) {
        const key = 'av_' + ch.id;
        generateAvatarTexture(this, key, ch);
        const img = this.add.image(x, y, key).setScale(scale);
        this.layer.add(img);
        return img;
    }

    // ---------------------------------------------------------------- roster
    showRoster() {
        this.reset();
        this.title('KARAKTERER');

        const list = this.roster.characters;
        const rowH = 70;
        list.forEach((ch, i) => {
            const y = 100 + i * (rowH + 8);
            const active = ch.id === this.roster.activeId;
            const row = this.add.rectangle(W / 2, y, W - 36, rowH, active ? 0x2a4a2c : 0x1d2e18)
                .setStrokeStyle(active ? 3 : 2, active ? 0xffd166 : 0x4a6b3a)
                .setInteractive({ useHandCursor: true });
            this.layer.add(row);
            row.on('pointerup', () => { this.roster.activeId = ch.id; saveRoster(this.roster); this.showRoster(); });

            this.avatar(46, y, ch, 1.5);
            this.layer.add(this.add.text(78, y - 12, ch.name, {
                fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0, 0.5));
            this.layer.add(this.add.text(78, y + 12,
                `${GENDERS[ch.gender]} · beste natt ${ch.bestNight} · ${perkCount(ch)} boosts`, {
                fontSize: '12px', fontFamily: 'Arial', color: '#bcd0c0'
            }).setOrigin(0, 0.5));

            if (active) this.layer.add(this.add.text(W - 30, y - 16, '✓', {
                fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
            }).setOrigin(0.5));
            // sheet + delete
            this.button(W - 56, y + 14, 40, 26, '📋', 0x3a4049, () => this.showSheet(ch), '15px');
            if (list.length > 1) this.button(W - 24, y + 14, 28, 26, '✕', 0x7a2a22, () => {
                deleteCharacter(this.roster, ch.id); this.showRoster();
            }, '14px');
        });

        const by = H - 150;
        this.button(W / 2, by, 300, 50, '➕ NY KARAKTER', 0x2a6b3a, () => this.showCreate());
        this.button(W / 2 - 78, by + 60, 140, 52, '▶ SPILL', 0xc1440e, () => this.scene.start('GameScene'));
        this.button(W / 2 + 78, by + 60, 140, 52, 'MENY', 0x3a4049, () => this.scene.start('MenuScene'));
    }

    // ---------------------------------------------------------------- sheet
    showSheet(ch) {
        this.reset();
        this.title('KARAKTERARK');

        this.avatar(W / 2, 130, ch, 3.4);
        this.layer.add(this.add.text(W / 2, 196, ch.name, {
            fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        this.layer.add(this.add.text(W / 2, 222,
            `${GENDERS[ch.gender]} · ${ch.runs} runder · beste natt ${ch.bestNight}`, {
            fontSize: '13px', fontFamily: 'Arial', color: '#9fd0ff'
        }).setOrigin(0.5));

        // attributes
        this.layer.add(this.add.text(W / 2, 256, 'ATTRIBUTTER', {
            fontSize: '14px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));
        attributes(ch).forEach((a, i) => {
            const y = 282 + i * 26;
            this.layer.add(this.add.text(40, y, `${a.icon}  ${a.label}`, {
                fontSize: '15px', fontFamily: 'Arial', color: '#e8efe9'
            }).setOrigin(0, 0.5));
            this.layer.add(this.add.text(W - 40, y, `${a.value}`, {
                fontSize: '15px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(1, 0.5));
        });

        this.layer.add(this.add.text(W / 2, 452,
            `Neste milepæl: natt ${nextMilestone(ch.claimed)}`, {
            fontSize: '13px', fontFamily: 'Arial', color: '#bcd0c0'
        }).setOrigin(0.5));

        this.button(W / 2, H - 80, 220, 52, 'TILBAKE', 0x3a4049, () => this.showRoster());
    }

    // ---------------------------------------------------------------- create
    showCreate() {
        this.draft = { name: '', gender: 0, skin: 1, hair: 1, shirt: 0 };
        this.reset();
        this.title('NY KARAKTER');

        this.previewImg = this.add.image(W / 2, 116, 'preview').setScale(3.4);
        this.layer.add(this.previewImg);
        this.refreshPreview();

        let y = 176;
        // name — a real text input embedded in the GUI (scales with the game)
        const el = document.createElement('input');
        el.type = 'text';
        el.maxLength = 14;
        el.placeholder = 'Skriv navn…';
        el.value = this.draft.name || '';
        el.style.cssText = 'width:280px;height:34px;border-radius:8px;border:2px solid #4a6b3a;' +
            'background:#1d2e18;color:#fff;font:600 16px Arial;text-align:center;outline:none;';
        this.nameInput = this.add.dom(W / 2, y, el);
        el.addEventListener('input', () => { this.draft.name = el.value.slice(0, 14); });

        y += 44;
        this.genderText = this.add.text(W / 2, y, '', {
            fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);
        this.layer.add(this.genderText);
        this.button(W / 2 - 110, y, 40, 36, '◀', 0x3a4049, () => this.cycleGender(-1), '18px');
        this.button(W / 2 + 110, y, 40, 36, '▶', 0x3a4049, () => this.cycleGender(1), '18px');
        this.updateGenderText();

        y += 40;
        this.swatchRow('Hud', SKINS, 'skin', y);
        y += 44;
        this.swatchRow('Hår', HAIRS, 'hair', y);
        y += 44;
        this.swatchRow('Klær', SHIRTS, 'shirt', y);

        this.button(W / 2 - 78, H - 78, 140, 52, 'OPPRETT', 0x2a6b3a, () => {
            if (!this.draft.name) this.draft.name = 'Tømmerhugger';
            addCharacter(this.roster, this.draft);
            this.showRoster();
        });
        this.button(W / 2 + 78, H - 78, 140, 52, 'AVBRYT', 0x3a4049, () => this.showRoster());
    }

    swatchRow(label, palette, field, y) {
        this.layer.add(this.add.text(20, y, label, {
            fontSize: '13px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0, 0.5));
        const startX = 84, gap = (W - startX - 24) / palette.length;
        const rects = [];
        const highlight = () => rects.forEach((r, j) => {
            const on = this.draft[field] === j;
            r.setStrokeStyle(on ? 4 : 1, on ? 0xffffff : 0x000000);
        });
        palette.forEach((col, i) => {
            const x = startX + gap * i + gap / 2;
            const sw = this.add.rectangle(x, y, 26, 26, col)
                .setInteractive({ useHandCursor: true });
            this.layer.add(sw);
            rects.push(sw);
            // update selection in place — do NOT rebuild the screen (that reset the draft)
            sw.on('pointerup', () => { this.draft[field] = i; highlight(); this.refreshPreview(); });
        });
        highlight();
    }

    cycleGender(d) {
        this.draft.gender = (this.draft.gender + d + GENDERS.length) % GENDERS.length;
        this.updateGenderText();
        this.refreshPreview();
    }

    updateGenderText() {
        this.genderText.setText(GENDERS[this.draft.gender]);
    }

    refreshPreview() {
        generateAvatarTexture(this, 'preview', this.draft);
        if (this.previewImg) this.previewImg.setTexture('preview');
    }
}
