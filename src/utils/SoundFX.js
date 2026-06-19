// Warm, soft synthesized sound effects via the Web Audio API.
// No audio files needed. Sine/triangle voices, gentle envelopes, a master
// low-pass and a short feedback delay give a cozy (non-chiptune) feel.
export class SoundFX {
    constructor() {
        this.ctx = null;
    }

    // Must be called from a user gesture (browser autoplay policy).
    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ctx = new AC();
            this.ctx = ctx;

            this.master = ctx.createGain();
            this.master.gain.value = 0.42;

            this.filter = ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = 5200;
            this.filter.Q.value = 0.4;

            this.master.connect(this.filter);
            this.filter.connect(ctx.destination);

            // short feedback delay → subtle "room"
            this.delay = ctx.createDelay(0.5);
            this.delay.delayTime.value = 0.15;
            this.fb = ctx.createGain();
            this.fb.gain.value = 0.25;
            this.wet = ctx.createGain();
            this.wet.gain.value = 0.18;
            this.delay.connect(this.fb);
            this.fb.connect(this.delay);
            this.delay.connect(this.wet);
            this.wet.connect(this.filter);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    // A single soft voice with smooth attack/decay.
    voice(freq, dur, o = {}) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const type = o.type || 'sine';
        const vol = o.vol ?? 0.4;
        const attack = o.attack ?? 0.015;

        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.slideTo), t + dur);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(g);
        g.connect(this.master);
        if (o.reverb) g.connect(this.delay);

        // gentle octave layer for warmth
        if (o.rich) {
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq * 0.5, t);
            if (o.slideTo) osc2.frequency.exponentialRampToValueAtTime(Math.max(30, o.slideTo * 0.5), t + dur);
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.0001, t);
            g2.gain.linearRampToValueAtTime(vol * 0.5, t + attack);
            g2.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc2.connect(g2); g2.connect(this.master);
            osc2.start(t); osc2.stop(t + dur + 0.05);
        }

        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    // Soft filtered noise (used for woody/natural textures).
    noise(dur, vol = 0.3, cutoff = 1000) {
        if (!this.ctx) return;
        const ctx = this.ctx, t = ctx.currentTime;
        const n = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter); filter.connect(g); g.connect(this.master);
        src.start(t);
    }

    arp(freqs, step = 0.08, o = {}) {
        if (!this.ctx) return;
        freqs.forEach((f, i) => {
            this.time(() => this.voice(f, step + 0.18, { type: o.type || 'triangle', vol: o.vol ?? 0.32, reverb: o.reverb }), i * step);
        });
    }

    // schedule a callback relative to now using oscillator timing (no Date)
    time(fn, delay) {
        if (!this.ctx) return;
        // use a zero-gain oscillator as a precise timer would be overkill;
        // setTimeout is fine here for short UI arps.
        setTimeout(fn, delay * 1000);
    }

    // ---- named game events ----
    swing()      { this.noise(0.09, 0.10, 2600); }
    chopHit()    { this.noise(0.06, 0.30, 1000); this.voice(150, 0.09, { type: 'sine', vol: 0.18 }); }
    treeFall()   { this.voice(200, 0.4, { type: 'sine', vol: 0.32, slideTo: 80, rich: true }); this.noise(0.32, 0.16, 520); }
    hitEnemy()   { this.voice(320, 0.09, { type: 'triangle', vol: 0.2, slideTo: 250 }); }
    enemyDie()   { this.voice(300, 0.24, { type: 'sine', vol: 0.28, slideTo: 120, reverb: true }); }
    feed()       { this.noise(0.3, 0.26, 720); this.voice(130, 0.28, { type: 'sine', vol: 0.22, slideTo: 280, attack: 0.05 }); }
    build()      { this.arp([523, 784], 0.09, { type: 'triangle', vol: 0.3, reverb: true }); }
    deny()       { this.voice(200, 0.18, { type: 'sine', vol: 0.28, slideTo: 130 }); }
    upgrade()    { this.arp([523, 659, 784, 1047], 0.08, { type: 'triangle', vol: 0.3, reverb: true }); }
    hurt()       { this.voice(140, 0.24, { type: 'sine', vol: 0.4, slideTo: 70, rich: true }); this.noise(0.1, 0.14, 700); }
    towerShoot() { this.voice(680, 0.07, { type: 'sine', vol: 0.12, slideTo: 1080 }); }
    nightStart() { this.voice(196, 0.8, { type: 'sine', vol: 0.34, slideTo: 147, attack: 0.15, reverb: true, rich: true }); }
    dayStart()   { this.arp([440, 554, 659], 0.1, { type: 'sine', vol: 0.34, reverb: true }); }
    gameOver()   { this.voice(330, 1.1, { type: 'sine', vol: 0.4, slideTo: 90, attack: 0.04, reverb: true, rich: true }); }
}
