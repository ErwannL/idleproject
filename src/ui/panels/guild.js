// v9.3.2 : Objectifs › Guilde. Chargé à l'ouverture (ui.guild = { data, list, ranking, mode, error, busy }).
// Sans compte : explication (les guildes demandent un compte créé). Données serveur : server/guilds.mjs.
import { escapeHtml, formatNumber, img } from '../common.js';

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
      ${d.lockedUntil ? `<div class="bad">Nouveau membre : vos contributions comptent pour la guilde à partir du ${new Date(d.lockedUntil).toLocaleString('fr-FR')}.</div>` : ''}</div>
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
  return `<div class="card"><b>Rejoignez une guilde</b><div class="muted">Facultatif : la progression ne dépend jamais d'une guilde. Ensemble : objectif de la semaine, classement du World Boss.</div>
      <div class="row"><input class="guild-input" data-guild="q" placeholder="Rechercher une guilde" value="${escapeHtml(ui.view.guildQ ?? '')}" maxlength="24"><button class="btn small" data-action="guild-search">Chercher</button></div>
      ${list || '<div class="state-empty">Aucune guilde trouvée.</div>'}</div>
    <div class="card"><div class="section-title">Fonder une guilde</div>
      <input class="guild-input" data-guild="name" placeholder="Nom (3 à 24 caractères)" maxlength="24">
      <input class="guild-input" data-guild="desc" placeholder="Description (facultatif)" maxlength="200">
      <div class="guild-emblems">${EMBLEMS.map((e) => `<button class="btn chip-btn${e === em ? ' active' : ''}" data-action="guild-emblem" data-value="${e}" aria-label="Emblème">${img(e)}</button>`).join('')}</div>
      <label class="row"><input type="checkbox" data-guild="open" checked> Accès libre (sinon : sur demande)</label>
      <button class="btn btn-gold" data-action="guild-create">Fonder</button></div>`;
}

export default {
  id: 'guild',
  title: 'Guilde',
  icon: 'icon_crown',
  render(ui) {
    const g = ui.guild ?? {};
    if (g.needAccount) return '<div class="state-empty">Les guildes demandent un compte joueur créé : Paramètres ⚙ › Sauvegarde en ligne.</div>';
    const msg = g.error ? `<div class="state-error">${escapeHtml(g.error)}</div>` : g.message ? `<div class="good">${escapeHtml(g.message)}</div>` : '';
    if (!g.data) return `${msg}<div class="state-empty">${g.busy ? 'Chargement…' : 'Connexion au serveur impossible pour le moment.'}</div>`;
    return `${msg}${g.data.guild ? myGuild(ui, g.data) : noGuild(ui, g)}<div class="card"><div class="section-title">Classement des guildes</div>${rankingBlock(g)}</div>`;
  },
};
