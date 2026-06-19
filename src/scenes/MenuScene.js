import Phaser from 'phaser';

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
        const glow = this.add.circle(W / 2, 250, 90, 0xff8c32, 0.18);
        this.tweens.add({ targets: glow, scale: 1.15, alpha: 0.28, duration: 1200, yoyo: true, repeat: -1 });
        this.add.circle(W / 2, 250, 14, 0xffd166);
        this.add.text(W / 2, 250, '🔥', { fontSize: '34px' }).setOrigin(0.5);

        this.add.text(W / 2, 110, 'EMBERWOOD', {
            fontSize: '44px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
            color: '#ffd166'
        }).setOrigin(0.5);

        this.add.text(W / 2, 150, 'Hold bålet brennende til daggry', {
            fontSize: '15px', fontFamily: 'Arial', color: '#cfe3d4'
        }).setOrigin(0.5);

        // How to play
        const lines = [
            '☀  DAG — hugg trær for ved',
            '🌙  NATT — fiender kommer for bålet',
            '🪵  Ved er brensel, valuta OG byggemateriale',
            '🔥  Mat bålet — slukner det, dør du',
            '🪓  Sving øksa for å hugge & slåss',
            '🛒  Bygg gjerder, tårn, hus & sagbruk'
        ];
        const info = this.add.text(W / 2, 308, lines.join('\n'), {
            fontSize: '14px', fontFamily: 'Arial', color: '#e8efe9',
            align: 'left', lineSpacing: 8
        }).setOrigin(0.5, 0);

        // High score — placed safely below the instruction block
        let y = info.y + info.height + 24;
        const hi = Number(localStorage.getItem('emberwood_highscore') || 0);
        if (hi > 0) {
            this.add.text(W / 2, y, `Beste: ${hi} poeng`, {
                fontSize: '14px', fontFamily: 'Arial', color: '#ffd166'
            }).setOrigin(0.5);
            y += 34;
        }

        this.makeButton(W / 2, Math.max(y + 18, 560), 'START', 0xc1440e, () => {
            this.scene.start('GameScene');
        });

        this.add.text(W / 2, H - 28, 'WASD: gå  •  Mellomrom: sving  •  F: mat bål  •  B: bygg', {
            fontSize: '11px', fontFamily: 'Arial', color: '#8aa090'
        }).setOrigin(0.5);
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
