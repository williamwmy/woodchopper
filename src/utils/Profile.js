// Persistent player profile + meta-progression (saved in localStorage).
// Reaching night milestones (5, 10, 15, ...) grants a permanent perk choice.
// Perks are intentionally tiny — roughly 1/6 of a normal in-run upgrade — so
// they make the character slowly stronger across runs without trivializing it.
const KEY = 'emberwood_profile';
const MILESTONE_STEP = 5;

const DEFAULTS = {
    name: 'Tømmerhugger',
    bestNight: 0,
    runs: 0,
    claimed: 0,                 // number of milestone perks already chosen
    perks: { axe: 0, hp: 0, speed: 0, fuel: 0, wood: 0, drain: 0 }
};

// Small permanent boosts. `per` is the magnitude added per perk level.
export const PERKS = [
    { key: 'axe',   icon: '🪓', name: 'Slipt klinge', desc: '+1 skade', per: 1 },
    { key: 'hp',    icon: '❤️', name: 'Hardfør',      desc: '+3 maks liv', per: 3 },
    { key: 'speed', icon: '👢', name: 'Lett på foten', desc: '+4 fart', per: 4 },
    { key: 'fuel',  icon: '🔥', name: 'Glohjerte',    desc: '+5 bålkapasitet', per: 5 },
    { key: 'wood',  icon: '🪵', name: 'Forsyninger',  desc: '+2 ved ved start', per: 2 },
    { key: 'drain', icon: '🛡️', name: 'Seig glo',     desc: '-2% bålforbruk', per: 0.02 }
];

export function loadProfile() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { saved = {}; }
    return {
        ...DEFAULTS,
        ...saved,
        perks: { ...DEFAULTS.perks, ...(saved.perks || {}) }
    };
}

export function saveProfile(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
}

// how many milestone perks the given night reached unlocks in total
export function milestonesUnlocked(night) {
    return Math.floor(night / MILESTONE_STEP);
}

export function nextMilestone(claimed) {
    return (claimed + 1) * MILESTONE_STEP;
}

// total count of permanent perks chosen so far
export function perkCount(p) {
    return Object.values(p.perks).reduce((a, b) => a + b, 0);
}
