// v9.3.2 : Objectifs › Guilde. Chargé à l'ouverture (ui.guild = { data, list, ranking, mode, error, busy }).
// Sans compte : explication (les guildes demandent un compte créé). Données serveur : server/guilds.mjs.
import { escapeHtml, formatNumber, img } from '../common.js';

import { mBar, mBtn, mBtnGold, mChip, mEmpty, mModes } from '../mobile-kit.js'; // v10.12
import { isMPhone, mpFrame } from './profile-m.js';
const EMBLEMS = ['weapon_sword', 'icon_shield', 'icon_crown', 'icon_star', 'icon_skull', 'icon_heart', 'icon_paw', 'icon_tower', 'icon_gem', 'icon_boss'];
const ROLE = { leader: 'Chef', officer: 'Officier', member: 'Membre' };
const ago = (t) => { if (!t) return '—'; const h = Math.floor((Date.now() - t) / 3600000); return h < 1 ? 'en ligne récemment' : h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`; };

function rankingBlock(g) {
  const r = g.ranking;
  if (!r) return '<div class="state-empty">Chargement du classement…</div>';
  const tab = (m, l) => `<button class="btn chip-btn small${g.mode === m ? ' active' : ''}" data-action="guild-rank" data-value="${m}">${l}</button>`;
  const rows = r.guilds.map((x, i) => `<tr${x.name === r.me ? ' class="me"' : ''}><td>${i + 1}</td><td>${img(x.emblem)} ${escapeHtml(x.name)} <small class="muted">${x.members} membres · ${x.contributors} contributeurs</small></td><td class="rk-val">${formatNumber(x.score)}</td></tr>`).join('');
  return `<div class="item-tabs">${tab('global', 'Boss commun')}${tab('event', 'World Boss d\'événement')}</div>
    <div class="muted">Score de guilde = ${escapeHtml(r.rule)} (une petite guilde active reste compétitive). Période : ${escapeHtml(r.period || 'événement en cours')}.</div>
    ${rows ? `<table class="rk-table"><tbody>${rows}</tbody></table>` : '<div class="state-empty">Aucune guilde classée pour l\'instant.</div>'}`;
}

function myGuild(ui, d) {
  const g = d.guild;
  const lead = ['leader', 'officer'].includes(d.role);
  const pct = Math.min(100, (d.weekly.progress / d.weekly.goal) * 100);
  const members = d.members.map((m) => `<tr><td>${escapeHtml(m.pseudo)} <small class="muted">${ROLE[m.role]}</small><div class="muted">${ago(m.lastSeen)}</div></td>
      <td class="num">${m.contrib} ✦</td><td class="num">${formatNumber(m.damage)}</td>
      <td>${lead && m.role !== 'leader' ? `<button class="btn tiny" data-action="guild-kick" data-value="${escapeHtml(m.pseudo)}">Exclure</button>` : ''}
      ${d.role === 'leader' && m.role === 'member' ? `<button class="btn tiny" data-action="guild-role" data-value="${escapeHtml(m.pseudo)}|officer">Officier</button>` : ''}</td></tr>`).join('');
  return `<div class="card guild-head"><div class="guild-emblem">${img(g.emblem)}</div><div class="grow"><b class="gold-text">${escapeHtml(g.name)}</b>
      <div class="muted">${escapeHtml(g.description || '')}</div><div>${d.members.length} / ${g.maxMembers} membres · ${g.open ? 'accès libre' : 'sur demande'} · vous êtes <b>${ROLE[d.role]}</b></div>
      ${d.lockedUntil ? `<div class="bad">Nouveau membre : tes contributions comptent pour la guilde à partir du ${new Date(d.lockedUntil).toLocaleString('fr-FR')}.</div>` : ''}</div>
      <button class="btn small btn-danger" data-action="guild-leave">Quitter</button></div>
    <div class="card"><div class="section-title">Objectif de la semaine</div>
      <div class="arena-bar guild-bar"><i style="width:${pct}%;background:var(--gold)"></i></div>
      <div>${d.weekly.progress} / ${d.weekly.goal} tentatives de World Boss (3 au plus par membre et par jour)${d.weekly.reached ? ' — <b class="good">atteint !</b>' : ''}</div>
      <div class="muted">Récompense de guilde réservée aux membres qui ont contribué.</div>
      <button class="btn btn-gold small" data-action="open-tab" data-value="event">⚔ Aller au World Boss</button></div>
    ${lead && d.requests.length ? `<div class="card claimable"><div class="section-title">Demandes</div>${d.requests.map((p) => `<div class="row-between">${escapeHtml(p)} <button class="btn small btn-primary" data-action="guild-accept" data-value="${escapeHtml(p)}">Accepter</button></div>`).join('')}</div>` : ''}
    <div class="card"><div class="section-title">Membres</div><table class="rk-table guild-members"><thead><tr><th>Membre</th><th>Semaine</th><th>Dégâts mondiaux</th><th></th></tr></thead><tbody>${members}</tbody></table></div>
    <div class="card"><div class="section-title">Activité récente</div><ul class="guild-log">${d.log.map((l) => `<li><small class="muted">${new Date(l.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small> ${escapeHtml(l.text)}</li>`).join('') || '<li class="muted">Rien pour l\'instant.</li>'}</ul></div>`;
}

function noGuild(ui, g) {
  const list = (g.list ?? []).map((x) => `<div class="row-between guild-row"><span>${img(x.emblem)} <b>${escapeHtml(x.name)}</b> <small class="muted">${x.members}/${x.maxMembers} · ${x.open ? 'libre' : 'sur demande'}</small><div class="muted">${escapeHtml(x.description)}</div></span>
      <button class="btn small btn-primary" data-action="guild-join" data-value="${escapeHtml(x.name)}" ${x.members >= x.maxMembers ? 'disabled' : ''}>${x.open ? 'Rejoindre' : 'Demander'}</button></div>`).join('');
  const em = ui.view.guildEmblem ?? EMBLEMS[0];
  return `<div class="card"><b>Rejoins une guilde</b><div class="muted">Facultatif : la progression ne dépend jamais d'une guilde. Ensemble : objectif de la semaine, classement du World Boss.</div>
      <div class="row"><input class="guild-input" data-guild="q" placeholder="Rechercher une guilde" value="${escapeHtml(ui.view.guildQ ?? '')}" maxlength="24"><button class="btn small" data-action="guild-search">Chercher</button></div>
      ${list || '<div class="state-empty">Aucune guilde trouvée.</div>'}</div>
    <div class="card"><div class="section-title">Fonder une guilde</div>
      <input class="guild-input" data-guild="name" placeholder="Nom (3 à 24 caractères)" maxlength="24">
      <input class="guild-input" data-guild="desc" placeholder="Description (facultatif)" maxlength="200">
      <div class="guild-emblems">${EMBLEMS.map((e) => `<button class="btn chip-btn${e === em ? ' active' : ''}" data-action="guild-emblem" data-value="${e}" aria-label="Emblème">${img(e)}</button>`).join('')}</div>
      <label class="row"><input type="checkbox" data-guild="open" checked> Accès libre (sinon : sur demande)</label>
      <button class="btn btn-gold" data-action="guild-create">Fonder</button></div>`;
}

// v10.1 (P2) : aperçu illustré de la Guilde (hors ligne ou sans compte) : ce qu'elle apporte, en trois tuiles.
function guildPreview() {
  const t = (ic, b, txt) => `<div class="pv-tile">${img(ic)}<b>${b}</b><small>${txt}</small></div>`;
  return `<div class="card pv-card"><div class="pv-tiles">${t('icon_boss', 'Boss commun', 'Une barre de PV partagée par toute la guilde')}${t('icon_star', 'Bonus de guilde', '+ dégâts et + or pour tous les membres')}${t('icon_trophy', 'Classement', 'Les guildes les plus fortes du moment')}</div></div>`;
}


// ---------- v10.12 : Guilde sur téléphone (kit mobile) ----------
const perks = () => `<div class="mp-perks">${[['icon_boss', 'Boss commun'], ['icon_star', 'Bonus de guilde'], ['icon_trophy', 'Classement']].map(([ic, t]) => `<span class="mp-perk"><span class="mp-ico big">${img(ic)}</span><b>${t}</b></span>`).join('')}</div>`;

function mRanking(g) {
  const r = g.ranking;
  if (!r) return '<div class="mp-reset">Chargement du classement…</div>';
  const modes = mModes([{ id: 'global', label: 'Boss commun', icon: 'icon_boss', action: 'guild-rank', value: 'global' }, { id: 'event', label: 'World Boss', icon: 'icon_trophy', action: 'guild-rank', value: 'event' }], g.mode ?? 'global', { size: 64 });
  const rows = r.guilds.map((x, i) => `<div class="mp-rk${x.name === r.me ? ' me' : ''}"><span class="mp-rk-rank">${i + 1}</span><span class="mp-rk-name"><b>${img(x.emblem)} ${escapeHtml(x.name)}</b><small>${x.members} membres · ${x.contributors} contributeurs</small></span><b class="mp-rk-val">${formatNumber(x.score)}</b></div>`).join('');
  return `${modes}<div class="mp-reset">Score = ${escapeHtml(r.rule)}. Période : ${escapeHtml(r.period || 'événement en cours')}.</div>
    ${rows ? `<div class="m-card mp-rklist">${rows}</div>` : '<div class="mp-reset">Aucune guilde classée pour l\'instant.</div>'}`;
}

function mMyGuild(ui, d) {
  const g = d.guild;
  const lead = ['leader', 'officer'].includes(d.role);
  const pct = Math.min(1, d.weekly.progress / d.weekly.goal);
  const head = `<div class="m-card mp-head mp-guild-head"><span class="mp-ico big">${img(g.emblem)}</span><div class="mp-main"><b class="mp-name gold-text">${escapeHtml(g.name)}</b>
      <small>${d.members.length}/${g.maxMembers} membres · ${g.open ? 'accès libre' : 'sur demande'} · ${ROLE[d.role]}</small></div>${mBtn('Quitter', { action: 'guild-leave', cls: 'auto' })}</div>
    ${g.description ? `<div class="mp-reset">${escapeHtml(g.description)}</div>` : ''}${d.lockedUntil ? `<div class="bad mp-reset">Nouveau membre : tes contributions comptent à partir du ${new Date(d.lockedUntil).toLocaleString('fr-FR')}.</div>` : ''}`;
  const weekly = `<div class="mp-sub">Objectif de la semaine</div><div class="m-card"><div class="mp-barline">${mBar(pct)}<small class="mp-n">${d.weekly.progress}/${d.weekly.goal}</small></div>
      <div class="mp-reset">Tentatives de World Boss (3 au plus par membre et par jour)${d.weekly.reached ? ' — <b class="good">atteint !</b>' : ''}</div>${mBtn('Aller au World Boss', { action: 'open-tab', value: 'event', icon: 'weapon_sword' })}</div>`;
  const requests = lead && d.requests.length ? `<div class="mp-sub">Demandes</div>${d.requests.map((p) => `<div class="m-card mp-row"><div class="mp-main"><b class="mp-name">${escapeHtml(p)}</b></div>${mBtn('Accepter', { action: 'guild-accept', value: p, cls: 'auto ready' })}</div>`).join('')}` : '';
  const members = d.members.map((m) => `<div class="m-card mp-row"><div class="mp-main"><b class="mp-name">${escapeHtml(m.pseudo)} <small>${ROLE[m.role]}</small></b><small>${ago(m.lastSeen)} · ${m.contrib} ✦ · ${formatNumber(m.damage)} dégâts</small></div>
      ${lead && m.role !== 'leader' ? mBtn('Exclure', { action: 'guild-kick', value: m.pseudo, cls: 'auto' }) : ''}${d.role === 'leader' && m.role === 'member' ? mBtn('Officier', { action: 'guild-role', value: `${m.pseudo}|officer`, cls: 'auto' }) : ''}</div>`).join('');
  const log = d.log.map((l) => `<li><small>${new Date(l.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small> ${escapeHtml(l.text)}</li>`).join('') || '<li>Rien pour l\'instant.</li>';
  return `${head}${weekly}${requests}<div class="mp-sub">Membres</div>${members}<div class="mp-sub">Activité récente</div><div class="m-card"><ul class="guild-log mp-log">${log}</ul></div>`;
}

function mNoGuild(ui, g) {
  const em = ui.view.guildEmblem ?? EMBLEMS[0];
  const list = (g.list ?? []).map((x) => `<div class="m-card mp-row"><span class="mp-ico">${img(x.emblem)}</span><div class="mp-main"><b class="mp-name">${escapeHtml(x.name)}</b><small>${x.members}/${x.maxMembers} · ${x.open ? 'libre' : 'sur demande'}</small></div>
      ${mBtn(x.open ? 'Rejoindre' : 'Demander', { action: 'guild-join', value: x.name, disabled: x.members >= x.maxMembers, cls: 'auto' })}</div>`).join('');
  return `<div class="mp-sub">Rejoins une guilde</div>
    <div class="m-card mp-addfriend"><input class="mp-input" data-guild="q" placeholder="Rechercher une guilde" value="${escapeHtml(ui.view.guildQ ?? '')}" maxlength="24">${mBtn('Chercher', { action: 'guild-search', cls: 'auto' })}</div>
    ${list || '<div class="mp-reset">Aucune guilde trouvée.</div>'}
    <div class="mp-sub">Fonder une guilde</div>
    <div class="m-card"><input class="mp-input" data-guild="name" placeholder="Nom (3 à 24 caractères)" maxlength="24"><div class="mp-gap"></div><input class="mp-input" data-guild="desc" placeholder="Description (facultatif)" maxlength="200">
      <div class="m-chips mp-emblems">${EMBLEMS.map((e) => mChip('', { action: 'guild-emblem', value: e, on: e === em, icon: e, attrs: 'aria-label="Emblème"' })).join('')}</div>
      <label class="mp-check"><input type="checkbox" data-guild="open" checked> Accès libre (sinon : sur demande)</label>${mBtnGold('Fonder', { action: 'guild-create' })}</div>`;
}

function guildPhone(ui) {
  const g = ui.guild ?? {};
  const empty = (txt) => mEmpty(txt, { icon: 'icon_crown', button: `${perks()}${mBtnGold('Créer mon compte', { action: 'open-account' })}` });
  let body;
  if (g.needAccount) body = empty('Rejoins une guilde : bannière, salle commune et boss partagés.');
  else {
    const msg = g.error ? `<div class="state-error mp-reset">${escapeHtml(g.error)}</div>` : g.message ? `<div class="good mp-reset">${escapeHtml(g.message)}</div>` : '';
    if (!g.data) body = `${msg}${mEmpty(g.busy ? 'Chargement…' : 'Connexion au serveur impossible pour le moment : voici ce qui t\'attend.', { icon: 'icon_crown', button: perks() })}`;
    else body = `${msg}${g.data.guild ? mMyGuild(ui, g.data) : mNoGuild(ui, g)}<div class="mp-sub">Classement des guildes</div>${mRanking(g)}`;
  }
  return mpFrame('icon_crown', 'Guilde', body);
}

export default {
  id: 'guild',
  title: 'Guilde',
  icon: 'icon_crown',
  render(ui) {
    if (isMPhone(ui)) return guildPhone(ui);
    const g = ui.guild ?? {};
    // v9.8 (I9) : illustration et bouton direct vers la création de compte.
    if (g.needAccount) return `${guildPreview()}<div class="card guild-invite">
      <b>Rejoins une guilde : bannière, salle commune et boss partagés.</b>
      <div class="detail-actions"><button class="btn btn-gold" data-action="open-account">Créer mon compte</button></div></div>`;
    const msg = g.error ? `<div class="state-error">${escapeHtml(g.error)}</div>` : g.message ? `<div class="good">${escapeHtml(g.message)}</div>` : '';
    if (!g.data) return `${msg}${guildPreview()}<div class="state-empty">${g.busy ? 'Chargement…' : 'Connexion au serveur impossible pour le moment : voici ce qui t\'attend.'}</div>`;
    return `${msg}${g.data.guild ? myGuild(ui, g.data) : noGuild(ui, g)}<div class="card"><div class="section-title">Classement des guildes</div>${rankingBlock(g)}</div>`;
  },
};
