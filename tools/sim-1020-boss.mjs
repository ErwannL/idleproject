// v10.20 (partie 7.2) : morts contre les boss du début de partie (Loup-garou, étape 35 ; Loup alpha, étape 40), partie
// neuve qui suit le Sceau (tools/sim-1019-survie.mjs, vrai moteur). Mêmes graines avant (réglages v10.19) et après.
// Usage : node tools/sim-1020-boss.mjs [--seeds 30] [--from 1] [--hours 8] [--look 5] [--json]
// --guide : joueur qui suit seulement le Sceau (sans avance forcée). Par défaut : joueur pressé (rushHook).
// Mesure (30 graines, 1 à 30, --look 60 --hours 10, joueur pressé), morts avant → après (moyenne par partie ± IC95) :
//   Loup-garou (étape 35) 246 → 2 (8,20 ± 6,20 → 0,07 ± 0,13) ; Loup alpha (étape 40) 148 → 0 (4,93 ± 4,26 → 0) ;
//   les deux 394 → 2 (écart apparié −13,07 ± 9,05) ; parties avec au moins une mort contre eux : 10 → 1.
// Avant (survival.hitCapPct boss 45, heavy 60, secondWind.above 0.5, comme la v10.19).
import { BALANCE } from '../src/data/balance.js';
import { runSurvival } from './sim-1019-survie.mjs';
import { changeStage } from '../src/core/combat.js';

export const OLD_SURVIVAL = { hitCapPct: { normal: 25, boss: 45, heavy: 60 }, secondWind: { above: 0.5, invulnSeconds: 1.5 } };
export const BOSS_STAGES = { 35: 'Loup-garou', 40: 'Loup alpha' };

export function withSurvival(patch, fn) {
  const keep = BALANCE.survival;
  BALANCE.survival = { ...keep, ...patch };
  try { return fn(); } finally { BALANCE.survival = keep; }
}

// Joueur « pressé » (comme la partie du bilan 10.19 : étape 40 en 72 min) : l'avance automatique toujours active et le
// boss relancé dès qu'il est proposé, sans attendre d'être assez fort.
export function rushHook(sim) {
  const { state } = sim;
  state.autoAdvance = true;
  if (state.bossRetry) { const r = state.bossRetry; state.bossRetry = null; changeStage(state, sim.world, r.stage); }
}

export function bossDeaths(seed, { hours = 8, look = 5, rush = true } = {}) {
  const r = runSurvival(seed, { hours, look, until: 40, hook: rush ? rushHook : null });
  return { seed, 35: r.deaths[35] ?? 0, 40: r.deaths[40] ?? 0, maxStage: r.maxStage, minutes: r.seconds / 60 };
}

// Moyenne et intervalle à 95 % (approximation normale) d'une liste.
export function meanCi(xs) {
  const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0;
  return { mean: m, ci: 1.96 * sd / Math.sqrt(n) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const seeds = Number(opt('--seeds', 30)), from = Number(opt('--from', 1)), hours = Number(opt('--hours', 8)), look = Number(opt('--look', 5));
  const run = (old) => {
    const out = [];
    for (let s = from; s < from + seeds; s++) {
      const rush = !args.includes('--guide');
      const r = old ? withSurvival(OLD_SURVIVAL, () => bossDeaths(s, { hours, look, rush })) : bossDeaths(s, { hours, look, rush });
      out.push(r);
      console.error(`${old ? 'avant' : 'après'} graine ${s} : étape max ${r.maxStage} (${r.minutes.toFixed(0)} min), morts étape 35 : ${r[35]}, étape 40 : ${r[40]}`);
    }
    return out;
  };
  const before = args.includes('--after-only') ? null : run(true);
  const after = run(false);
  const rows = [];
  for (const st of [35, 40, 'total']) {
    const pick = (r) => (st === 'total' ? r[35] + r[40] : r[st]);
    const a = after.map(pick), b = before?.map(pick);
    const diff = b ? meanCi(a.map((x, i) => x - b[i])) : null;
    rows.push({ boss: st === 'total' ? 'Les deux' : `${BOSS_STAGES[st]} (étape ${st})`, before: b && { sum: b.reduce((x, y) => x + y, 0), ...meanCi(b) }, after: { sum: a.reduce((x, y) => x + y, 0), ...meanCi(a) }, diff });
  }
  if (args.includes('--json')) console.log(JSON.stringify({ seeds, from, hours, look, rows }));
  else {
    const f = (x) => x.toFixed(2).replace('.', ',');
    console.log(`| Boss | Avant (v10.19) : total / moyenne ± IC95 | Après : total / moyenne ± IC95 | Écart apparié |\n|---|---|---|---|`);
    for (const r of rows) console.log(`| ${r.boss} | ${r.before ? `${r.before.sum} / ${f(r.before.mean)} ± ${f(r.before.ci)}` : '—'} | ${r.after.sum} / ${f(r.after.mean)} ± ${f(r.after.ci)} | ${r.diff ? `${f(r.diff.mean)} ± ${f(r.diff.ci)}` : '—'} |`);
    console.log(`${seeds} graines (${from} à ${from + seeds - 1}), ${hours} h de jeu au plus, regard toutes les ${look} s.`);
  }
}
