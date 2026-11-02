// v9.1.3 (doc4, partie A) : héros, doublons et invocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { normalizePool, summon } from '../src/core/gacha.js';
import { Rng } from '../src/core/rng.js';

const NOW = Date.UTC(2026, 10, 2, 12);

test('lot 0 : une seule normalisation du bassin (hero et pet respectés, le reste devient ally)', () => {
  assert.equal(normalizePool('hero'), 'hero');
  assert.equal(normalizePool('pet'), 'pet');
  assert.equal(normalizePool('ally'), 'ally');
  for (const x of [undefined, null, '', 'heroes', 'common', 42]) assert.equal(normalizePool(x), 'ally');
  // Apparences donne des apparences, jamais des compagnons.
  const s = createNewState(NOW);
  s.gems = 1e6;
  const res = summon(s, new Rng(7), 10, 'gems', undefined, normalizePool('hero'));
  assert.ok(res.every((r) => r.kind === 'hero'));
});

test('lot 0 : l\'historique garde le type (skin ou compagnon) et le nettoyage le conserve', () => {
  const s = createNewState(NOW);
  s.gems = 1e6;
  summon(s, new Rng(3), 10, 'gems', undefined, 'hero');
  summon(s, new Rng(4), 10, 'gems', undefined, 'ally');
  assert.ok(s.summon.history.every((h) => h.kind === 'hero' || h.kind === 'companion'));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, NOW);
  assert.deepEqual(back.summon.history.map((h) => h.kind), s.summon.history.map((h) => h.kind));
  // Ancienne entrée sans kind : acceptée telle quelle.
  s.summon.history = [{ id: 'fairy', rarity: 'rare', at: 1 }];
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s)), undefined, NOW).summon.history[0].kind, undefined);
});

// ——— Lot 1 : 5 doublons et la courbe des étoiles ———
import { COMPANIONS, COMPANION_RULES } from '../src/data/companions.js';
import { COMPANION_ROLES } from '../src/data/synergies.js';
import { SKILL_TEMPLATES, skillScales } from '../src/data/companion-skills.js';
import { RARITY_SKILL, allCompanionSkills, companionMultiplier, companionScales, companionSkillMultiplier, duplicates } from '../src/core/companions.js';
import { expeditionPower } from '../src/core/expeditions.js';
import { BALANCE } from '../src/data/balance.js';
import { SAVE_KEY, loadGame, preMigrationKey } from '../src/core/save.js';
import { reconcile, syncOnce } from '../src/core/cloud-save.js';
import { V912, v912List } from './helpers/v912-kits.js';

const roleOf = (id) => COMPANION_ROLES[id] ?? 'pet';
const owned = (stars) => ({ stars, level: 1 });
const at = (n, type) => (type === 'burst' ? n : 1);
// Unités dont la compétence propre change au lot 3 (relevée ou ajoutée) : nouveau ≥ ancien, pas forcément égal.
export const RAISED = new Set(['ranger', 'shadow', 'owl']);

function oldDps(c, copies, n) {
  const p = (RARITY_SKILL[c.rarity] ?? 1) * (1 + 0.15 * (copies - 1));
  return v912List(c.id, roleOf(c.id)).filter((sk) => !sk.ultimate || copies >= 4)
    .filter((sk) => sk.type === 'hit' || sk.type === 'burst').reduce((s, sk) => s + (sk.value / sk.every) * at(n, sk.type) * p, 0);
}
function newDps(state, c, copies, n, home = false) {
  return allCompanionSkills(c.id).filter((sk) => !sk.ultimate || copies >= 4).filter((sk) => sk.type === 'hit' || sk.type === 'burst')
    .reduce((s, sk) => s + (sk.value / sk.every) * at(n, sk.type) * companionSkillMultiplier(state, c, sk.type, home, BALANCE, owned(copies)), 0);
}

test('lot 1 : 26 unités × 1 à 5 exemplaires × 1, 2, 3, 5, 8 cibles : DPS moyen ≥ actuel, égal à 5 exemplaires (1e-9)', () => {
  const s = createNewState(NOW);
  assert.equal(COMPANIONS.length, 26);
  for (const c of COMPANIONS) {
    for (let copies = 1; copies <= 5; copies++) {
      for (const n of [1, 2, 3, 5, 8]) {
        const before = oldDps(c, copies, n);
        const after = newDps(s, c, copies, n);
        assert.ok(after >= before - 1e-12, `${c.id} ${copies} ex. ${n} cibles : ${after} < ${before}`);
        if (copies === 5 && !RAISED.has(c.id)) assert.ok(Math.abs(after - before) <= 1e-9 * Math.max(1, before), `${c.id} à 5 ex. : ${after} ≠ ${before}`);
      }
    }
  }
});

test('lot 1 : dans son donjon, hit, burst, soin et rally ≥ actuel à tout nombre d\'exemplaires', () => {
  const s = createNewState(NOW);
  for (const c of COMPANIONS) {
    for (let copies = 1; copies <= 6; copies++) {
      const old = (RARITY_SKILL[c.rarity] ?? 1) * 6 * (1 + 0.15 * (Math.min(copies, 5) - 1));
      for (const n of [1, 3, 8]) {
        const before = oldDps(c, Math.min(copies, 5), n) * 6;
        assert.ok(newDps(s, c, copies, n, true) >= before - 1e-12, `${c.id} donjon ${copies} ex.`);
      }
      for (const type of ['heal', 'rally']) assert.ok(companionSkillMultiplier(s, c, type, true, BALANCE, owned(copies)) >= Math.min(old, 3) - 1e-12);
    }
  }
});

test('lot 1 : passif, soin et rally ≥ actuel et égaux à 5 exemplaires ; bouclier et or inchangés', () => {
  const s = createNewState(NOW);
  for (const c of COMPANIONS) {
    for (let copies = 1; copies <= 6; copies++) {
      const st = Math.min(copies, 5);
      const oldPassive = 1 + 0.2 * (st - 1);
      const p = companionMultiplier(s, c.id, owned(copies));
      assert.ok(p >= oldPassive - 1e-12);
      if (copies === 5) assert.ok(Math.abs(p - oldPassive) < 1e-12, `passif ${c.id}`);
      const oldSup = Math.min((RARITY_SKILL[c.rarity] ?? 1) * (1 + 0.15 * (st - 1)), 3);
      for (const type of ['heal', 'rally']) {
        const v = companionSkillMultiplier(s, c, type, false, BALANCE, owned(copies));
        assert.ok(v >= oldSup - 1e-12, `${type} ${c.id} ${copies}`);
        if (copies === 5) assert.ok(Math.abs(v - oldSup) < 1e-12);
        assert.ok(v <= 3 + 1e-12);
      }
      for (const type of ['shield', 'gold']) assert.equal(companionSkillMultiplier(s, c, type, false, BALANCE, owned(copies)), RARITY_SKILL[c.rarity] ?? 1);
    }
  }
  // Courbe du passif : ×1,5 à 0 doublon, ×1,8 à 4, ×1,875 à 5.
  assert.ok(Math.abs(companionMultiplier(s, 'shadow_lord', owned(1)) - 1.5) < 1e-12);
  assert.ok(Math.abs(companionMultiplier(s, 'shadow_lord', owned(6)) - 1.875) < 1e-12);
});

test('lot 1 : kh et kb calculés au chargement, conformes au tableau de contrôle (données d\'origine)', () => {
  // Données d'origine, ultimes à 30 s (tableau du brief).
  const control = (id) => {
    const list = v912List(id, roleOf(id));
    list[list.length - 1] = { ...SKILL_TEMPLATES[roleOf(id)].at(-1), ultimate: true };
    return skillScales(list);
  };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const table = { shadow_lord: [1.787, 1.333], demon_queen: [1.333, 1.825], ice_empress: [1.333, 1.837], rose_blade: [1.872, 1.333],
    barbarian: [1.333, 1.782], shadow: [1.987, 1.333], wisp: [1.333, 1.995] };
  for (const [id, [kh, kb]] of Object.entries(table)) assert.deepEqual([r3(control(id).hit), r3(control(id).burst)], [kh, kb], id);
  for (const c of COMPANIONS) {
    const role = roleOf(c.id);
    if (role === 'guardian' || role === 'healer') {
      // Soutiens et gardiens (pas d'ultime offensif : k = 1,6 / 1,2).
      assert.deepEqual([r3(control(c.id).hit), r3(control(c.id).burst)], [1.333, 1.333], c.id);
    }
    if (role === 'pet' && c.id !== 'wisp') assert.deepEqual([r3(control(c.id).hit), r3(control(c.id).burst)], [1.333, 3.81], c.id);
    // Le cache du jeu = le calcul sur ses données actuelles.
    assert.deepEqual(companionScales(c.id), skillScales(allCompanionSkills(c.id)));
  }
  // Ultimes offensifs à 30 s, poids 0,35 de l'ancien DPS.
  for (const role of ['archer', 'assassin', 'mage', 'berserker', 'pet']) {
    const now = SKILL_TEMPLATES[role].at(-1);
    const was = V912.tpl[role].at(-1);
    assert.equal(now.every, 30);
    assert.ok(Math.abs(now.value / 30 - 0.35 * was.value / was.every) < 1e-12, role);
  }
  // Gardien et Soutien : ultimes inchangés.
  for (const role of ['guardian', 'healer']) {
    const { type, every, value } = SKILL_TEMPLATES[role].at(-1);
    assert.deepEqual({ type, every, value }, V912.tpl[role].at(-1));
  }
});

test('lot 1 : tableau du brief (shadow_lord + demon_queen niv. 20, cible unique)', () => {
  const s = createNewState(NOW);
  const sl = COMPANIONS.find((c) => c.id === 'shadow_lord');
  const dq = COMPANIONS.find((c) => c.id === 'demon_queen');
  const expect = [[1.86, 1.25], [1.95, 1.31], [2.05, 1.38], [2.57, 1.67], [2.68, 1.74], [2.79, 1.82]];
  for (let d = 0; d <= 5; d++) {
    const r2 = (x) => Math.round(x * 100) / 100;
    assert.deepEqual([r2(newDps(s, sl, d + 1, 1)), r2(newDps(s, dq, d + 1, 1))], expect[d], `${d} doublons`);
    const passive = 0.13 * (1 + 0.08 * 19) * (1.5 + 0.075 * d);
    assert.ok(Math.abs(passive * 100 - [49.1, 51.6, 54.1, 56.5, 59.0, 61.4][d]) < 0.06);
  }
});

test('lot 1 : expeditionPower identique, y compris à 6 exemplaires', () => {
  const s = createNewState(NOW);
  for (const c of COMPANIONS) {
    for (let copies = 1; copies <= 6; copies++) {
      s.companions.owned[c.id] = { stars: copies, level: 7 };
      const p = expeditionPower(s, c.id);
      s.companions.owned[c.id].stars = Math.min(copies, 5);
      assert.equal(p, expeditionPower(s, c.id));
    }
  }
});

test('lot 1 : un doublon passe de 5 à 6 exemplaires (puis 20 gemmes) ; un skin s\'arrête à 5', () => {
  const s = createNewState(NOW);
  for (const u of COMPANIONS) s.companions.owned[u.id] = { stars: 5, level: 1 };
  s.gems = 1e6;
  const res = summon(s, new Rng(5), 10, 'gems', undefined, 'ally');
  for (const r of res) {
    if (r.refund) assert.equal(r.refund, 20);
  }
  assert.ok(Object.values(s.companions.owned).some((o) => o.stars === 6));
  assert.ok(Object.values(s.companions.owned).every((o) => o.stars <= 6));
  const g0 = s.gems;
  for (const u of COMPANIONS) s.companions.owned[u.id].stars = 6;
  const res2 = summon(s, new Rng(6), 10, 'gems', undefined, 'ally');
  assert.equal(s.gems, g0 - 900 + 200);
  assert.ok(res2.every((r) => r.refund === 20 && r.stars === 6));
  // Skins : plafond 5.
  const h = createNewState(NOW);
  h.gems = 1e6;
  for (let i = 0; i < 30; i++) summon(h, new Rng(100 + i), 10, 'gems', undefined, 'hero');
  assert.ok(Object.values(h.heroes.owned).every((o) => o.stars <= 5));
  assert.ok(Object.values(h.heroes.owned).some((o) => o.stars === 5));
  // Affichage : 1 exemplaire = 0★, 6 = 5★.
  assert.equal(duplicates({ stars: 1 }), 0);
  assert.equal(duplicates({ stars: 6 }), 5);
  assert.equal(COMPANION_RULES.maxCopies, 6);
  assert.equal(BALANCE.summon.maxStars, 5);
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('lot 1 : sauvegarde v7 — 5 exemplaires deviennent 6, le reste ne change pas, une seule fois, copie gardée', () => {
  const s = createNewState(NOW);
  s.companions.owned = { shadow_lord: { stars: 5, level: 20 }, cat: { stars: 3, level: 4 }, wisp: { stars: 1, level: 1 } };
  const raw = JSON.parse(JSON.stringify(s));
  raw.version = 7;
  const st = memoryStorage();
  st.setItem(SAVE_KEY, JSON.stringify(raw));
  const { state } = loadGame(st, undefined, NOW);
  assert.deepEqual(state.companions.owned, { shadow_lord: { stars: 6, level: 20 }, cat: { stars: 3, level: 4 }, wisp: { stars: 1, level: 1 } });
  assert.equal(JSON.parse(st.getItem(preMigrationKey(7))).companions.owned.shadow_lord.stars, 5, 'copie d\'avant migration');
  // Second chargement (format 8) : rien de plus ; une unité montée à 5 exemplaires après la migration reste à 5.
  state.companions.owned.cat.stars = 5;
  st.setItem(SAVE_KEY, JSON.stringify(state));
  const again = loadGame(st, undefined, NOW).state;
  assert.equal(again.companions.owned.shadow_lord.stars, 6);
  assert.equal(again.companions.owned.cat.stars, 5);
});

test('lot 1 : sauvegarde v8 sur un client v7 simulé : bloquée ; reconcile ne pousse jamais une version inférieure', async () => {
  const v8 = JSON.stringify({ version: 8, kills: 5, level: 3, maxStage: 4, lastSaved: 10 });
  const v7 = JSON.stringify({ version: 7, kills: 9, level: 9, maxStage: 9, lastSaved: 99 });
  assert.equal(reconcile(v7, v8), 'none', 'local plus récent mais format inférieur : pas de push');
  assert.equal(reconcile(JSON.stringify({ version: 7, kills: 9, level: 9, maxStage: 9, lastSaved: 5 }), v8), 'pull');
  assert.equal(reconcile(JSON.stringify({ version: 8, kills: 9, level: 9, maxStage: 9, lastSaved: 99 }), v8), 'push');
  let pushed = false;
  const st = memoryStorage();
  st.setItem(SAVE_KEY, v7);
  const client = { pull: async () => ({ data: v8, version: 3 }), push: async () => { pushed = true; return { version: 4 }; } };
  const r = await syncOnce({ client, storage: st, maxSaveVersion: 7 });
  assert.equal(r.action, 'newer');
  assert.equal(pushed, false);
  assert.equal(st.getItem(SAVE_KEY), v7);
  // Un client v7 (SAVE_VERSION 7) refuse aussi la sauvegarde locale en v8 : loadGame → 'newer' au-delà de son format.
  const st2 = memoryStorage();
  st2.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
  assert.equal(loadGame(st2, undefined, NOW).source, 'newer');
});

// ——— Lot 2 : 3★ et 5★ visibles ———
import { skillTextAt } from '../src/data/companion-skills.js';

test('lot 2 : « Ultime débloquée » au 4e exemplaire d\'un compagnon, jamais pour un skin', () => {
  const s = createNewState(NOW);
  for (const u of COMPANIONS) s.companions.owned[u.id] = { stars: 3, level: 1 };
  for (const h of Object.keys(s.heroes.owned)) s.heroes.owned[h].stars = 3;
  s.gems = 1e6;
  const res = summon(s, new Rng(9), 10, 'gems', undefined, 'ally');
  const flagged = res.filter((r) => r.ultimateUnlocked);
  assert.ok(flagged.length >= 1);
  assert.ok(flagged.every((r) => r.stars === 4));
  const h = createNewState(NOW);
  h.gems = 1e6;
  for (let i = 0; i < 20; i++) assert.ok(summon(h, new Rng(50 + i), 10, 'gems', undefined, 'hero').every((r) => !r.ultimateUnlocked));
});

test('lot 2 : textes à valeur réelle, arrondis, verbe propre gardé', () => {
  const dq = COMPANIONS.find((c) => c.id === 'demon_queen');
  assert.equal(skillTextAt(dq.skill, 1.8 * 1.825), 'Embrase tous les ennemis (361 % des dégâts)');
  assert.equal(skillTextAt({ type: 'heal', value: 15, text: 'Soigne 15 % des PV' }, 1.333), 'Soigne 20 % des PV');
  assert.equal(skillTextAt({ type: 'shield', value: 40, duration: 4, text: 'Réduit les dégâts de 40 % pendant 4 s' }, 3), 'Réduit les dégâts de 40 % pendant 4 s');
  for (const c of COMPANIONS) {
    for (const sk of allCompanionSkills(c.id)) assert.doesNotMatch(skillTextAt(sk, 1.37), /\d[.,]\d/, `${c.id} : nombre non arrondi`);
  }
});

// ——— Lot 3 : des kits qui se distinguent ———
test('lot 3 : signatures SSR — `also` seulement heal, shield ou gold ; base = ultime du rôle', () => {
  const ssr = COMPANIONS.filter((c) => c.kind === 'ally' && c.rarity === 'legendary');
  assert.equal(ssr.length, 5);
  for (const c of COMPANIONS) {
    const ult = allCompanionSkills(c.id).at(-1);
    assert.ok(ult.ultimate);
    if (c.ultimate) {
      assert.ok(['heal', 'shield', 'gold'].includes(c.ultimate.also?.type), c.id);
      const { type, every, value } = SKILL_TEMPLATES[roleOf(c.id)].at(-1);
      assert.deepEqual({ type: ult.type, every: ult.every, value: ult.value }, { type, every, value }, c.id);
    }
    for (const sk of allCompanionSkills(c.id)) if (sk.also) assert.notEqual(sk.also.type, 'rally');
  }
  for (const c of ssr) assert.ok(c.ultimate, `${c.id} sans signature`);
  assert.ok(COMPANIONS.filter((c) => c.ultimate).every((c) => c.rarity === 'legendary' && c.kind === 'ally'));
});

test('lot 3 : chaque unité a 4 compétences, aucun nom en double dans un kit ; ranger, shadow et owl relevés', () => {
  const s = createNewState(NOW);
  for (const c of COMPANIONS) {
    const list = allCompanionSkills(c.id);
    assert.equal(list.length, 4, c.id);
    assert.equal(new Set(list.map((sk) => sk.name)).size, 4, `${c.id} : ${list.map((sk) => sk.name).join(', ')}`);
  }
  for (const id of RAISED) {
    const c = COMPANIONS.find((x) => x.id === id);
    for (const n of [1, 3, 8]) assert.ok(newDps(s, c, 5, n) > oldDps(c, 5, n), `${id} relevé`);
  }
  const own = (id) => COMPANIONS.find((c) => c.id === id).skill;
  assert.deepEqual([own('ranger').value, own('ranger').every], [1, 5]);
  assert.deepEqual([own('shadow').value, own('shadow').every], [0.8, 4]);
  assert.ok(own('owl'));
});
