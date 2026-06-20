# 🔥 Emberwood

A cozy-but-tense **campfire survival** game for the browser and your phone.
Chop wood by day, hold back the dark by night — and never, ever let the fire die.

### ▶️ [Play it here](https://woodchopper.netlify.app/)

*(Add it to your home screen for a fullscreen, app-like experience.)*

> _Screenshot / GIF goes here — drop an image in `docs/` and link it:_
> `![Emberwood gameplay](docs/screenshot.png)`

## How to play

**Wood is everything** — it's your fuel, your money, and your building material.
Every log is a choice.

- ☀️ **Day** — chop trees for wood and build up your defenses.
- 🌙 **Night** — monsters stream toward your campfire. The fire steadily burns
  down: feed it wood or it goes out. Swing your axe to fight them off.
- 🌅 **Each dawn** — pick **1 of 3** random upgrades. Survive → the next night
  gets harder.
- 💀 You lose if the fire dies, you fall, or you stand *in* the fire too long.

Build a wall of fences, line up watchtowers and ice cannons, and see how many
nights you can last.

### Controls

| Action | Touch | Keyboard |
|--------|-------|----------|
| Move | Drag anywhere (virtual joystick) | WASD / Arrow keys |
| Swing axe (chop & fight) | Hold 🪓 button | Hold Space |
| Feed the fire | 🔥 button | F |
| Open build shop (day only) | 🛒 button | B |

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build    # outputs to dist/
npm run preview
```

## Tech

- [Phaser 3](https://phaser.io/) + [Vite](https://vitejs.dev/)
- **No asset files** — every sprite is generated at runtime and every sound is
  synthesized with the Web Audio API, so the whole game is self-contained.
- Installable **PWA** (offline support, add-to-home-screen).

Deployed on Netlify (build `npm run build`, publish `dist`).

---

Developer notes, architecture, and balance knobs live in
[`CLAUDE.md`](CLAUDE.md).
