// v10.3 (partie 10) : simulation du Bastion sur 7 jours, 2 connexions par jour.
// Vrai moteur (createCombat / step), vraies actions du jeu, vrais gains hors ligne entre deux connexions.
//  1. Une partie neuve suit le Sceau (core/guide.js) jusqu'à l'ouverture du Bastion (étape 40).
//  2. De là, des parties identiques jouent 7 jours (2 connexions par jour, gains hors ligne entre les deux) :
//     « campagne » n'ouvre jamais le Bastion ; les parties « bastion » posent leurs ouvriers, lancent chantiers,
//     recherches et commandes à chaque connexion et renforcent leurs objets jusqu'au plafond relevé par la Forge du
//     forgeron. Quatre profils : « équilibre » donne au Bastion 30 % de l'or qu'il a en se connectant (le reste va
//     aux améliorations du héros) ; les trois autres lui donnent 100 % de cet or (le pire cas pour la borne : leur
//     campagne avance bien moins) — sans économiser, en économisant pour la Forge du forgeron, ou les recherches d'abord.
//  3. Mesure (computeHeroStats(state).combatPower) :
//     - campagne : puissance de la partie « campagne » au jour 7 ÷ puissance à l'ouverture du Bastion ;
//     - Bastion : puissance d'une partie « bastion » au jour 7 ÷ la même partie sans ses recherches ni ses
//       renforcements au-delà du plafond de base (ce que le Bastion apporte par lui-même) ; la borne vaut pour les
//       deux profils ;
//     - pour information : l'étape atteinte par chaque partie (l'or donné au Bastion ne va pas aux améliorations).
// Objectif (docs/plan-v1030.md, 10.6) : Bastion ≤ +25 %, campagne ≥ +200 %.
// Usage : node tools/sim-bastion.mjs [seed = 1] [--days 7] [--session 20] [--json fichier] [--log] [--noise]
import { writeFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { createCombat } from '../src/core/combat.js';
import { companionById } from '../src/core/companions.js';
import { computeHeroStats } from '../src/core/stats.js';
import { Rng } from '../src/core/rng.js';
import { BUILDINGS, RESEARCH } from '../src/data/bastion.js';
import { bastionLevel, bastionOf, forgeLevel, researchLevel, tradeOf } from '../src/core/bastion.js';
import { HOUR, T0, connection, play, withoutBastion } from './sim-lib.mjs';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : d; };
const seed = Number(args.find((a) => /^\d+$/.test(a) && args[args.indexOf(a) - 1]?.startsWith('--') !== true)) || 1;
const DAYS = opt('--days', 7);
const SESSION = opt('--session', 20);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

// 1. Jusqu'à l'ouverture du Bastion.
const base = { state: createNewState(T0, seed), rng: new Rng(seed * 97), log: [] };
base.world = createCombat(base.state);
base.stop = (s) => Math.max(s.maxStage, s.records.bestStage ?? 1) >= 40;
const warm = play(base, 40 * 3600, T0);
const start = T0 + Math.ceil(warm) * 1000;
const P0 = computeHeroStats(base.state).combatPower;
console.log(`Ouverture du Bastion : étape ${base.state.maxStage} après ${(warm / 3600).toFixed(1)} h de jeu · puissance ${P0} · compagnons ${Object.keys(base.state.companions.owned).length} (alliés : ${Object.keys(base.state.companions.owned).filter((id) => companionById(id)?.kind === 'ally').length}) · éclats ${base.state.materials.shards}`);

// 2. Parties jumelles pendant 7 jours.
function run(withBastion, share = 0, prefer = 'forge', twist = 0) {
  const sim = {
    state: structuredClone(base.state), rng: new Rng(seed * 97 + 1 + twist), withBastion, share, prefer, purse: 0, log: [], last: 0, day: 0, reserve: 0,
    spent: { builds: 0, orders: 0, upgrades: 0, research: 0 }, gained: {}, extra: {}, goldKills: [],
  };
  sim.world = createCombat(sim.state);
  const name = withBastion ? `bastion ${Math.round(share * 100)} % ${prefer}` : 'campagne';
  for (let d = 0; d < DAYS; d++) {
    sim.day = d + 1;
    for (const h of [0, 12]) connection(sim, start + (d * 24 + h) * HOUR, SESSION);
    const st = sim.state;
    console.log(`${name.padEnd(24)} J${d + 1} : étape ${st.maxStage} · puissance ${computeHeroStats(st).combatPower.toExponential(2)} · éclats ${st.materials.shards}`
      + (withBastion && bastionOf(st) ? ` · Forge ${forgeLevel(st)} · Bastion ${bastionLevel(st)} · recherches ${RESEARCH.map((r) => researchLevel(st, r.id)).reduce((a, b) => a + b, 0)}` : ''));
  }
  return sim;
}
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} %`;
function report(B, PA) {
  const PB = computeHeroStats(B.state).combatPower;
  return {
    share: B.share, prefer: B.prefer, stage: B.state.maxStage, power: PB,
    own: PB / computeHeroStats(withoutBastion(B)).combatPower - 1,
    ownResearch: PB / computeHeroStats(withoutBastion(B, { upgrades: false })).combatPower - 1,
    ownUpgrades: PB / computeHeroStats(withoutBastion(B, { research: false })).combatPower - 1,
    versusCampaign: PB / PA - 1,
    forge: forgeLevel(B.state), level: bastionLevel(B.state),
    buildings: Object.fromEntries(BUILDINGS.filter((x) => !x.existing).map((x) => [x.id, B.state.bastion?.buildings?.[x.id]?.level ?? 0])),
    research: Object.fromEntries(RESEARCH.map((r) => [r.id, researchLevel(B.state, r.id)]).filter(([, v]) => v)),
    extraUpgrades: Object.values(B.state.equipment).reduce((t, i) => t + (B.extra[i?.id]?.length ?? 0), 0),
    shardsSpent: B.spent, mined: B.gained, goldKillsAtConnection: B.goldKills,
    workers: Object.fromEntries(Object.entries(B.state.bastion?.buildings ?? {}).filter(([, v]) => v.worker).map(([k, v]) => [k, `${v.worker} (${tradeOf(v.worker)})`])),
  };
}
const A = run(false);
const PA = computeHeroStats(A.state).combatPower;
// --noise : la même partie « campagne » avec d'autres tirages au sort, pour mesurer la part du hasard dans l'étape atteinte.
const twins = args.includes('--noise') ? [run(false, 0, 'forge', 1000), run(false, 0, 'forge', 2000)].map((t) => t.state.maxStage) : null;
const sims = [run(true, 0.3, 'équilibre'), run(true, 1, 'équilibre'), run(true, 1, 'forge'), run(true, 1, 'recherche')];
const profiles = sims.map((B) => report(B, PA));
const result = {
  seed, days: DAYS, sessionMinutes: SESSION,
  opening: { stage: base.state.maxStage, hours: warm / 3600, power: P0 },
  campaign: { stage: A.state.maxStage, power: PA, gain: PA / P0 - 1, goldKillsAtConnection: A.goldKills },
  bastion: profiles,
};
if (args.includes('--log')) for (const B of sims) console.log(`--- journal « bastion ${Math.round(B.share * 100)} % ${B.prefer} »\n${B.log.join('\n')}`);
console.log('\n=== Bilan sur', DAYS, 'jours, 2 connexions de', SESSION, 'min par jour (seed', seed, ') ===');
console.log(`Campagne seule : étape ${result.opening.stage} → ${result.campaign.stage}, puissance ${pct(result.campaign.gain)} (objectif : au moins +200 %)`);
console.log(`Or à chaque connexion, en ennemis de l'étape max : ${A.goldKills.join(', ')}`);
if (twins) console.log(`Part du hasard : la même partie « campagne », autres tirages → étapes ${twins.join(' et ')} (au lieu de ${result.campaign.stage})`);
for (const r of profiles) {
  console.log(`\nBastion, ${Math.round(r.share * 100)} % de l'or, profil « ${r.prefer} » : ${pct(r.own)} de puissance par lui-même (objectif : au plus +25 %)`);
  console.log(`  dont recherches ${pct(r.ownResearch)} · renforcements au-delà du plafond de base ${pct(r.ownUpgrades)} (${r.extraUpgrades} niveaux sur les objets portés)`);
  console.log(`  Forge niv. ${r.forge} · Bastion niv. ${r.level} ${JSON.stringify(r.buildings)} · recherches ${JSON.stringify(r.research)}`);
  console.log(`  éclats : chantiers ${r.shardsSpent.builds}, commandes ${r.shardsSpent.orders}, renforcements ${r.shardsSpent.upgrades} · produits : ${JSON.stringify(r.mined)} · ouvriers ${JSON.stringify(r.workers)}`);
  console.log(`  pour information : étape ${r.stage} atteinte (campagne seule : ${result.campaign.stage}${twins ? `, ou ${twins.join(' et ')} avec d'autres tirages` : ''} ; l'écart vient du hasard et de l'or donné au Bastion)`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 2));
const ok = profiles.every((r) => r.own <= 0.25) && result.campaign.gain >= 2;
console.log(ok ? '\n✔ bornes tenues' : '\n✘ bornes NON tenues');
process.exit(ok ? 0 : 1);
