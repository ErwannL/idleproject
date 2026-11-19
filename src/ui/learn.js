// v10.1 (P1 §2.1) : apprendre le jeu en images.
//  - « Comment jouer » : 3 cartes illustrées (le héros combat seul, l'or le rend plus fort, avancer et battre le boss),
//    affichées une seule fois par-dessus la scène pendant que le jeu tourne ; rouvrables dans ☰ › Aide.
//  - Ordre d'apprentissage fixe : une notion par étape, chacune avec sa carte de déblocage (illustration, « à quoi ça
//    sert », « ce que ça rapporte », « Essayer maintenant »). Une seule carte à la fois ; gardé dans state.ui.learned.
import { escapeHtml } from './common.js';
import { RESOURCES } from '../data/glossary.js';

export const HOWTO = [
  { art: 'assets/ui/art101/howto_fight.png', title: 'Ton héros combat seul', text: 'Il avance et frappe tout seul. Chaque monstre vaincu donne de l\'or.' },
  { art: 'assets/ui/art101/howto_gold.png', title: 'L\'or te rend plus fort', text: 'Dépense-le dans Héros › Améliorations : les monstres tombent plus vite.' },
  { art: 'assets/ui/art101/howto_advance.png', title: 'Avance et bats le boss', text: 'Chaque étape finit par un boss. Bats-le pour débloquer la suite.' },
];

// Notion → étape où elle arrive, écran, illustration, à quoi ça sert, ce que ça rapporte.
export const LEARN = [
  { id: 'upgrades', stage: 1, tab: 'upgrades', art: 'assets/ui/art101/banner_upgrades.png', title: 'Améliorations', what: 'Dépense ton or pour augmenter tes Dégâts et ta Vie.', gain: 'Les monstres tombent plus vite, tu avances plus loin.' },
  { id: 'inventory', stage: 2, tab: 'inventory', art: 'assets/ui/art101/mis_items.png', title: 'Équipement', what: 'Les monstres laissent des objets : équipe les meilleurs.', gain: 'Chaque objet ajoute de la puissance à ton héros.' },
  { id: 'skills', stage: 4, tab: 'skills', art: 'assets/ui/art101/banner_skills.png', title: 'Compétences', what: 'Chaque niveau donne un point : apprends des sorts.', gain: 'Ton héros les lance tout seul en combat.' },
  { id: 'lootbag', stage: 6, tab: null, art: 'assets/ui/art101/mis_recycle.png', title: 'Le sac de butin', what: 'Le butin s\'entasse dans le sac, au sol : trie-le d\'un appui.', gain: 'Le meilleur est équipé, le reste devient des éclats.' },
  { id: 'summon', stage: 8, tab: 'summon', art: 'assets/ui/art98/summon_circle.png', title: 'Compagnons', what: 'Invoque des compagnons avec tes gemmes.', gain: 'Ils combattent à tes côtés, chacun avec ses sorts.' },
  { id: 'forge', stage: 10, tab: 'forge', art: 'assets/ui/art98/forge_hall.png', title: 'Forge', what: 'Recycle les objets inutiles en éclats.', gain: 'Les éclats renforcent tes objets préférés.' },
  { id: 'contracts', stage: 15, tab: 'contracts', art: 'assets/ui/art101/banner_missions.png', title: 'Missions', what: 'Des objectifs du jour et de la semaine.', gain: 'Des gemmes et des clés à chaque mission faite.' },
  { id: 'tower', stage: 25, tab: 'tower', art: 'assets/ui/art98/arena.png', title: 'Défis et Arène', what: 'La Tour, le Défi de la semaine et l\'Arène à cartes.', gain: 'Des récompenses à chaque étage franchi.' },
  { id: 'dungeons', stage: 30, tab: 'dungeons', art: 'assets/ui/art101/banner_dungeons.png', title: 'Donjons', what: 'Une clé ouvre un donjon : quelques salles et un boss.', gain: 'Objets d\'ensemble, grimoires et pierres.' },
];

const learned = (st) => (st.ui.learned ??= []);

export function showHowTo(ui, i = 0) {
  const host = ui.$('stage-area');
  if (!host) return;
  host.querySelector('.howto-card')?.remove();
  const c = HOWTO[i];
  const el = document.createElement('div');
  el.className = 'howto-card';
  el.innerHTML = `<img class="px" src="${c.art}" alt=""><div class="howto-body"><small>${i + 1} / ${HOWTO.length}</small><b>${escapeHtml(c.title)}</b><p>${escapeHtml(c.text)}</p>
    <button class="btn btn-gold" type="button">${i < HOWTO.length - 1 ? 'Suivant' : 'Compris'}</button></div>`;
  el.querySelector('button').addEventListener('click', () => {
    el.remove();
    if (i < HOWTO.length - 1) showHowTo(ui, i + 1);
    else if (ui.state?.ui) { const h = (ui.state.ui.hints ??= []); if (!h.includes('howto')) h.push('howto'); ui.howtoOpen = false; }
  });
  host.appendChild(el);
  ui.howtoOpen = true;
}

// Carte de déblocage de la prochaine notion atteinte (une à la fois, jamais par-dessus une fenêtre ou une bulle).
export function maybeLearnCard(ui, st) {
  if (!st?.ui || ui.howtoOpen || typeof document === 'undefined') return;
  if (document.querySelector('.learn-card, .howto-card, #prologue, #modal:not(.hidden), .tour, .cinematic')) return;
  if (st.unlocks?.legacy) return; // ancienne partie : tout est déjà connu
  const stage = st.records?.bestStage ?? st.maxStage ?? 1;
  const L = LEARN.find((x) => stage >= x.stage && !learned(st).includes(x.id));
  if (!L) return;
  learned(st).push(L.id);
  const host = ui.$('stage-area');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'learn-card';
  el.innerHTML = `<img class="px" src="${L.art}" alt=""><div class="howto-body"><small>Nouveau</small><b>${escapeHtml(L.title)}</b>
    <p><b>À quoi ça sert :</b> ${escapeHtml(L.what)}</p><p><b>Ce que ça rapporte :</b> ${escapeHtml(L.gain)}</p>
    <div class="row-between"><button class="btn btn-gold" type="button" data-go>Essayer maintenant</button><button class="btn small" type="button" data-close>Plus tard</button></div></div>`;
  el.querySelector('[data-close]').addEventListener('click', () => el.remove());
  el.querySelector('[data-go]').addEventListener('click', () => {
    el.remove();
    if (L.id === 'lootbag') ui.lootBag?.toggle?.(true);
    else if (L.tab) ui.openTab(L.tab);
  });
  host.appendChild(el);
}

// v10.1 (P1 §2.3) : quantité d'une ressource (même source que la carte de glossaire).
export function resourceAmount(st, key) {
  if (key === 'tickets') return st?.wallet?.ticketLimited ?? 0;
  if (['gold', 'gems', 'keys', 'fragments'].includes(key)) return st?.[key] ?? 0;
  return st?.materials?.[key] ?? 0;
}
// Première fois qu'une ressource arrive (hors or, montré par le prologue) : une bulle, une seule fois par ressource.
export function firstResourceBubble(ui, st) {
  if (!st?.ui || typeof document === 'undefined' || document.querySelector('.res-bubble, .howto-card, #prologue')) return;
  const seen = (st.ui.seenRes ??= []);
  for (const key of Object.keys(RESOURCES)) {
    if (key === 'gold' || seen.includes(key) || !(resourceAmount(st, key) > 0)) continue;
    seen.push(key);
    if (st.unlocks?.legacy) continue;
    const r = RESOURCES[key];
    const el = document.createElement('div');
    el.className = 'res-bubble'; el.dataset.gloss = key;
    el.innerHTML = `<b>Nouveau : ${escapeHtml(r.name)}</b><span>${escapeHtml(r.use)}</span><small>Touche pour en savoir plus</small>`;
    el.addEventListener('click', () => { el.remove(); ui.glossCard?.(key); });
    (ui.$('stage-area') ?? document.body).appendChild(el);
    setTimeout(() => el.remove(), 8000);
    return;
  }
}
