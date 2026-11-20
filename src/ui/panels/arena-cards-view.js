// v10.1 (P4) : écran de l'Arène à cartes — tour des étages, formation 2×3, plateau de combat rejoué.
import { CARD_ARENA as A } from '../../data/arena-floors.js';
import { COMPANIONS } from '../../data/companions.js';
import { GOLD_BACK_FLOOR, arenaCal, cardArena, cardOf, chestsReady, floorCards, floorName, formationCards, hasGoldBack, isBossFloor, isGuardianFloor, sweepsLeft, totalStars } from '../../core/arena-cards.js';
import { cardHtml } from '../card.js';
import { ruleArt, ruleDup, ruleName } from '../arena-map.js';
import { escapeHtml, formatNumber, img, rewardIcons } from '../common.js';
// v10.3 (audit) : l'image d'une carte ennemie vient de la carte elle-même (core/arena-cards.js › floorCards). Avant,
// elle était recalculée ici d'après la CASE de la carte et non son rang : le nom et l'image ne correspondaient plus
// (« Loup des neiges » sur un gluant), et le gardien prenait l'image du boss du monde au lieu de la sienne.
export const foeArt = (card) => card.sprite ?? (card.boss ? 'icon_boss' : 'icon_skull');
// Cadre d'une carte ennemie : gardien en Légendaire, boss en Épique, monstre en Commun.
const foeCard = (x) => ({ ...x, rarity: x.guardian ? 'legendary' : x.boss ? 'epic' : 'common' });

const stars = (n) => `<span class="dg-stars">${'★'.repeat(n)}<i>${'★'.repeat(3 - n)}</i></span>`;

function formationHtml(ui, state) {
  const c = cardArena(state);
  const sel = ui.view.cardSlot;
  const slot = (pos) => {
    const id = c.formation[pos];
    const card = id ? { ...cardOf(state, id), pos } : null;
    return `<div class="cf-slot${sel === pos ? ' on' : ''}" data-action="card-slot" data-value="${pos}">${card ? cardHtml(card, { small: true, back: hasGoldBack(state) ? 'gold' : '' }) : '<span class="cf-empty">+</span>'}</div>`;
  };
  const picker = sel == null ? '' : `<div class="cf-pick"><div class="row-between"><b>Choisis une carte pour la case ${sel < 3 ? 'devant' : 'derrière'}</b><button class="btn small" data-action="card-place" data-value="">Vider la case</button></div>
    <div class="cf-pick-grid">${COMPANIONS.filter((x) => state.companions.owned[x.id]).map((x) => cardOf(state, x.id)).filter(Boolean)
      .map((card) => `<div class="cf-pick-item${c.formation.includes(card.id) ? ' used' : ''}">${cardHtml(card, { small: true, action: 'card-place', value: card.id })}</div>`).join('')}</div></div>`;
  // v10.3 (audit) : le dos de carte doré promis à l'étage 25 est réellement donné — pastille ici, cartes retournées au début de chaque combat.
  const gold = hasGoldBack(state) ? '<span class="cf-backchip" title="Gagné en battant le gardien de l\'étage 25"><img class="px" src="assets/ui/art101/card_back_gold.png" alt=""> Dos de carte doré</span>' : '';
  return `<div class="card cf-card"><div class="row-between"><b>Formation</b>${gold}<span><button class="btn small" data-action="card-auto">Placement auto</button></span></div>
    <div class="cf-rows"><small>Devant</small><div class="cf-row">${[0, 1, 2].map(slot).join('')}</div><small>Derrière</small><div class="cf-row">${[3, 4, 5].map(slot).join('')}</div></div>
    <div class="muted small">Devant : encaisse. Derrière : protégé tant que l'avant tient. L'assassin ennemi vise l'arrière. ${c.formation.filter(Boolean).length}/${A.teamMax} cartes.</div>${picker}</div>`;
}

export function cardTowerHtml(ui, state) {
  const fresh = !cardArena(state).cal;
  const cal0 = arenaCal(state); void cal0; // v10.2 (2.2) : à la première ouverture, formation placée automatiquement
  const c = cardArena(state);
  // Bulle de première ouverture (une seule fois).
  if (fresh || !(state.ui.hints ?? []).includes('arena-formation')) { (state.ui.hints ??= []).push('arena-formation'); ui.view.arenaTip = true; }
  const tip = ui.view.arenaTip ? ('<div class="card ct-tip">✨ <b>Ta formation est prête</b> : les cartes devant encaissent, celles derrière frappent. Touche une case pour la changer.</div>') : '';
  const next = Math.min(c.best + 1, 100000);
  const f = Math.max(1, Math.min(next, Number(ui.view.cardFloor) || next));
  const setup = floorCards(f, arenaCal(state));
  const team = formationCards(state);
  const tags = `${isGuardianFloor(f) ? '<span class="tag gold-text">Gardien</span>' : isBossFloor(f) ? '<span class="tag bad">Boss</span>' : ''}`;
  const near = Array.from({ length: 7 }, (_, i) => next - 3 + i).filter((x) => x >= 1 && x <= next).map((x) =>
    `<button class="ct-floor${x === f ? ' on' : ''}${isBossFloor(x) ? ' boss' : ''}${isGuardianFloor(x) ? ' guard' : ''}" data-action="card-floor" data-value="${x}"><b>${x}</b>${stars(c.stars[x] ?? 0)}</button>`).join('');
  const chest = chestsReady(state);
  const season = A.seasonRewards.map((m) => `<button class="btn small${c.season.claimed.includes(m.floor) ? ' done' : ''}" data-action="card-season" data-value="${m.floor}" ${c.season.best >= m.floor && !c.season.claimed.includes(m.floor) ? '' : 'disabled'}>Étage ${m.floor} ${rewardIcons(m.reward)}</button>`).join('');
  const first = f > c.best ? A.firstReward(f) : null;
  // v10.2 (2.4) : règle de l'étage en bandeau illustré, aperçu du dos de carte du premier gardien.
  const ruleBanner = setup.rule ? `<div class="ct-rule">${ruleArt(setup.rule.id) ? `<img class="px" src="${ruleArt(setup.rule.id)}" alt="">` : ''}<div>${ruleDup(setup.rule) ? `<b>${escapeHtml(setup.rule.text)}</b>` : `<b>${escapeHtml(ruleName(setup.rule.id))}</b><small>${escapeHtml(setup.rule.text)}</small>`}</div></div>` : '';
  const back = f === GOLD_BACK_FLOOR || (f < GOLD_BACK_FLOOR && f >= 20) ? `<div class="ct-back${hasGoldBack(state) ? ' won' : ''}"><img class="px" src="assets/ui/art101/card_back_gold.png" alt=""><span>${hasGoldBack(state) ? '✔ Gardien vaincu : ta formation porte le <b>dos de carte doré</b>.' : 'Gardien de l\'étage 25 vaincu : <b>dos de carte doré</b> pour toute ta formation.'}</span></div>` : '';
  return `${tip}<div class="ct-head"><span>${stars(3).replace(/<i>.*<\/i>/, '')} <b class="num">${totalStars(state)}</b> étoiles</span>
      <button class="btn ${chest > 0 ? 'btn-gold' : ''} small" data-action="card-chest" ${chest > 0 ? '' : 'disabled'}>${img('icon_chest')} Coffre d'étoiles${chest > 0 ? ` (${chest})` : ` · ${A.chestEvery - (totalStars(state) % A.chestEvery)} ★ encore`}</button>
      <span class="muted">Balayages : <b>${sweepsLeft(state)}</b>/${A.sweepsPerDay}</span></div>
    <div class="ct-floors">${near}</div>
    <div class="card ct-floor-card"><div class="row-between"><b>${escapeHtml(floorName(f))}</b>${stars(c.stars[f] ?? 0)}</div>${ruleBanner}<div class="ct-tags">${tags}</div>${back}
      <div class="ct-foes">${setup.cards.map((x) => cardHtml(foeCard(x), { small: true, foe: true })).join('')}</div>
      ${first ? `<div>Premier passage : ${rewardIcons(first, 'named')}</div>` : ''}
      <div class="muted small">3 ★ : gagner sans perdre de carte en moins de ${A.star3} s. Essais illimités.</div></div>
    ${formationHtml(ui, state)}
    <div class="card"><b>Saison</b> <span class="muted">meilleur étage : ${c.season.best}</span><div class="ct-season">${season}</div></div>
    <div class="ct-go"><button class="btn btn-gold primary-action" data-action="card-fight" data-value="${f}" ${team.length ? '' : 'disabled'}>${team.length ? `⚔ Combattre · ${escapeHtml(floorName(f))}` : 'Place au moins 1 carte'}</button>
      ${(c.stars[f] ?? 0) >= 3 ? `<button class="btn" data-action="card-sweep" data-value="${f}" ${sweepsLeft(state) > 0 ? '' : 'disabled'}>⚡ Balayer</button>` : ''}</div>`;
}

// Plateau rejoué (dans une fenêtre) : les cartes perdent leurs PV au fil des événements, l'attaquant s'avance.
export function playBoard(ui, run) {
  const side = (list, foe) => `<div class="cb-side${foe ? ' foe' : ''}">${[0, 1].map((r) => `<div class="cb-row">${[0, 1, 2].map((col) => {
    const pos = (foe ? 1 - r : r) * 3 + col; // les deux rangées de devant se font face
    const card = list.find((x) => x.pos === pos);
    return `<div class="cb-cell">${card ? cardHtml(foe ? foeCard(card) : card, { small: true, foe }) : ''}</div>`;
  }).join('')}</div>`).join('')}</div>`;
  ui.openModal(`<div class="cb-board"><h2 id="modal-title">${escapeHtml(floorName(run.floor))}</h2>
    ${side(run.setup.cards, true)}<div class="cb-mid"><span class="cb-time">0 s</span></div>${side(run.team, false)}
    <div class="cb-end hidden"></div><div class="detail-actions"><button class="btn" data-action="card-skip">Passer ⏭</button></div></div>`);
  const root = ui.$('modal-card');
  const hp = { ally: Object.fromEntries(run.team.map((x) => [x.pos, x.maxHp])), foe: Object.fromEntries(run.setup.cards.map((x) => [x.pos, x.maxHp])) };
  const max = { ally: Object.fromEntries(run.team.map((x) => [x.pos, x.maxHp])), foe: Object.fromEntries(run.setup.cards.map((x) => [x.pos, x.maxHp])) };
  const el = (s, pos) => root.querySelector(`.cb-side${s === 'foe' ? '.foe' : ':not(.foe)'} .pcard[data-pos="${pos}"]`);
  const speed = Math.max(1, run.seconds / 14);
  let i = 0; const t0 = performance.now();
  const finish = () => {
    clearInterval(ui.cardTimer);
    const end = root.querySelector('.cb-end');
    if (!end) return;
    end.classList.remove('hidden');
    end.innerHTML = run.won ? `<b class="good">Victoire !</b> ${stars(run.stars)}${run.reward ? ` ${rewardIcons(run.reward, 'named')}` : ''}` : `<b class="bad">Défaite</b><div class="muted">Change la formation (gardien devant, soigneur derrière) et réessaie : essais illimités.</div>`;
    const btn = root.querySelector('[data-action="card-skip"]'); if (btn) { btn.textContent = 'Fermer'; btn.dataset.action = 'close-modal'; }
    for (const s of ['ally', 'foe']) for (const pos of Object.keys(hp[s])) { const e = el(s, pos); const end2 = s === 'ally' ? run.end.allies : run.end.foes; const v = end2.find((x) => String(x.pos) === pos); if (e && v) { e.querySelector('.pc-hp i').style.width = `${(v.hp / v.maxHp) * 100}%`; e.classList.toggle('down', v.hp <= 0); } }
  };
  ui.cardSkip = finish;
  clearInterval(ui.cardTimer);
  ui.cardTimer = setInterval(() => {
    if (!root.isConnected) return clearInterval(ui.cardTimer);
    const t = ((performance.now() - t0) / 1000) * speed;
    const tm = root.querySelector('.cb-time'); if (tm) tm.textContent = `${Math.min(run.seconds, Math.round(t))} s`;
    while (i < run.events.length && run.events[i].t <= t) {
      const e = run.events[i++];
      const target = e.side === 'ally' ? 'foe' : 'ally';
      if (['hit', 'skill', 'splash', 'ulthit'].includes(e.kind)) {
        hp[target][e.to] = Math.max(0, hp[target][e.to] - e.d);
        const te = el(target, e.to); if (te) { te.querySelector('.pc-hp i').style.width = `${(hp[target][e.to] / max[target][e.to]) * 100}%`; te.classList.remove('struck'); void te.offsetWidth; te.classList.add('struck'); }
        const ae = el(e.side, e.from); if (ae) { ae.classList.remove('lunge'); void ae.offsetWidth; ae.classList.add('lunge'); }
      } else if (e.kind === 'fall') { const fe = el(e.side, e.pos); if (fe) fe.classList.add('down'); }
      else if (e.kind === 'ult') { const ae = el(e.side, e.from); if (ae) { ae.classList.remove('ult'); void ae.offsetWidth; ae.classList.add('ult'); } }
    }
    if (i >= run.events.length && t >= run.seconds) finish();
  }, 50);
}
