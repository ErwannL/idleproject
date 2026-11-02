#!/usr/bin/env node
// v9.1.3 (doc1 lot F, « Missions : journalières, hauts faits, une piste unique ») : simulation avant / après.
// Compare, par profil de joueur, les gemmes (et clés, éclats) des anciennes missions hebdomadaires + mensuelles avec la
// piste du mois, sur 6 mois de calendrier réel (nov. 2026 → avr. 2027). Les journalières, inchangées, sont à part.
// Moteur réel pour la piste (core/missions.js : refreshMissions, trackMissions, claimTrackTier) ; anciennes tables
// recopiées (tickets à 100 gemmes, comme la conversion).
// Activité d'un jour joué (2 h de jeu actif, docs/mesures-v913.md) : 4 600 monstres (2 300/h), boss par jour selon le
// profil, 1 donjon (1 clé/jour), 3 invocations, 300 objets Rares+ (≈ 25 % de 600 objets/h), 2 améliorations.
// Usage : node tools/sim-missions-v913.mjs
const { createNewState } = await import('../src/core/state.js');
const { refreshMissions, trackMissions, claimTrackTier, periodKey } = await import('../src/core/missions.js');

const LEGACY = {
  weekly: { missions: { kills: [3000, { gems: 150 }], bosses: [20, { gems: 120, keys: 3 }], dungeons: [4, { gems: 300 }], rareLoot: [30, { shards: 110 }], upgrades: [10, { gems: 100 }] }, bonus: { gems: 600 } },
  monthly: { missions: { logins: [15, { gems: 700 }], kills: [15000, { gems: 400 }], bosses: [80, { gems: 600 }], dungeons: [15, { gems: 300, keys: 5 }], summons: [50, { gems: 500 }] }, bonus: { gems: 2000 } },
};
const PROFILES = [
  { id: 'tous les jours, 4 boss/jour', days: [0, 1, 2, 3, 4, 5, 6], bosses: 4 },
  { id: '5 jours sur 7, 4 boss/jour', days: [0, 1, 2, 3, 4], bosses: 4 },
  { id: '3 jours sur 7, 4 boss/jour', days: [1, 3, 5], bosses: 4 },
  { id: 'week-end seulement, 6 boss/jour', days: [5, 6], bosses: 6 },
  { id: 'tous les jours, 3 boss/jour (minimum du jour)', days: [0, 1, 2, 3, 4, 5, 6], bosses: 3 },
];
const add = (t, r) => { for (const [k, v] of Object.entries(r)) t[k] = (t[k] ?? 0) + v; };

function run(profile) {
  const start = new Date(2026, 10, 1, 12).getTime();
  const end = new Date(2027, 4, 1, 12).getTime();
  const s = createNewState(start, 1);
  const oldTotal = {}; const newTotal = {};
  const old = { weekly: { key: '', p: {}, c: new Set(), b: false }, monthly: { key: '', p: {}, c: new Set(), b: false } };
  const oldTrack = (type, n) => { for (const per of Object.values(old)) if (per.key) { const m = LEGACY[per === old.weekly ? 'weekly' : 'monthly'].missions[type]; if (m) per.p[type] = Math.min(m[0], (per.p[type] ?? 0) + n); } };
  const oldClaim = () => {
    for (const [id, per] of Object.entries(old)) {
      for (const [mid, [target, reward]] of Object.entries(LEGACY[id].missions)) if ((per.p[mid] ?? 0) >= target && !per.c.has(mid)) { per.c.add(mid); add(oldTotal, reward); }
      if (!per.b && Object.keys(LEGACY[id].missions).every((m) => per.c.has(m))) { per.b = true; add(oldTotal, LEGACY[id].bonus); }
    }
  };
  let days = 0;
  for (let t = start; t < end; t += 86400e3) {
    const d = new Date(t);
    const dow = (d.getDay() + 6) % 7; // lundi = 0
    days += 1;
    if (!profile.days.includes(dow)) continue;
    for (const id of ['weekly', 'monthly']) { const k = periodKey(id, t); if (old[id].key !== k) old[id] = { key: k, p: {}, c: new Set(), b: false }; }
    refreshMissions(s, t); // compte la connexion (journalière et piste)
    oldTrack('logins', 1);
    const act = { kills: 4600, bosses: profile.bosses, dungeons: 1, summons: 3, rareLoot: 300, upgrades: 2 };
    for (const [type, n] of Object.entries(act)) { trackMissions(s, type, n); oldTrack(type, n); }
    oldClaim();
    const g0 = { gems: s.gems, keys: s.keys, shards: s.materials.shards };
    while (claimTrackTier(s));
    add(newTotal, { gems: s.gems - g0.gems, keys: s.keys - g0.keys, shards: s.materials.shards - g0.shards });
  }
  const months = 6; const weeks = days / 7;
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  return `| ${profile.id} | ${fmt((oldTotal.gems ?? 0) / weeks)} | ${fmt((newTotal.gems ?? 0) / weeks)} | ${fmt((oldTotal.gems ?? 0) / months)} | ${fmt((newTotal.gems ?? 0) / months)} | ${fmt((oldTotal.keys ?? 0) / months)} / ${fmt((newTotal.keys ?? 0) / months)} | ${fmt((oldTotal.shards ?? 0) / months)} / ${fmt((newTotal.shards ?? 0) / months)} |`;
}

console.log('| Profil | Gemmes/semaine avant | après | Gemmes/mois avant | après | Clés/mois avant / après | Éclats/mois avant / après |');
console.log('|---|---|---|---|---|---|---|');
for (const p of PROFILES) console.log(run(p));
