// v10.14.1 (lot 4) : tous les textes français des Fêtes du mois qui passent par la traduction (anglais, coréen).
// Données de data/fest.js sur les 24 mois, messages de main.js, écran de la fête, notifications. Utilisé par
// tests/i18n.test.js et tests/i18n-ko.test.js.
import { FEST_MISSION_TYPES, FEST_NAMES, FEST_RULES, RIFT_BLESSINGS, festMonth } from '../../src/data/fest.js';
import { festRecord } from '../../src/core/fest.js';
import { resetLive } from '../../src/core/live.js';
import { createNewState } from '../../src/core/state.js';
import { planNotifications } from '../../src/core/notify-plan.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

// Les 4 notifications de fête (ids 5 à 8), telles que le plan les produit.
export function festNotifications() {
  const out = {};
  const state = () => { resetLive(); return createNewState(at(2027, 1, 20)); };
  for (const n of planNotifications(state(), at(2027, 1, 30))) if (n.id === 5) out[5] = n;
  let s = state();
  let now = at(2027, 2, 5, 10);
  festRecord(s, now).fest.rift = { stock: 0, refill: '2027-02-05', run: null, best: 0, firsts: [] };
  for (const n of planNotifications(s, now)) if (n.id === 6) out[6] = n;
  s = state();
  now = at(2027, 2, 10, 10);
  const rec = festRecord(s, now);
  rec.coins = 40;
  for (const n of planNotifications(s, now)) if (n.id === 7 || n.id === 8) out[n.id] = n;
  // fête du mois sans thème écrit à la main (rotation automatique) : titre « Fête du héros : … »
  s = state();
  for (const n of planNotifications(s, at(2027, 7, 31, 10))) if (n.id === 5 && !out.auto) out.auto = n;
  return Object.values(out).flatMap((n) => [n.title, n.body]);
}

export function festTexts() {
  const out = [];
  for (let i = 0; i < FEST_RULES.monthsAhead; i += 1) {
    const mo = festMonth(i);
    for (const f of [mo.grand, mo.light]) {
      const c = f.currency;
      out.push(f.title, f.tagline, c, ...(f.regions ?? []),
        `${f.title} : ${f.tagline}`, `${f.title} : demain, plus de combats. Récupère tes récompenses !`,
        `Dépense tes ${c} à la boutique : le reste deviendra des éclats.`, `Dépense tes ${c} : encore 1 j 12 h`,
        `+25 % de ${c}`, `✓ +25 % de ${c}`, `Acheter pour 40 ${c}`, `Boutique · ${c}`, `160 ${c} gagnés`, `Tu gardes les 24 ${c} gagnés.`,
        `Étape 5 : +14 ${c}`, `Étape 10 : débloque le World Boss · +74 ${c}`, `Étape 20 : coffre de région · +74 ${c}`,
        `Combat de 60 s · +6 ${c} par tentative, +3 par palier.`,
        `tes ${c} se gagnent sur la Carte, au World Boss, dans la Brèche et avec les missions.`,
        `tes ${c} tombent en jouant (monstres, boss) et avec les missions : elles font avancer le sentier.`,
        `${f.kind === 'grand' ? 'Grande' : 'Petite'} fête · jour 5/14`);
      if (f.featured) out.push(`Carte de ${FEST_NAMES[f.featured]} · 12/30`, `Héros du mois · ${FEST_NAMES[f.featured]}`);
      if (f.hero) out.push(`Gratuits · ${FEST_NAMES[f.hero]} et ${FEST_NAMES[f.pet]}`, `Copie : ${FEST_NAMES[f.hero]}`, `Copie : ${FEST_NAMES[f.pet]}`);
    }
  }
  for (const v of Object.values(FEST_MISSION_TYPES)) out.push(...['1', '600', '6 000', '25'].map((n) => v.label.replace('{n}', n)));
  for (const b of Object.values(RIFT_BLESSINGS)) out.push(b.name, b.text);
  out.push(
    // main.js (festFight, festChain, festBossFinish, festMission, riftStart, riftFight, riftQuit, fin de fête) et ui.js
    'Étape 5 réussie : +14', 'Étape 7 : gardien trop solide', '3 étapes gagnées : +42', '1 étape gagnée : +14', 'Gardien trop solide : renforce le héros',
    'World Boss : 1,5 M dégâts · +12 · record !', 'World Boss : 800 K dégâts · +9', 'Classement de la fête : Top 10 %', 'Classement de la fête : Top 30 %',
    'Classement de la fête : Top 60 %', 'Classement de la fête : Participant', 'Mission réussie : +15', 'Missions : +45', 'Brèche ouverte : palier 1',
    'Palier 3 franchi : +12', 'Brèche refermée au palier 4', 'Palier 2 : gardien trop solide (2 cœurs)', 'Palier 2 : gardien trop solide (1 cœur)',
    'Brèche quittée : 3 paliers, +24', 'Brèche quittée : 1 palier, +8', 'Échange effectué', 'Fin de la fête : monnaie restante convertie en 1,2 K éclats',
    'Échange en cours : les combats sont fermés.', 'Récompense de la fête', 'Récompenses de la fête', 'Boutique de la fête',
    "Reine démone rejoint l'équipe !", 'Lame rose : 2★',
    // écran de la fête
    'Grande fête', 'Petite fête', 'Fête', 'échange', '⏳ 10 j 13 h', '⏳ 5 h', '🔁 Échange · 1 j 12 h', '⏳ encore 10 j 13 h', "puis 2 jours d'échange",
    'Missions du jour : elles changent à minuit · 4 h 12', "Les missions sont fermées pendant l'échange.", 'Gardien niv. 3-5 ×2', 'Gardien du palier 1 : niv. 9-4 ×2',
    'combat de 30 s', '3 faites ▸', '1 faite ▾', 'Reste 3/5', 'il manque 40', 'Faite ✓', 'Épuisé', 'Dernière chance', 'Entrer dans la fête', 'Entrer (1 entrée)',
    'Quitter​', 'Quitter la Brèche ?', '2 à faire', '3 à récupérer', '12/30 étapes', '1 / 3 obtenus', '10 invocations', 'Jalons :', "Jalons d'invocation",
    "Jalons de la fête : 35 sur 50. Ouvrir l'Aventure de la fête", "Libère l'étape 10 ›", 'Palier 3 franchi : choisis une bénédiction', '2 sur 3', '4 entrées sur 6',
    '3 cœurs', 'Palier 3/10', '10 paliers · 1 bénédiction par victoire', '2 par jour · record 6/10', 'Étape 12', 'Étape 30 : fragment Légendaire universel',
    'Étape 10 : World Boss · étape 30 : fragment Légendaire universel', 'Les 10 paliers', 'Carte terminée : bravo !', '+12 · gagné dans cette course : 18',
    'Victoire :', 'Palier atteint', 'Nouveau record', 'Bilan de la tentative', 'Titan verrouillé', "Plus d'entrée aujourd'hui", 'Prêt à entrer ?',
    'Brèche', 'Sentier', 'Brèche de la fête', 'Brèche terminée', 'Encore une fois (1 entrée)', 'Bénédictions prises', 'Première fois', 'Première fois au palier 5',
    'Fermé pendant l\'échange.', 'Fermée pendant l\'échange.', 'Mettre dans l\'équipe ›', '✓ Région libérée', 'Dernier jour',
    'Ticket permanent', 'Fragment Légendaire', "Pierres d'ascension", "Universel : n'importe quel héros Légendaire", 'Héros gratuit', 'Familier gratuit',
    'Héros gratuit de la fête', 'Familier gratuit de la fête', 'Limitée', 'Permanente', 'Missions de la fête', 'Mode de la fête', 'Du jour et de la fête',
    'Héros et familier gratuits', 'Échange de fin de fête', 'World Boss de la fête', 'Le World Boss est fermé pour cette fête.', 'Tentatives', 'Gagné',
    'Comment ça marche ?', 'Rythme', 'Monnaie', "la grande fête dure 14 jours, puis 2 jours d'échange, puis la petite fête du mois.",
    "les 2 derniers jours, les combats sont fermés et la boutique reste ouverte.", 'ce qui reste à la fin devient des éclats (10 par pièce). Tu ne perds rien.',
    "la petite fête dure jusqu'à l'échange des 2 derniers jours du mois.", "les 2 derniers jours, il ne reste que la boutique.",
    "Ce qui reste à la fin de l'échange devient des éclats (10 par Pétales).", '· ce qui reste à la fin devient des éclats (10 par Pétales).',
    'Combats fermés, boutique ouverte. Le reste devient des éclats.',
    'Combats, boss et missions sont fermés. Dépense ta monnaie : ce qui reste à la fin sera converti en éclats (10 par pièce).',
    'La monnaie tombe en jouant (monstres et boss, 25 par jour au plus) et avec les missions. Dépenser ne fait pas reculer sur le sentier.',
    '×1 : 1 ticket de compagnon', '×10 : 10 tickets de compagnon');
  out.push(...festNotifications());
  return [...new Set(out)];
}
