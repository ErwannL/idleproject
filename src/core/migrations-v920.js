// v9.2.0 (monde marin) : le Royaume englouti (20 étapes) s'insère en monde 11, avant le Trône de l'Abysse (devenu le
// monde 12). Le cycle passe de 210 à 230 étapes. Une sauvegarde d'avant (SAVE_VERSION < 9) garde sa position exacte :
// même cycle, même monde, même étape dans le monde — un joueur au-delà du monde 10 ne recule pas et ne saute rien.
// Sa puissance aussi est intacte : le niveau des ennemis suit levelForStage (core/combat.js), qui redonne pour chaque
// étape convertie exactement l'ancien numéro d'étape.
export const OLD_CYCLE = 210; // 10 mondes de 20 étapes + l'Abysse (10)
export const OCEAN_START = 201; // première étape du Royaume englouti (cycle 1)
export const OCEAN_LENGTH = 20;
const OLD_ABYSS_INDEX = 10;

// Ancienne étape (cycle de 210) → nouvelle étape (cycle de 230).
export function stageTo920(s) {
  const n = Math.max(1, Math.floor(Number(s) || 1));
  const cycle = Math.floor((n - 1) / OLD_CYCLE);
  const pos = ((n - 1) % OLD_CYCLE) + 1; // 1..210
  return cycle * (OLD_CYCLE + OCEAN_LENGTH) + (pos < OCEAN_START ? pos : pos + OCEAN_LENGTH);
}

// Index de monde d'avant (0..10) → nouvel index (l'Abysse passe de 10 à 11).
export const zoneTo920 = (z) => (Number(z) >= OLD_ABYSS_INDEX ? Number(z) + 1 : Number(z));

// Conversion des champs bruts (avant sanitizeState). Ne touche qu'aux champs qui portent une étape ou un index de monde.
export function migrateOceanWorld(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const out = { ...raw };
  const st = (v) => (Number.isFinite(v) ? stageTo920(v) : v);
  out.maxStage = st(raw.maxStage);
  out.stage = st(raw.stage);
  if (raw.records && typeof raw.records === 'object') out.records = { ...raw.records, bestStage: st(raw.records.bestStage) };
  if (raw.bossRetry && typeof raw.bossRetry === 'object') out.bossRetry = { ...raw.bossRetry, stage: st(raw.bossRetry.stage) };
  if (Array.isArray(raw.inbox)) out.inbox = raw.inbox.map((e) => (e && typeof e === 'object' && Number.isFinite(e.stage) ? { ...e, stage: stageTo920(e.stage) } : e));
  const t = raw.times;
  if (t && typeof t === 'object') {
    const where = {};
    for (const [k, v] of Object.entries(t.where ?? {})) {
      const m = /^(\d{1,2}):(\d{1,4})$/.exec(k);
      where[m ? `${zoneTo920(m[1])}:${m[2]}` : k] = v;
    }
    const firstZone = {};
    for (const [k, v] of Object.entries(t.firstZone ?? {})) firstZone[/^\d{1,2}$/.test(k) ? String(zoneTo920(k)) : k] = v;
    out.times = { ...t, where, firstZone };
  }
  return out;
}
