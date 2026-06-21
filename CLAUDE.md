# Emberwood

A mobile-first browser game built with Phaser 3. Originally "Woodchopper" (a
top-down open-world chopping game that wasn't fun), redesigned into a focused
**campfire survival** arcade game.

Live: https://woodchopper.netlify.app/ · Repo: williamwmy/woodchopper

## Vision / what we're going for

A tight, juicy, one-screen survival loop you can play with thumbs on a phone.
Keep the *idea* of a woodchopper (chop wood → get stronger), but the fun is:

- **Wood is everything** — fuel for the fire, currency for building, and the
  resource you gather. Every log is a choice: feed the fire, build defenses, or
  save up. This tension is the core of the game.
- **Day/night rhythm** — calm gathering by day, pressure by night.
- **Roguelite progression** — pick 1 of 3 random upgrades each dawn; builds feel
  different run to run.
- **Game feel first** — screen shake, particles, synthesized sound, visible
  upgrade effects. If a change makes it feel better to play, it's probably right.

Design north star: *easy to start, readable on a small screen, satisfying to
hold and swing.* When tuning, favor "fair but tense" over "punishing."

## Core loop

1. **Day** (~10s): chop trees for wood. Trees regrow. Build via the 🛒 shop.
2. **Dawn**: an upgrade screen pops up — choose 1 of 3 random upgrades (free).
3. **Night** (grows each wave): enemies stream toward the campfire from the
   edges. Fuel drains continuously — feed the fire with wood or it goes out.
   Swing the axe to fight; fences/towers help.
4. **Lose** if the fire goes out, the player dies, **or** the player stands in
   the fire too long (burn). Survive the night → wave++ and back to step 1.

One verb does everything: **swinging the axe** chops trees AND hits enemies in a
radius. Hold the swing button (or space) to auto-swing at the axe's cadence.

## Tech & conventions

- **Phaser 3** (WEBGL renderer — required because we pass an explicit canvas),
  **Vite** build. Plain JS modules, no TypeScript, no framework.
- **No art/audio asset files.** All textures are generated at runtime with
  `Graphics.generateTexture()` / a canvas gradient (`makeTextures()`), and all
  sound is synthesized via the Web Audio API (`src/utils/SoundFX.js`). Keep it
  this way — it makes the game fully self-contained.
- **Responsive layout.** `W`/`H` are module-level `let`s reassigned from
  `this.scale.width/height` at the top of each scene's `create()`. The canvas is
  sized to the device aspect ratio in `main.js` (no letterbox). Position UI
  relative to `W`/`H` (e.g. controls at `H - n`), and gameplay anchors relative
  to the `FIRE` object and `PLAY_TOP`/`PLAY_BOTTOM` — never hardcode 400/700.
- **No physics engine.** Movement and collisions are manual distance checks in
  `update()`. Entities are plain `Image`s; depth = `y` for top-down overlap.
- **Multitouch**: `input.activePointers` is raised so move + swing work at once.
- **PWA**: `public/manifest.webmanifest`, `public/sw.js` (registered in prod
  only), generated PNG icons in `public/icons/`. Standalone needs HTTPS.

## File map

```
index.html               canvas + viewport + PWA meta + inline SVG favicon
src/main.js              Phaser config, device-aspect sizing, SW registration
src/scenes/MenuScene.js  title screen, how-to-play, high score (localStorage)
src/scenes/GameScene.js  the whole game (see sections below)
src/utils/SoundFX.js     Web Audio synth — warm sine/triangle voices + delay
public/manifest.webmanifest, public/sw.js, public/icons/*
```

`GameScene.js` is organized into labeled sections: textures, entities (fire,
trees, player, slots), HUD, controls/input, actions (swing/chop/feed),
upgrades, shop/building, phases (day/night), and `update()`.

## Key systems in GameScene

- **Upgrades** (`upgradePool`, `offerUpgrades`): 10 stacking upgrades, 3 random
  offered at each dawn. Cards animate in (staggered pop-in) and only become
  tappable after landing — this is the deliberate anti-misclick delay.
  `upgLevels` tracks counts; `refreshPowerVisuals()` reflects them on screen.
- **Visible upgrades**: reach → a reach ring around the player + slash arc scales
  to range; axe power → player aura (white→gold→orange→red) + size + slash tint;
  boots → dust trails; bigger fire → glow scales with `fuelMax`.
- **Shop/building** (`shopItems`, `startPlacement`/`tryPlace`, `spawnStructure`):
  fences (sturdy 300-hp palisade that blocks enemies; **flat price** — items can
  set `flat: true` so `shopCost` skips the 1.4^count scaling), watchtowers
  (auto-shoot), ice cannons (slow), mortars (AoE splash), spike traps (passive
  AoE), huts (HP regen), sawmills (each adds +1 wood per felled tree and speeds
  tree regrowth ~25%). **Manual placement**: tapping a shop row enters a
  placement mode (`placeC` overlay) — a ghost + range ring snaps to a dot grid
  (`snapToGrid`, cell `GameScene.CELL`, centred on FIRE). **Two-step**: tapping
  the play area only moves the selected cell (so a finger doesn't occlude the
  spot); a separate **✓ Bygg her** button confirms and builds where valid
  (`placeValid`: off the fire, off the control buttons, not overlapping).
  Chainable until out of wood or at the per-item `max`. Active buildings share
  `updateStructures()` + `GameScene.SPEC` (cd/range/dmg/slow/splash/trap) scaled
  per-tower by `structStats(s)` from `s.lvl`. **Upgrades**: tap a placed tower or
  fence in the day → `openUpgrade(s)` spends wood (`upgradeCost`) to raise its
  level, up to level 5 — towers gain dmg/range/firerate, fences gain max HP
  (`fenceHp(lvl)`) and are fully repaired on upgrade. Towers lean/recoil +
  muzzle-flash on fire (`towerFireFx`). Day only.
- **Fire/fuel**: drains at night; `feedFire()` converts wood→fuel. Light/darkness
  is a dark overlay + additive glow scaled by fuel ratio.
- **Enemies**: spawn at edges, path to the fire (attack a blocking fence first,
  or the player if in the way), gnaw the fire's fuel when they reach it. Types
  (see `spawnEnemy` spec table): `shade` (basic); tougher variants unlock as the
  nights escalate — `brute` (slow, tanky) at 5, `flyer` (fast, fragile, flies
  *over* fences) at 7, `revenant` (armoured crimson bruiser) at 10, `wraith`
  (fast green specter) at 15, `titan` (hulking boss) at 20. `specialChance` and
  base hp/dmg ramp with the wave (extra ramp after night 8) so late game stays
  threatening; pick is biased toward the newest/toughest variants. Ice-cannon-
  frozen enemies are tinted icy light-blue and slowed while `slowUntil` is active.
- **Characters + meta-progression** (`src/utils/Characters.js`, localStorage
  `emberwood_characters`): a roster of characters, each with an appearance
  (gender/skin/hair/shirt indices into palettes) and its own perks/bestNight/runs.
  `generateAvatarTexture(scene, key, look)` draws a character to a texture — used
  for the in-game `player` sprite (regenerated each run from the active character)
  and for GUI previews/portraits. `CharacterScene.js` is the GUI (roster / create
  form with live preview / character sheet). At game over you pick a permanent
  perk for EVERY milestone night reached *that run* (floor(night/5), so reaching
  night 12 grants 2) via `claimMilestone(index, total)` — repeatable each run,
  not once-ever. Perks are *tiny* (≈1/6 of an in-run upgrade) and applied to base
  stats at the top of GameScene `create()`. Migrates `emberwood_profile` on first load.

## Tuning knobs (where to balance)

- `DAY_SECONDS`, and in `startNight()`: night duration, enemy `total`, spawn
  `interval`.
- In `spawnEnemy()`: enemy `hp` / `speed` / `dmg` scaling (`(n-1)` per wave).
- Fuel drain formula in `update()`; gnaw amount in `updateEnemies()`.
- Player base stats in `create()`: `axeDmg`, `moveSpeed`, `swingDelay`,
  `swingRange`, `fuelMax`.
- Upgrade magnitudes in `upgradePool()`; building costs/effects in `shopItems()`.

History so far (player feedback drove these): made night 1–2 easy, smoothed the
curve so night 3 is winnable, slowed base swing so level 1 isn't OP, added
hold-to-swing, moved the swing button out of the corner, added the fire-burn
anti-camping rule.

## Run / build / deploy

```
npm run dev      # vite dev server (localhost:5173). SW does NOT register in dev.
npm run build    # outputs dist/ (Netlify: build=`npm run build`, publish=`dist`)
npm run preview
```

Netlify auto-deploys from `main`. `dist/` and `node_modules/` are gitignored.
(`node_modules/` is currently still tracked from the initial commit — leave as-is
unless asked.)
