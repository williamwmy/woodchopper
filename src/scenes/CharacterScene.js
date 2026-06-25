import Phaser from 'phaser';
import {
    loadRoster, saveRoster, getActive, addCharacter, deleteCharacter,
    GENDERS, SKINS, HAIRS, SHIRTS, PERKS, attributes, perkCount, nextMilestone,
    generateAvatarTexture, genderLabel, AVATAR_ORIGIN_Y
} from '../utils/Characters.js';
import { t } from '../utils/i18n.js';

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
        const img = this.add.image(x, y, key).setOrigin(0.5, AVATAR_ORIGIN_Y).setScale(scale);
        this.layer.add(img);
        return img;
    }

    // ---------------------------------------------------------------- roster
    showRoster() {
        this.reset();
        this.title(t('char.title'));

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
                t('char.rosterLine', { gender: genderLabel(ch.gender), night: ch.bestNight, boosts: perkCount(ch) }), {
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
        this.button(W / 2, by, 300, 50, t('char.newBtn'), 0x2a6b3a, () => this.showCreate());
        this.button(W / 2 - 78, by + 60, 140, 52, t('char.playBtn'), 0xc1440e, () => this.scene.start('GameScene'));
        this.button(W / 2 + 78, by + 60, 140, 52, t('over.menu'), 0x3a4049, () => this.scene.start('MenuScene'));
    }

    // ---------------------------------------------------------------- sheet
    showSheet(ch) {
        this.reset();
        this.title(t('char.sheetTitle'));

        // hidden test menu: tap the avatar 5 times
        const av = this.avatar(W / 2, 130, ch, 3.4);
        av.setInteractive({ useHandCursor: true });
        this._tapCount = 0;
        av.on('pointerup', () => {
            this._tapCount++;
            if (this._tapCount >= 5) { this._tapCount = 0; this.openDebugDialog(); }
        });
        this.layer.add(this.add.text(W / 2, 196, ch.name, {
            fontSize: '24px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        this.layer.add(this.add.text(W / 2, 222,
            t('char.sheetLine', { gender: genderLabel(ch.gender), runs: ch.runs, night: ch.bestNight }), {
            fontSize: '13px', fontFamily: 'Arial', color: '#9fd0ff'
        }).setOrigin(0.5));

        // attributes
        this.layer.add(this.add.text(W / 2, 256, t('char.attributes'), {
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
            t('char.milestoneHint'), {
            fontSize: '13px', fontFamily: 'Arial', color: '#bcd0c0'
        }).setOrigin(0.5));

        this.button(W / 2 - 78, H - 80, 148, 52, t('char.rename'), 0x2a6b3a, () => this.openRenameDialog(ch));
        this.button(W / 2 + 78, H - 80, 148, 52, t('char.back'), 0x3a4049, () => this.showRoster());
    }

    openRenameDialog(ch) {
        const lay = this.add.container(0, 0).setDepth(9000);
        lay.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.9).setOrigin(0).setInteractive());
        lay.add(this.add.text(W / 2, H / 2 - 80, t('char.renameTitle'), {
            fontSize: '22px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));
        const el = document.createElement('input');
        el.type = 'text'; el.maxLength = 14; el.value = ch.name;
        el.style.cssText = 'width:300px;height:46px;border-radius:10px;border:2px solid #4a6b3a;' +
            'background:#1d2e18;color:#fff;font:600 20px Arial;text-align:center;outline:none;';
        const dom = this.add.dom(W / 2, H / 2 - 20, el); lay.add(dom);
        setTimeout(() => { el.focus(); el.select(); }, 50);

        const save = this.add.rectangle(W / 2, H / 2 + 50, 240, 52, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        lay.add(save);
        lay.add(this.add.text(W / 2, H / 2 + 50, t('char.save'), {
            fontSize: '19px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        const doSave = () => {
            const name = el.value.trim().slice(0, 14);
            if (name) { ch.name = name; saveRoster(this.roster); }
            lay.destroy(); this.showSheet(ch);
        };
        save.on('pointerup', doSave);
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doSave(); });

        const cancel = this.add.rectangle(W / 2, H / 2 + 114, 240, 44, 0x3a4049)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        lay.add(cancel);
        lay.add(this.add.text(W / 2, H / 2 + 114, t('char.cancel'), {
            fontSize: '17px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        cancel.on('pointerup', () => lay.destroy());
    }

    // hidden test/debug dialog — jump to a night with chosen starting wood
    openDebugDialog() {
        const lay = this.add.container(0, 0).setDepth(9000);
        lay.add(this.add.rectangle(0, 0, W, H, 0x05080d, 0.9).setOrigin(0).setInteractive());
        lay.add(this.add.text(W / 2, 120, '🛠 TEST MODE', {
            fontSize: '26px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffd166'
        }).setOrigin(0.5));
        lay.add(this.add.text(W / 2, 156, 'Start at a chosen night with extra wood.\nFirst day is endless — build, then start the night.', {
            fontSize: '13px', fontFamily: 'Arial', color: '#cfe3d4', align: 'center', lineSpacing: 5
        }).setOrigin(0.5));

        const field = (labelTxt, y, value, min, max) => {
            lay.add(this.add.text(W / 2 - 130, y, labelTxt, {
                fontSize: '16px', fontFamily: 'Arial', fontStyle: 'bold', color: '#e8efe9'
            }).setOrigin(0, 0.5));
            const el = document.createElement('input');
            el.type = 'number'; el.min = min; el.max = max; el.value = value;
            el.style.cssText = 'width:120px;height:40px;border-radius:10px;border:2px solid #4a6b3a;' +
                'background:#1d2e18;color:#fff;font:600 18px Arial;text-align:center;outline:none;';
            const dom = this.add.dom(W / 2 + 80, y, el);
            lay.add(dom);
            return el;
        };
        const levelEl = field('Night:', 232, '49', 1, 50);
        const woodEl = field('Wood:', 292, '2000', 0, 99999);

        const start = this.add.rectangle(W / 2, 372, 240, 56, 0xc1440e)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        lay.add(start);
        lay.add(this.add.text(W / 2, 372, '▶ START TEST', {
            fontSize: '20px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        start.on('pointerup', () => {
            const lvl = Phaser.Math.Clamp(parseInt(levelEl.value, 10) || 1, 1, 50);
            const wood = Phaser.Math.Clamp(parseInt(woodEl.value, 10) || 0, 0, 99999);
            this.scene.start('GameScene', { startLevel: lvl, startWood: wood });
        });

        const cancel = this.add.rectangle(W / 2, 440, 240, 46, 0x3a4049)
            .setStrokeStyle(3, 0xffd166).setInteractive({ useHandCursor: true });
        lay.add(cancel);
        lay.add(this.add.text(W / 2, 440, t('char.cancel'), {
            fontSize: '17px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5));
        cancel.on('pointerup', () => lay.destroy());
    }

    // ---------------------------------------------------------------- create
    showCreate() {
        this.draft = { name: '', gender: 0, skin: 1, hair: 1, shirt: 0 };
        this.reset();
        this.title(t('char.newBtn').replace('➕ ',''));

        // roomy, fixed vertical rhythm (fits the shortest portrait canvas)
        const yPreview = 132;
        const yName = 236;
        const yGender = 308;
        const ySkin = 380;
        const yHair = 452;
        const yShirt = 524;

        // big live preview, framed
        this.layer.add(this.add.circle(W / 2, yPreview, 56, 0x1d2e18).setStrokeStyle(3, 0x4a6b3a));
        this.previewImg = this.add.image(W / 2, yPreview, 'preview').setOrigin(0.5, AVATAR_ORIGIN_Y).setScale(3.4);
        this.layer.add(this.previewImg);
        this.refreshPreview();

        // name — a real text input embedded in the GUI (scales with the game)
        const el = document.createElement('input');
        el.type = 'text';
        el.maxLength = 14;
        el.placeholder = t('char.namePlaceholder');
        el.value = this.draft.name || '';
        el.style.cssText = 'width:300px;height:44px;border-radius:10px;border:2px solid #4a6b3a;' +
            'background:#1d2e18;color:#fff;font:600 19px Arial;text-align:center;outline:none;';
        this.nameInput = this.add.dom(W / 2, yName, el);
        el.addEventListener('input', () => { this.draft.name = el.value.slice(0, 14); });

        // gender as two labelled buttons
        this.genderButtons(yGender);

        // colour pickers — big swatches across the full width
        this.swatchRow(t('char.fSkin'), SKINS, 'skin', ySkin);
        this.swatchRow(t('char.fHair'), HAIRS, 'hair', yHair);
        this.swatchRow(t('char.fShirt'), SHIRTS, 'shirt', yShirt);

        // actions
        this.button(W / 2 - 84, H - 56, 152, 56, t('char.createBtn'), 0x2a6b3a, () => {
            if (!this.draft.name) this.draft.name = t('char.defaultName');
            addCharacter(this.roster, this.draft);
            this.showRoster();
        }, '20px');
        this.button(W / 2 + 84, H - 56, 152, 56, t('char.cancel'), 0x3a4049, () => this.showRoster(), '20px');
    }

    genderButtons(y) {
        this.layer.add(this.add.text(W / 2, y - 30, t('char.fGender'), {
            fontSize: '13px', fontFamily: 'Arial', fontStyle: 'bold', color: '#8aa090'
        }).setOrigin(0.5));
        const rects = [];
        const restyle = () => rects.forEach((r, j) => {
            const on = this.draft.gender === j;
            r.setFillStyle(on ? 0x2a6b3a : 0x1d2e18);
            r.setStrokeStyle(on ? 4 : 2, on ? 0xffd166 : 0x4a6b3a);
        });
        GENDERS.forEach((label, i) => {
            label = genderLabel(i);
            const x = W / 2 + (i === 0 ? -86 : 86);
            const r = this.add.rectangle(x, y, 156, 46, 0x1d2e18)
                .setInteractive({ useHandCursor: true });
            const t = this.add.text(x, y, label, {
                fontSize: '18px', fontFamily: 'Arial', fontStyle: 'bold', color: '#ffffff'
            }).setOrigin(0.5);
            this.layer.add(r); this.layer.add(t);
            rects.push(r);
            r.on('pointerup', () => { this.draft.gender = i; restyle(); this.refreshPreview(); });
        });
        restyle();
    }

    swatchRow(label, palette, field, y) {
        this.layer.add(this.add.text(W / 2, y - 28, label, {
            fontSize: '13px', fontFamily: 'Arial', fontStyle: 'bold', color: '#8aa090'
        }).setOrigin(0.5));
        const size = 40;
        const cell = (W - 32) / palette.length;
        const rects = [];
        const highlight = () => rects.forEach((r, j) => {
            const on = this.draft[field] === j;
            r.setStrokeStyle(on ? 5 : 2, on ? 0xffffff : 0x10180f);
            r.setScale(on ? 1.12 : 1);
        });
        palette.forEach((col, i) => {
            const x = 16 + cell * i + cell / 2;
            const sw = this.add.rectangle(x, y, size, size, col)
                .setInteractive({ useHandCursor: true });
            this.layer.add(sw);
            rects.push(sw);
            // update selection in place — do NOT rebuild the screen (that reset the draft)
            sw.on('pointerup', () => { this.draft[field] = i; highlight(); this.refreshPreview(); });
        });
        highlight();
    }

    refreshPreview() {
        generateAvatarTexture(this, 'preview', this.draft);
        if (this.previewImg) this.previewImg.setTexture('preview');
    }
}
