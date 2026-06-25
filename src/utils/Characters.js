// Character roster + meta-progression, stored in localStorage.
// Each character has an appearance (gender/skin/hair/shirt) and its own
// permanent perks earned at night milestones. Replaces the old single profile.
import { t } from './i18n.js';
const KEY = 'emberwood_characters';
const OLD_KEY = 'emberwood_profile';
const MILESTONE_STEP = 5;

// ---- appearance palettes ----
export const GENDERS = ['Mann', 'Kvinne'];
export const SKINS = [0xffe0bd, 0xf2c9a0, 0xe0a878, 0xc68642, 0x8d5524];
export const HAIRS = [0x2a2018, 0x6b4423, 0xb5651d, 0xe6c86e, 0xb04a3a, 0xd8d8d8];
export const SHIRTS = [0xb83b2e, 0x2e6fb8, 0x2e9e5b, 0x8e5bd0, 0xe0892e, 0x3a4049, 0xcc4f8f];

// ---- permanent perks (tiny, ~1/6 of an in-run upgrade) ----
export const PERKS = [
    { key: 'axe',   icon: '🪓', name: 'Slipt klinge', desc: '+1 skade' },
    { key: 'hp',    icon: '❤️', name: 'Hardfør',      desc: '+3 maks liv' },
    { key: 'speed', icon: '👢', name: 'Lett på foten', desc: '+4 fart' },
    { key: 'fuel',  icon: '🔥', name: 'Glohjerte',    desc: '+5 bålkapasitet' },
    { key: 'wood',  icon: '🪵', name: 'Forsyninger',  desc: '+2 ved ved start' },
    { key: 'drain', icon: '🛡️', name: 'Seig glo',     desc: '-2% bålforbruk' },
    { key: 'crit',  icon: '🎯', name: 'Skarpt blikk',  desc: '+1.5% kritisk sjanse' },
    { key: 'knock', icon: '🥊', name: 'Tungt slag',    desc: '+2 tilbakeslag' },
    { key: 'armor', icon: '🦺', name: 'Rustning',      desc: '+1 rustning (mindre skade)' }
];

const NEW_PERKS = () => ({ axe: 0, hp: 0, speed: 0, fuel: 0, wood: 0, drain: 0, crit: 0, knock: 0, armor: 0 });

let idSeq = 1;
function newId() { idSeq += 1; return 'c' + Date.now() + '_' + idSeq; }

export function newCharacter(fields = {}) {
    return {
        id: newId(),
        name: fields.name || 'Tømmerhugger',
        gender: fields.gender ?? 0,
        skin: fields.skin ?? 1,
        hair: fields.hair ?? 1,
        shirt: fields.shirt ?? 0,
        bestNight: 0,
        runs: 0,
        claimed: 0,
        perks: NEW_PERKS()
    };
}

function sanitize(ch) {
    return {
        ...newCharacter(),
        ...ch,
        perks: { ...NEW_PERKS(), ...(ch.perks || {}) }
    };
}

export function loadRoster() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }

    if (data && Array.isArray(data.characters) && data.characters.length) {
        const characters = data.characters.map(sanitize);
        const activeId = characters.some(c => c.id === data.activeId) ? data.activeId : characters[0].id;
        return { characters, activeId };
    }

    // migrate an old single profile, if present
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD_KEY)); } catch (e) { old = null; }
    const first = sanitize(old ? { name: old.name, bestNight: old.bestNight, runs: old.runs, claimed: old.claimed, perks: old.perks } : {});
    const roster = { characters: [first], activeId: first.id };
    saveRoster(roster);
    return roster;
}

export function saveRoster(roster) {
    try { localStorage.setItem(KEY, JSON.stringify(roster)); } catch (e) { /* ignore */ }
}

export function getActive(roster) {
    return roster.characters.find(c => c.id === roster.activeId) || roster.characters[0];
}

export function addCharacter(roster, fields) {
    const ch = newCharacter(fields);
    roster.characters.push(ch);
    roster.activeId = ch.id;
    saveRoster(roster);
    return ch;
}

export function deleteCharacter(roster, id) {
    if (roster.characters.length <= 1) return;
    roster.characters = roster.characters.filter(c => c.id !== id);
    if (roster.activeId === id) roster.activeId = roster.characters[0].id;
    saveRoster(roster);
}

// ---- milestones ----
export function milestonesUnlocked(night) { return Math.floor(night / MILESTONE_STEP); }
export function nextMilestone(claimed) { return (claimed + 1) * MILESTONE_STEP; }
export function perkCount(ch) { return Object.values(ch.perks).reduce((a, b) => a + b, 0); }

// localized gender label
export function genderLabel(i) { return t(i === 1 ? 'gender.female' : 'gender.male'); }

// derived attributes for the character sheet (mirror GameScene base stats)
export function attributes(ch) {
    const p = ch.perks;
    return [
        { icon: '🪓', label: t('attr.damage'), value: 6 + p.axe },
        { icon: '❤️', label: t('attr.maxhp'), value: 100 + p.hp * 3 },
        { icon: '👢', label: t('attr.speed'), value: 150 + p.speed * 4 },
        { icon: '🔥', label: t('attr.fuel'), value: 100 + p.fuel * 5 },
        { icon: '🪵', label: t('attr.startwood'), value: 12 + p.wood * 2 },
        { icon: '🛡️', label: t('attr.firedef'), value: (p.drain * 2) + '%' },
        { icon: '🎯', label: t('attr.crit'), value: (p.crit * 1.5).toFixed(1) + '%' },
        { icon: '🥊', label: t('attr.knock'), value: 7 + p.knock * 2 },
        { icon: '🦺', label: t('attr.armorlbl'), value: p.armor }
    ];
}

function shade(c, f) {
    const r = Math.floor((c >> 16 & 255) * f);
    const g = Math.floor((c >> 8 & 255) * f);
    const b = Math.floor((c & 255) * f);
    return (r << 16) | (g << 8) | b;
}

// Draw a character avatar to a texture key (used for the player sprite and
// for previews/portraits in the GUI). Regenerates if the key already exists.
export function generateAvatarTexture(scene, key, look, gear = {}) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    const skin = SKINS[look.skin] ?? SKINS[1];
    const hair = HAIRS[look.hair] ?? HAIRS[1];
    const shirt = SHIRTS[look.shirt] ?? SHIRTS[0];
    const female = look.gender === 1;
    // upgrade tiers that re-skin the avatar (mightier with progress)
    const armorTier = gear.armor || 0;
    const axeLv = gear.axe || 0;
    const vitLv = gear.vit || 0;
    const bootLv = gear.boots || 0;
    const reachLv = gear.reach || 0;
    const swiftLv = gear.swift || 0;
    const lumberLv = gear.lumber || 0;
    const hunterLv = gear.hunter || 0;

    // a bundle of firewood strapped to the back (Effektiv hugger), drawn behind
    if (lumberLv >= 1) {
        const n = Math.min(4, 1 + lumberLv);
        for (let i = 0; i < n; i++) {
            const lx = 1 + i * 3;
            g.fillStyle(0x5a3a1e, 1); g.fillRect(lx, 5 - i, 4, 22);
            g.fillStyle(0xc89b6a, 1); g.fillRect(lx, 5 - i, 4, 3);   // cut ends on top
        }
        g.fillStyle(0x3a2414, 1); g.fillRect(1, 17, 12, 2);         // strap
    }

    // a mighty cape billows behind once well armoured (drawn first, peeks at edges)
    if (armorTier >= 3) {
        g.fillStyle(0x7a1d2a, 1); g.fillRect(6, 16, 24, 24);
        g.fillStyle(0x9a2535, 1); g.fillRect(6, 16, 24, 3);
    }

    // boots + pants
    g.fillStyle(0x2a1d12, 1); g.fillRect(11, 37, 6, 5); g.fillRect(19, 37, 6, 5);
    g.fillStyle(0x33405a, 1); g.fillRect(12, 30, 5, 8); g.fillRect(19, 30, 5, 8);
    // sturdier boots with the boots upgrade
    if (bootLv >= 1) {
        g.fillStyle(0x3a2a16, 1); g.fillRect(11, 34, 6, 8); g.fillRect(19, 34, 6, 8);   // taller
        g.fillStyle(0x8a929c, 1); g.fillRect(11, 40, 6, 2); g.fillRect(19, 40, 6, 2);   // metal toe
        if (bootLv >= 3) { g.fillStyle(0xd8b54a, 1); g.fillRect(11, 34, 6, 1); g.fillRect(19, 34, 6, 1); }  // gold cuff
    }

    // long hair behind the head (female)
    if (female) { g.fillStyle(shade(hair, 0.85), 1); g.fillRect(9, 6, 18, 20); }

    // shirt (the chosen clothing colour) + shading + plaid hint
    g.fillStyle(shirt, 1); g.fillRect(9, 17, 18, 14);
    g.fillStyle(shade(shirt, 0.8), 1); g.fillRect(9, 17, 18, 2); g.fillRect(17, 17, 2, 14);
    // arm + hand
    g.fillStyle(shirt, 1); g.fillRect(24, 19, 5, 9);
    g.fillStyle(skin, 1); g.fillRect(24, 26, 5, 5);
    // broad fur mantle across the shoulders with vitality upgrades
    if (vitLv >= 1) {
        const w = Math.min(4, vitLv);
        g.fillStyle(0x5a4632, 1); g.fillRect(7 - w, 15, 22 + 2 * w, 4);
        g.fillStyle(0x6e5740, 1); g.fillRect(7 - w, 15, 22 + 2 * w, 1);
    }

    // predator's tooth necklace across the chest (Rovdyr, first level)
    if (hunterLv >= 1) {
        g.fillStyle(0x2a1d10, 1); g.fillRect(12, 17, 12, 1);          // cord
        g.fillStyle(0xede4cf, 1);
        g.fillTriangle(14, 18, 16, 18, 15, 22);
        g.fillTriangle(18, 18, 20, 18, 19, 23);
        g.fillTriangle(22, 18, 24, 18, 23, 21);
    }

    // head
    g.fillStyle(skin, 1); g.fillRect(12, 6, 12, 11);
    g.fillStyle(shade(skin, 0.86), 1); g.fillRect(20, 6, 4, 11);
    // eyes
    g.fillStyle(0x2a2a30, 1); g.fillRect(15, 11, 2, 2); g.fillRect(20, 11, 2, 2);
    // war paint once you stack Rovdyr further
    if (hunterLv >= 2) {
        g.fillStyle(0xc8283a, 1); g.fillRect(13, 13, 4, 2); g.fillRect(19, 13, 4, 2);   // cheek stripes
    }
    if (hunterLv >= 3) {
        g.fillStyle(0xc8283a, 1); g.fillRect(15, 7, 6, 2);                              // forehead mark
    }

    // hair on top
    g.fillStyle(hair, 1); g.fillRect(11, 3, 14, 5);
    if (female) { g.fillStyle(hair, 1); g.fillRect(10, 6, 2, 11); g.fillRect(24, 6, 2, 11); }
    else { g.fillStyle(hair, 1); g.fillRect(12, 14, 11, 3); }   // beard

    // --- body armour: the character looks mightier as armor grows (no helmet) ---
    if (armorTier >= 1) {
        // breastplate over the shirt + a shoulder guard on the arm
        g.fillStyle(0x9aa3ad, 1); g.fillRect(10, 18, 16, 12);
        g.fillStyle(0xc2cad3, 1); g.fillRect(10, 18, 16, 3);          // top shine
        g.fillStyle(0x6e767f, 1); g.fillRect(17, 18, 2, 12);         // centre seam
        g.fillStyle(0x6e767f, 1); g.fillRect(10, 28, 16, 2);         // bottom rim
        g.fillStyle(0xaab2bc, 1); g.fillRect(23, 18, 7, 5);          // arm guard
        g.fillStyle(0x6e767f, 1); g.fillRect(23, 22, 7, 1);
    }
    if (armorTier >= 2) {
        // pauldrons
        g.fillStyle(0xc2cad3, 1); g.fillRect(8, 16, 6, 5); g.fillRect(24, 16, 6, 5);
        g.fillStyle(0x8a929c, 1); g.fillRect(8, 20, 6, 1); g.fillRect(24, 20, 6, 1);
    }
    if (armorTier >= 3) {
        // gilded trim on collar & belt + leg greaves
        g.fillStyle(0xd8b54a, 1); g.fillRect(10, 18, 16, 1); g.fillRect(10, 29, 16, 2);
        g.fillStyle(0x9aa3ad, 1); g.fillRect(12, 30, 5, 7); g.fillRect(19, 30, 5, 7);
        g.fillStyle(0xc2cad3, 1); g.fillRect(12, 30, 5, 1); g.fillRect(19, 30, 5, 1);
    }
    if (armorTier >= 4) {
        // grand champion plate — bigger pauldrons + gold edging
        g.fillStyle(0xd8d8e0, 1); g.fillRect(7, 15, 7, 6); g.fillRect(23, 15, 7, 6);
        g.fillStyle(0xd8b54a, 1); g.fillRect(7, 15, 7, 1); g.fillRect(23, 15, 7, 1);
    }

    // --- head armour: a separate helmet upgrade, drawn over the hair ---
    const helmTier = gear.helm || 0;
    if (helmTier >= 1) {
        // iron skullcap
        g.fillStyle(0x9aa3ad, 1); g.fillRect(11, 3, 14, 5);
        g.fillStyle(0xc2cad3, 1); g.fillRect(11, 3, 14, 1);          // shine
        g.fillStyle(0x6e767f, 1); g.fillRect(11, 7, 14, 1);          // rim
    }
    if (helmTier >= 2) {
        // brow band + nose guard
        g.fillStyle(0x8a929c, 1); g.fillRect(11, 8, 14, 2);
        g.fillStyle(0x9aa3ad, 1); g.fillRect(17, 9, 2, 5);
    }
    if (helmTier >= 3) {
        g.fillStyle(0xd8b54a, 1); g.fillRect(11, 7, 14, 1);         // gold trim
    }
    if (helmTier >= 4) {
        // horned, crested great-helm
        g.fillStyle(0xefe3b0, 1);
        g.fillTriangle(11, 4, 8, -2, 14, 4); g.fillTriangle(25, 4, 28, -2, 22, 4);
        g.fillStyle(0xffe9a0, 1); g.fillRect(13, 1, 10, 2);
    }

    // axe — head glows with axe upgrades, shaft lengthens with reach, head grows
    // with knockback; crit-damage adds titanium/gem accents on the head and
    // crit-chance upgrades the handle's material
    const knockLv = gear.knock || 0;
    const cdLv = gear.critdmg || 0;       // crit damage → head accents
    const ccLv = gear.crit || 0;          // crit chance → handle material
    const headCol = [0xcfd6dd, 0xffe08a, 0xffae42, 0xff7a2b, 0xff5a2b][Math.min(axeLv, 4)];
    const handleCol = ccLv >= 3 ? 0xd8b54a : ccLv >= 2 ? 0x9aa3ad : ccLv >= 1 ? 0x4a2f18 : 0x6b4423;
    const grow = Math.min(9, axeLv + Math.max(0, knockLv - 1));               // wider head
    const headH = 8 + Math.min(7, Math.round(grow * 0.7));                    // taller head
    const ext = Math.min(9, reachLv * 2);                                     // longer shaft per reach lvl
    const w = 9 + grow;

    const drawAxe = (px, hl) => {   // px = handle x, hl = head left x
        g.fillStyle(handleCol, 1); g.fillRect(px, 5, 3, 24 + ext);            // handle (material by crit-chance)
        if (ccLv >= 1) { g.fillStyle(shade(handleCol, 0.6), 1); g.fillRect(px, 13, 3, 1); g.fillRect(px, 19, 3, 1); g.fillRect(px, 25, 3, 1); }  // grip bands
        if (ccLv >= 3) { g.fillStyle(0xfff0b0, 1); g.fillRect(px - 1, 5 + 24 + ext - 2, 5, 2); }   // gold pommel
        g.fillStyle(headCol, 1); g.fillRect(hl, 3, w, headH);                 // head
        g.fillStyle(shade(headCol, 0.78), 1); g.fillRect(hl, 3 + headH - 3, w, 3);
        if (cdLv >= 1) { g.fillStyle(0xeaf6ff, 1); g.fillRect(hl, 3, w, 1); } // titanium sheen edge
        if (cdLv >= 2) { g.fillStyle(0x8ff0ff, 1); g.fillRect(hl + 2, 5, 2, 2); }   // gem
        if (cdLv >= 3) { g.fillStyle(0xff8fe0, 1); g.fillRect(hl + Math.max(5, w - 4), 5, 2, 2); }  // 2nd gem
    };
    drawAxe(28, 26 - grow);
    if (swiftLv >= 4) {   // a second axe in the off-hand once swing is fast enough
        g.fillStyle(skin, 1); g.fillRect(7, 25, 4, 4);
        drawAxe(8, 4);
    }

    g.generateTexture(key, 36, 44);
    g.destroy();
}
