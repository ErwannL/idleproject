#!/usr/bin/env node
// v9.1.3 (doc4 partie B, préalable) : revenu réel en tirages sur 14 jours (une bannière), joueur quotidien.
// Outil seulement, aucun réglage modifié. Base : tools/measure-v913.mjs (moteur réel en Node, horloge et hasard fixes).
// `state.records.summons` ne donne qu'un cumul : ici on joue 14 vrais jours avec le moteur du jeu.
//
// Chaque jour : connexion (calendrier), H heures de combat actif (joueur automatique de measure-v913 : achats,
// équipement, compétences, recyclage), hors ligne réel (computeOfflineRewards, 24 − H h, plafond du jeu),
// missions du jour et piste du mois (vraies règles, récupérées), prime du jour (vraie), 1 donjon Facile (récompense
// fixe du donjon, la course n'est pas simulée), expéditions (3 Grandes expéditions de 12 h relancées deux fois par jour,
// vraies récompenses), Défi et Tour hebdomadaires (récompense de la semaine, vague/étage 10 supposés).
// Le joueur invoque (×10 dès 900 gemmes, ×1 sinon) : les invocations comptent pour les missions et la piste.
// Résultat : tirages faits + gemmes restantes / 100 = « revenu en tirages ». Hauts faits (uniques) comptés à part.
//
// Usage : node tools/measure-revenu-v913.mjs --saves <saves.json de measure-v913 --dump-saves> [--hours 0.5,1,2] [--json]
import { readFileSync } from 'node:fs';

const T0 = new Date(2026, 10, 2, 9).getTime(); // lundi 2 novembre 2026, 9 h (début de mois : piste neuve)
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x51ed2701;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { DUNGEON_REWARD, DUNGEON_DIFFICULTIES } = await import('../src/data/dungeons.js');
const { sanitizeState } = await import('../src/core/state.js');
const { createCombat, step } = await import('../src/core/combat.js');
const { buyMostProfitable } = await import('../src/core/profit.js');
const { equipBest, isUpgrade, sweepInventory, bulkRecycleCandidates } = await import('../src/core/inventory.js');
const { autoFuse } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { Rng } = await import('../src/core/rng.js');
const { summon } = await import('../src/core/gacha.js');
const { computeOfflineRewards, applyOfflineRewards } = await import('../src/core/offline.js');
const { refreshMissions, claimLogin, claimAllMissions, claimTrackTier, trackMissions } = await import('../src/core/missions.js');
const { dailyBounty, claimBounty } = await import('../src/core/bounty.js');
const { availableForExpedition, startExpedition, expeditionDone, claimExpedition } = await import('../src/core/expeditions.js');
const { grantReward } = await import('../src/core/rewards.js');
const { weeklyReward } = await import('../src/core/tower.js');
const { weeklyChallengeReward } = await import('../src/core/challenge.js');

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const RAW = JSON.parse(readFileSync(arg('--saves'), 'utf8'));
const HOURS = arg('--hours', '0.5,1,2').split(',').map(Number);
const DAYS = 14;
const DT = BALANCE.simulation.tickSeconds;
const DAY = 86400 * 1000;

function play(state, seconds, rng) {
  const world = createCombat(state);
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i++) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    world.events.length = 0;
    if (i % Math.round(5 / DT) === 0) {
      buyMostProfitable(state);
      equipBest(state);
      distributeSkillPoints(state);
      autoFuse(state, rng, isUpgrade);
      sweepInventory(state);
      if (state.inventory.length >= BALANCE.loot.inventorySize - 2) {
        const ids = new Set(bulkRecycleCandidates(state, 'epic').map((x) => x.id));
        state.inventory = state.inventory.filter((x) => !ids.has(x.id));
      }
    }
  }
}

function spend(state, rng, acc) {
  for (;;) {
    const n = state.gems >= BALANCE.summon.tenPullGemCost ? 10 : state.gems >= BALANCE.summon.gemCost ? 1 : 0;
    if (!n) return;
    const r = summon(state, rng, n, 'gems', BALANCE, 'ally');
    if (!r) return;
    acc.pulls += r.length;
    acc.refund += r.reduce((s, x) => s + x.refund, 0);
  }
}

function claimDaily(state, rng, acc) {
  const g = state.gems;
  claimLogin(state);
  acc.sources.connexion += state.gems - g;
  const g2 = state.gems;
  claimAllMissions(state);
  while (claimTrackTier(state));
  acc.sources.missions += state.gems - g2;
}

function measure(raw, hours) {
  simMs = 0;
  const state = sanitizeState(structuredClone(raw), BALANCE, T0);
  state.gems = 0; // revenu seul : le stock de départ ne compte pas
  state.lastSaved = T0;
  const rng = new Rng(7);
  const acc = { pulls: 0, refund: 0, sources: { combat: 0, horsLigne: 0, connexion: 0, missions: 0, prime: 0, donjon: 0, expeditions: 0, hebdo: 0 } };
  for (let d = 0; d < DAYS; d++) {
    const dayStart = T0 + d * DAY;
    simMs = dayStart - T0;
    // Hors ligne depuis la dernière session (jour 0 : rien).
    if (d > 0) {
      const g = state.gems;
      const rewards = computeOfflineRewards(state, state.lastSaved, Date.now(), rng);
      if (rewards) applyOfflineRewards(state, rewards);
      acc.sources.horsLigne += state.gems - g;
    }
    refreshMissions(state, Date.now());
    claimDaily(state, rng, acc);
    // Expéditions : on récupère et on relance (Grande expédition, 12 h).
    const ge = state.gems;
    state.expeditions.slots.forEach((s, i) => { if (s && expeditionDone(s, Date.now())) claimExpedition(state, i, Date.now(), grantReward); });
    state.expeditions.slots.forEach((s, i) => {
      if (s) return;
      const free = availableForExpedition(state)[0];
      if (free) startExpedition(state, i, free.id, 'journey', Date.now());
    });
    acc.sources.expeditions += state.gems - ge;
    spend(state, rng, acc);
    // Combat actif (les gemmes gagnées en combat : kills, niveaux, nouvelles étapes, boss, événements).
    const gc = state.gems;
    play(state, hours * 3600, rng);
    acc.sources.combat += state.gems - gc;
    // Prime du jour.
    dailyBounty(state, Date.now());
    const gb = state.gems;
    claimBounty(state, rng, Date.now());
    acc.sources.prime += state.gems - gb;
    // Donjon : une clé par jour en Facile (récompense fixe, course non simulée).
    const dg = Math.round(DUNGEON_REWARD.gems * DUNGEON_DIFFICULTIES.easy.gems);
    state.gems += dg;
    acc.sources.donjon += dg;
    trackMissions(state, 'dungeons', 1);
    // Défi et Tour : récompense de la semaine, une fois par semaine (vague et étage 10 supposés).
    if (d % 7 === 0) {
      const w = weeklyReward(10).gems + weeklyChallengeReward(10).gems;
      state.gems += w;
      acc.sources.hebdo += w;
    }
    claimDaily(state, rng, acc);
    spend(state, rng, acc);
    state.lastSaved = Date.now();
  }
  const total = acc.pulls + state.gems / BALANCE.summon.gemCost;
  return { hours, start: raw.maxStage, pulls: acc.pulls, left: state.gems, total, sources: acc.sources, refund: acc.refund };
}

const out = [];
for (const [name, raw] of Object.entries(RAW)) {
  for (const h of HOURS) {
    const r = measure(raw, h);
    out.push({ save: name, ...r });
    if (!args.includes('--json')) {
      const src = Object.entries(r.sources).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ');
      console.log(`${name} (étape ${r.start}) · ${h} h/jour : ${r.total.toFixed(1)} tirages en ${DAYS} jours (${r.pulls} faits + ${r.left} gemmes) · ${src} · remboursements ${r.refund}`);
    }
  }
}
if (args.includes('--json')) console.log(JSON.stringify(out));
