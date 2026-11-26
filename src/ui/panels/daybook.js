// v9.8 (H1, G1-G3) : Carnet du jour — grandes cartes illustrées (grosse icône, chiffre, barre épaisse), tampon doré
// « Accompli » sur chaque carte finie, grand tampon « Journée accomplie » et coffre de fin de journée qui tremble quand
// il est prêt. Il regroupe Missions du jour et objectifs de session (plus d'écran en plus). Rien ne bouge avec
// « Réduire les animations » (on garde l'image finale).
import { DAYBOOK_CHEST, dormantResources, daybookComplete, daybookOf, daybookTasks } from '../../core/daybook.js';
import { escapeHtml, img, rewardIcons } from '../common.js';
import { FIRST_WEEK_MILES, FIRST_WEEK_PRIZE, firstWeekActive, firstWeekDay, firstWeekDaysLeft, firstWeekDaysOpen, firstWeekPoints, prizeReady } from '../../core/first-week.js';
import { companionById } from '../../core/companions.js';
import { companionStill } from './expeditions.js';
import { bastionDaybookLine } from '../../core/bastion.js'; // v10.3 (10.6)
import { mBar, mBtn, mBtnGold, mChip } from '../mobile-kit.js'; // v10.12
import { esc, mpFrame, mpRow, mpSec } from './profile-m.js';
import { objectivesParts } from './contracts.js'; // v10.16 (B1)
import { heroPathQuest } from '../hud-quests.js'; // v10.16 (B1)
const isMPhone = () => true; // v10.13 : le PC emploie le même kit que le téléphone (desk-activities.css)

// v9.8 (H5) : carnet des 7 premiers jours, en tête du Carnet du jour ; le gros lot (Épique au choix) visible dès le jour 1.
function firstWeekHtml(ui, state) {
  if (!firstWeekActive(state)) return '';
  const open = firstWeekDaysOpen(state);
  const sel = Math.min(open, Math.max(1, Number(ui.view.fwDay) || open));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = i + 1, info = firstWeekDay(state, d), ready = d <= open && !info.claimed && info.steps.every((x) => x.done);
    return `<button class="fw-day${d === sel ? ' on' : ''}${info.claimed ? ' done' : ''}${ready ? ' ready' : ''}" data-action="fw-day" data-value="${d}" ${d > open ? 'disabled' : ''}>J${d}${d > open ? ' 🔒' : info.claimed ? ' ✓' : ''}</button>`;
  }).join('');
  const day = firstWeekDay(state, sel);
  const all = day.steps.every((x) => x.done);
  // v9.9 (K9) : missions finies en haut, en doré.
  const steps = [...day.steps].sort((a, b) => b.done - a.done).map((x) => `<li class="${x.done ? 'fw-done' : ''}">${x.done ? '✓' : '○'} ${escapeHtml(x.text)}</li>`).join('');
  const pts = firstWeekPoints(state);
  const got = state.firstWeek?.miles ?? [];
  const track = `<div class="fw-track"><i style="width:${Math.min(100, (pts / 21) * 100)}%"></i>${FIRST_WEEK_MILES.map((m) => `<span class="fw-mile${got.includes(m.at) ? ' got' : pts >= m.at ? ' ready' : ''}" style="left:${(m.at / 21) * 100}%">${rewardIcons(m.reward)}<small>${m.at}</small></span>`).join('')}</div>`;
  const prize = FIRST_WEEK_PRIZE.map((id) => { const c = companionById(id); return `<button class="fw-prize-c" ${prizeReady(state) ? `data-action="fw-prize" data-value="${id}"` : 'disabled'} title="${escapeHtml(c?.name ?? id)}">${c ? companionStill(c) : ''}<small>${escapeHtml(c?.name ?? id)}</small></button>`; }).join('');
  return `<div class="card fw-card"><div class="fw-head"><b>Carnet de l'Apprenti</b><span class="muted">Gros lot : un compagnon Épique au choix · ${firstWeekDaysLeft(state)} j restants</span></div>
    ${track}
    <button class="btn btn-gold fw-all" data-action="fw-all">Tout récupérer</button>
    <div class="fw-days">${days}</div>
    <ul class="fw-steps">${steps}</ul>
    <div class="fw-claim">${rewardIcons(day.reward, 'named')} ${day.claimed ? '<span class="good">Récupéré ✓</span>' : `<button class="btn ${all ? 'btn-gold' : ''}" data-action="fw-claim" data-value="${sel}" ${all ? '' : 'disabled'}>Récupérer</button>`}</div>
    <div class="fw-prize">${prize}</div>${prizeReady(state) ? '<p class="gold-text">Les 7 jours sont finis : choisis ton compagnon !</p>' : ''}</div>`;
}

// v10.12 : Carnet sur téléphone — cartes sombres du kit, barre 0/8 et coffre du jour en tête, « Y aller » secondaire,
// un seul bouton doré (le coffre quand il est prêt, sinon « Récupérer » du jour de l'Apprenti).
function phoneFirstWeek(ui, state, goldFree) {
  if (!firstWeekActive(state)) return { html: '', gold: false };
  const open = firstWeekDaysOpen(state);
  const sel = Math.min(open, Math.max(1, Number(ui.view.fwDay) || open));
  const day = firstWeekDay(state, sel);
  const all = day.steps.every((x) => x.done);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = i + 1, info = firstWeekDay(state, d), ready = d <= open && !info.claimed && info.steps.every((x) => x.done);
    return mChip(`J${d}${d > open ? ' 🔒' : info.claimed ? ' ✓' : ready ? ' !' : ''}`, { action: 'fw-day', value: d, on: d === sel, attrs: d > open ? 'disabled' : '' });
  }).join('');
  const pts = firstWeekPoints(state);
  const steps = [...day.steps].sort((a, b) => b.done - a.done).map((x) => `<li class="${x.done ? 'fw-done' : ''}">${x.done ? '✓' : '○'} ${esc(x.text)}</li>`).join('');
  const prize = FIRST_WEEK_PRIZE.map((id) => { const c = companionById(id); return `<button type="button" class="fw-prize-c" ${prizeReady(state) ? `data-action="fw-prize" data-value="${id}"` : 'disabled'} title="${esc(c?.name ?? id)}">${c ? companionStill(c) : ''}<small>${esc(c?.name ?? id)}</small></button>`; }).join('');
  const useGold = goldFree && all && !day.claimed;
  const claim = day.claimed ? '<span class="good">Récupéré ✓</span>'
    : (useGold ? mBtnGold : mBtn)('Récupérer', { action: 'fw-claim', value: sel, disabled: !all, cls: 'auto' });
  const html = `<div class="m-card mp-fw"><div class="mp-fw-head"><b>Carnet de l'Apprenti</b><small>${firstWeekDaysLeft(state)} j restants · ${pts}/21</small></div>
    ${mBar(Math.min(1, pts / 21))}
    <div class="m-chips mp-chips">${days}</div>
    <ul class="fw-steps">${steps}</ul>
    <div class="mp-fw-claim">${rewardIcons(day.reward, 'named')}${claim}</div>
    <div class="fw-prize">${prize}</div>${prizeReady(state) ? '<p class="gold-text">Les 7 jours sont finis : choisis ton compagnon !</p>' : ''}
    ${mBtn('Tout récupérer', { action: 'fw-all' })}</div>`;
  return { html, gold: useGold };
}

function phoneTask(t) {
  const pct = Math.min(1, t.n / Math.max(1, t.target));
  const label = { 'quick-hunt': 'Chasser', 'wheel-open': 'Tourner', 'rift-open': 'Combattre' }[t.action] ?? 'Y aller';
  const go = t.done ? '<span class="mp-ok" role="img" aria-label="Accompli">✓</span>'
    : t.action ? mBtn(label, { action: t.action, cls: 'auto' }) : mBtn(label, { action: 'open-tab', value: t.tab, cls: 'auto' });
  return mpRow({ icon: img(t.icon), title: esc(t.title), bar: pct, n: `${t.n}/${t.target}`, right: go, cls: `${t.done ? 'done' : ''}${t.dormant ? ' dormant' : ''}`, attrs: `data-db="${esc(t.id)}" title="${esc(t.text)}"` });
}

function phoneView(ui, state, { tasks, doneN, all, book }, goldFree = true) {
  const chestReady = all && !book.chest;
  const fw = phoneFirstWeek(ui, state, goldFree && !chestReady);
  const chestBtn = book.chest ? '<span class="mp-ok" role="img" aria-label="Coffre ouvert">✓</span>'
    : (chestReady && goldFree ? mBtnGold : mBtn)(chestReady ? 'Ouvrir' : 'Coffre', { action: 'daybook-chest', disabled: !all, cls: 'auto', icon: 'icon_chest' });
  const head = `<div class="m-card mp-head"><span class="mp-ico big">${img('icon_chest')}</span>
    <div class="mp-main"><div class="mp-head-line"><b class="num">${doneN}/${tasks.length}</b><small role="note">${book.chest ? 'Coffre ouvert · à demain !' : all ? 'Journée accomplie !' : `Coffre du jour : encore ${tasks.length - doneN} tâche${tasks.length - doneN > 1 ? 's' : ''}`}</small></div>
      ${mBar(doneN / Math.max(1, tasks.length))}<div class="mp-head-rw">${rewardIcons(DAYBOOK_CHEST)}</div></div>${chestBtn}</div>`;
  const d = dormantResources(state, daybookOpen(ui));
  // v10.14.2 (B8) : liste verticale, une ligne par ressource qui dort (icône + texte + ›), plus de bulles coupées dans une rangée qui défile.
  const SLEEP_ICON = { keys: 'icon_key', tickets: 'icon_summon', arena: 'icon_trophy', expeditions: 'icon_expedition' };
  const dormant = d.length ? `<div class="mp-sleep"><small>Ça dort</small><div class="mp-sleep-list">${d.map((x) => `<button type="button" class="mp-sleep-row" data-action="open-tab" data-value="${esc(x.tab)}"><span class="mp-sleep-ico">${img(SLEEP_ICON[x.id] ?? 'icon_star')}</span><span class="mp-sleep-t">${esc(x.text)}</span><span class="mp-sleep-go" aria-hidden="true">›</span></button>`).join('')}</div></div>` : '';
  const line = bastionDaybookLine(state);
  const bastion = line ? `<div class="m-card mp-row mp-bastion"><span class="mp-ico"><img class="px" src="assets/ui/art104/bastion_forge_lv1.png" alt=""></span><div class="mp-main"><b class="mp-name">${esc(line)}</b></div>${mBtn('Bastion', { action: 'bastion-open', cls: 'auto' })}</div>` : '';
  return `${head}${fw.html}${dormant}${bastion}<div class="mp-list">${tasks.map(phoneTask).join('')}</div>`; // v10.16 (B1) : le cadre est posé par l'écran Objectifs
}

// v10.16 (B1) : « Maintenant » — une seule consigne, celle du Chemin du héros (sinon le conseil du moment).
function nowCard(ui, state) {
  const q = heroPathQuest(state);
  if (q) {
    const go = q.ready ? mBtn('Récupérer', { action: 'chronicle-claim', cls: 'auto ready' }) : mBtn('Y aller', { action: 'open-tab', value: 'campaign', cls: 'auto' });
    return mpRow({ icon: `<img class="px" src="assets/ui/art106/hud_quest_chapter_${q.chapter}.png" alt="">`, title: esc(q.title),
      sub: `<small class="obj-kicker">Chemin du héros · Ch. ${q.chapter}</small><div class="mp-rw">${rewardIcons(q.reward)}</div>`, bar: q.progress, right: go, cls: `obj-now${q.ready ? ' ready' : ''}` });
  }
  const n = ui.next;
  return mpRow({ icon: img('icon_star'), title: esc(n?.label ?? n?.text ?? 'Avance sur la Carte : bats le prochain boss.'), cls: 'obj-now',
    right: mBtn('Y aller', { action: 'open-tab', value: n?.tab ?? 'campaign', cls: 'auto' }) });
}

// Écran Objectifs : Maintenant (1 consigne), Aujourd'hui (Carnet du jour + missions du jour), Plus tard (Chroniques, Semaine,
// Mois, Hauts faits). Un seul bouton doré : « Tout récupérer » s'il y a quelque chose, sinon le coffre du jour.
export function objectivesHtml(ui, state, day) {
  const parts = objectivesParts(ui, state);
  const claim = parts.claimN ? `<div class="mp-claimbar">${mBtnGold(`Tout récupérer (${parts.claimN})`, { action: 'claim-everything', icon: 'icon_chest' })}${mBtn('Voir', { action: 'open-claims', icon: 'icon_mail', cls: 'auto' })}</div>` : '';
  const focus = ui.view.objFocus;
  if (focus && typeof document !== 'undefined') {
    ui.view.objFocus = null;
    setTimeout(() => document.querySelector(`#panel-body [data-obj="${focus}"]`)?.scrollIntoView({ block: 'start' }), 80);
  }
  return mpFrame('icon_trophy', 'Objectifs', `${claim}
    <section class="obj-sec" data-obj="now">${mpSec('Maintenant')}${nowCard(ui, state)}</section>
    <section class="obj-sec" data-obj="today">${mpSec('Aujourd\'hui')}${phoneView(ui, state, day, !parts.claimN)}<div class="mp-list">${parts.today}</div></section>
    <section class="obj-sec" data-obj="later">${mpSec('Plus tard')}${parts.later}</section>`);
}

export function daybookOpen(ui) {
  return (id) => ui.tabVisible?.[id] !== false;
}

function card(t, fresh) {
  const pct = Math.round((t.n / Math.max(1, t.target)) * 100);
  const go = t.done ? '' : t.action
    ? `<button class="btn btn-gold db-go" data-action="${t.action}">${{ 'quick-hunt': 'Chasser', 'wheel-open': 'Tourner', 'rift-open': 'Combattre' }[t.action] ?? 'Y aller'}</button>`
    : `<button class="btn btn-primary db-go" data-action="open-tab" data-value="${t.tab}">Y aller</button>`;
  return `<div class="db-card${t.done ? ' done' : ''}${t.dormant ? ' dormant' : ''}" data-db="${t.id}">
    <div class="db-art">${img(t.icon)}</div>
    <div class="db-body"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.text)}</small>
      <div class="db-bar"><i style="width:${pct}%"></i><span class="num">${t.n}/${t.target}</span></div></div>
    ${go}${t.done ? `<span class="db-stamp${fresh ? ' fresh' : ''}" aria-label="Accompli">Accompli</span>` : ''}</div>`;
}

export default {
  id: 'daybook',
  title: 'Objectifs', // v10.16 (B1) : Chemin du héros, Carnet du jour et Missions réunis
  icon: 'icon_trophy',
  render(ui, state) {
    const open = daybookOpen(ui);
    // Le tampon ne s'abat qu'une fois (le panneau est redessiné chaque seconde).
    const seen = (ui.view.dbSeen ??= {});
    const fresh = (id) => { const f = !seen[id]; seen[id] = true; return f; };
    const tasks = daybookTasks(state, open);
    const doneN = tasks.filter((t) => t.done).length;
    const all = daybookComplete(state, open);
    const book = daybookOf(state);
    if (isMPhone(ui)) return objectivesHtml(ui, state, { tasks, doneN, all, book });
    const chest = book.chest ? '<div class="db-chest opened">' + img('icon_chest') + '<small>Coffre ouvert · à demain !</small></div>'
      : `<button class="db-chest${all ? ' ready' : ''}" data-action="daybook-chest" ${all ? '' : 'disabled'}>${img('icon_chest')}
          <small>${all ? 'Ouvre le coffre !' : `Coffre du jour : ${doneN}/${tasks.length}`}</small>${rewardIcons(DAYBOOK_CHEST, 'named')}</button>`;
    return `${firstWeekHtml(ui, state)}<div class="db-head"><div class="db-title"><b>Carnet du jour</b><span class="num">${doneN}/${tasks.length}</span></div>
        <div class="db-path">${tasks.map((t) => `<i class="${t.done ? 'on' : ''}"></i>`).join('')}</div></div>
      ${(() => { const d = dormantResources(state, open); return d.length ? `<div class="card db-dormant"><b>Ça dort :</b>${d.map((x) => `<button class="btn small" data-action="open-tab" data-value="${x.tab}">${escapeHtml(x.text)} ›</button>`).join('')}</div>` : ''; })()}
      ${(() => { const line = bastionDaybookLine(state); return line ? `<div class="card db-bastion"><img class="px" src="assets/ui/art104/bastion_forge_lv1.png" alt=""><b>${escapeHtml(line)}</b><button class="btn btn-gold small" data-action="bastion-open">Voir le Bastion ›</button></div>` : ''; })()}
      <div class="db-cards">${tasks.map((t) => card(t, t.done && fresh(t.id))).join('')}</div>
      ${all ? `<div class="db-big-stamp${fresh('all') ? ' fresh' : ''}">Journée accomplie</div>` : ''}
      ${chest}
`; // v9.11 (7) : objectifs de session déplacés en haut des Missions
  },
};
