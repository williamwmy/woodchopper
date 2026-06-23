// Character roster + meta-progression, stored in localStorage.
// Each character has an appearance (gender/skin/hair/shirt) and its own
// permanent perks earned at night milestones. Replaces the old single profile.
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
    { key: 'armor', icon: '🪖', name: 'Rustning',      desc: '+1 rustning (mindre skade)' }
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

// derived attributes for the character sheet (mirror GameScene base stats)
export function attributes(ch) {
    const p = ch.perks;
    return [
        { icon: '🪓', label: 'Skade', value: 6 + p.axe },
        { icon: '❤️', label: 'Maks liv', value: 100 + p.hp * 3 },
        { icon: '👢', label: 'Fart', value: 150 + p.speed * 4 },
        { icon: '🔥', label: 'Bålkapasitet', value: 100 + p.fuel * 5 },
        { icon: '🪵', label: 'Startved', value: 12 + p.wood * 2 },
        { icon: '🛡️', label: 'Bålvern', value: (p.drain * 2) + '%' },
        { icon: '🎯', label: 'Kritisk sjanse', value: (p.crit * 1.5).toFixed(1) + '%' },
        { icon: '🥊', label: 'Tilbakeslag', value: 7 + p.knock * 2 },
        { icon: '🪖', label: 'Rustning', value: p.armor }
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
export function generateAvatarTexture(scene, key, look) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    const skin = SKINS[look.skin] ?? SKINS[1];
    const hair = HAIRS[look.hair] ?? HAIRS[1];
    const shirt = SHIRTS[look.shirt] ?? SHIRTS[0];
    const female = look.gender === 1;

    // boots + pants
    g.fillStyle(0x2a1d12, 1); g.fillRect(11, 37, 6, 5); g.fillRect(19, 37, 6, 5);
    g.fillStyle(0x33405a, 1); g.fillRect(12, 30, 5, 8); g.fillRect(19, 30, 5, 8);

    // long hair behind the head (female)
    if (female) { g.fillStyle(shade(hair, 0.85), 1); g.fillRect(9, 6, 18, 20); }

    // shirt (the chosen clothing colour) + shading + plaid hint
    g.fillStyle(shirt, 1); g.fillRect(9, 17, 18, 14);
    g.fillStyle(shade(shirt, 0.8), 1); g.fillRect(9, 17, 18, 2); g.fillRect(17, 17, 2, 14);
    // arm + hand
    g.fillStyle(shirt, 1); g.fillRect(24, 19, 5, 9);
    g.fillStyle(skin, 1); g.fillRect(24, 26, 5, 5);

    // head
    g.fillStyle(skin, 1); g.fillRect(12, 6, 12, 11);
    g.fillStyle(shade(skin, 0.86), 1); g.fillRect(20, 6, 4, 11);
    // eyes
    g.fillStyle(0x2a2a30, 1); g.fillRect(15, 11, 2, 2); g.fillRect(20, 11, 2, 2);

    // hair on top
    g.fillStyle(hair, 1); g.fillRect(11, 3, 14, 5);
    if (female) { g.fillStyle(hair, 1); g.fillRect(10, 6, 2, 11); g.fillRect(24, 6, 2, 11); }
    else { g.fillStyle(hair, 1); g.fillRect(12, 14, 11, 3); }   // beard

    // axe
    g.fillStyle(0x6b4423, 1); g.fillRect(28, 5, 3, 24);
    g.fillStyle(0xcfd6dd, 1); g.fillRect(26, 3, 9, 8);
    g.fillStyle(0x9aa3ad, 1); g.fillRect(26, 8, 9, 3);

    g.generateTexture(key, 36, 44);
    g.destroy();
}
