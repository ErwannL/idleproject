// Objectifs > Classement (v9.1.5, amis et statistiques en v9.1.6). Chargé à l'ouverture de l'onglet et à chaque
// changement de tri ou de portée ; `ui.ranking` = { sort, scope, players, me, error } et `ui.friends` =
// { friends, incoming, outgoing, message, error }. Un invité (joueurXXXXXX) est invité à créer son compte.
import { accountGate, loadFailed, loadState } from '../account-gate.js'; // v10.16 (B6)
import { ZONES } from '../../data/zones.js';
import { escapeHtml, formatNumber } from '../common.js';
import { mBtn, mBtnGold, mChip, mEmpty, mModes, mSheet } from '../mobile-kit.js'; // v10.12
import { isMPhone, mpChips, mpFrame } from './profile-m.js';
import { formatDuration } from './stats.js';

export const RANKING_SORTS = {
  stage: { label: 'Étape', head: 'Étape' },
  level: { label: 'Niveau', head: 'Niv.' },
  bosses: { label: 'Boss', head: 'Boss' },
  kills: { label: 'Ennemis', head: 'Ennemis' },
  gold: { label: 'Or gagné', head: 'Or gagné' },
  tower: { label: 'Tour', head: 'Étage' },
  rebirths: { label: 'Renaissances', head: 'Renaiss.' },
  playtime: { label: 'Temps de jeu', head: 'Temps' },
  rebirthFast: { label: 'Renaissance éclair', head: 'Durée', time: true },
  transcendFast: { label: 'Transcendance éclair', head: 'Durée', time: true },
  reach: { label: 'Course aux mondes', head: 'Atteint en', time: true },
};

function duration(seconds) {
  const h = Math.floor((seconds ?? 0) / 3600);
  return h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : `${h} h ${String(Math.floor(((seconds ?? 0) % 3600) / 60)).padStart(2, '0')}`;
}

function value(sort, p) {
  if (sort === 'stage') return escapeHtml(p.stageLabel ?? String(p.maxStage));
  if (sort === 'playtime') return duration(p.value);
  if (RANKING_SORTS[sort]?.time) return formatDuration(p.value);
  return formatNumber(p.value ?? 0);
}

function row(sort, p) {
  const second = sort === 'stage' ? `niv. ${formatNumber(p.level)}` : escapeHtml(p.stageLabel ?? '');
  return `<tr${p.me ? ' class="me"' : ''}><td class="rk-rank">${p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : p.rank}</td>
    <td class="rk-name">${escapeHtml(p.pseudo)}${p.me ? ' <small>(toi)</small>' : ''}<div class="muted">${second}</div></td><td class="rk-val">${value(sort, p)}</td></tr>`;
}

function friendsBlock(f) {
  if (!f) return '<div class="card muted">Chargement des amis…</div>';
  const incoming = f.incoming?.length
    ? `<div class="section-title">Demandes reçues</div>${f.incoming.map((p) => `<div class="friend-row"><b class="grow">${escapeHtml(p)}</b>
        <button class="btn btn-gold" data-action="friend-accept" data-value="${escapeHtml(p)}">Accepter</button>
        <button class="btn" data-action="friend-remove" data-value="${escapeHtml(p)}">Refuser</button></div>`).join('')}` : '';
  const outgoing = f.outgoing?.length
    ? `<div class="muted friend-pending">En attente : ${f.outgoing.map((p) => `${escapeHtml(p)} <button class="btn btn-small" data-action="friend-remove" data-value="${escapeHtml(p)}" title="Annuler la demande">✕</button>`).join(' ')}</div>` : '';
  const list = f.friends?.length
    ? f.friends.map((p) => `<div class="friend-row"><b class="grow">${escapeHtml(p.pseudo)}</b><span class="muted">${escapeHtml(p.stageLabel)} · niv. ${formatNumber(p.level)}</span>
        <button class="btn btn-small" data-action="friend-remove" data-value="${escapeHtml(p.pseudo)}" title="Retirer de mes amis">✕</button></div>`).join('')
    : '<div class="muted">Pas encore d\'amis : ajoute un joueur par son nom.</div>';
  return `<div class="card friends-card"><div class="section-title">Mes amis${f.friends?.length ? ` (${f.friends.length})` : ''}</div>
    <div class="row"><input id="friend-pseudo" class="grow" type="text" maxlength="20" placeholder="Nom du joueur" aria-label="Nom du joueur à ajouter" autocomplete="off">
      <button class="btn btn-gold" data-action="friend-add">Ajouter</button></div>
    ${f.message ? `<div class="${f.error ? 'bad' : 'good'}">${escapeHtml(f.message)}</div>` : ''}${incoming}${outgoing}<div class="friend-list">${list}</div></div>`;
}

// v10.1 (P2) : aperçu du classement (chargement, hors ligne) : podium illustré et ta propre ligne.
function rankPreview(ui) {
  const st = ui.state;
  const best = st?.records?.bestStage ?? st?.maxStage ?? 1;
  return `<div class="card pv-card"><div class="pv-podium">${['🥈', '🥇', '🥉'].map((m, i) => `<div class="pv-step s${i}"><span>${m}</span><i></i></div>`).join('')}</div>
    <div class="row-between"><b>Toi</b><span>Meilleure étape <b class="num">${formatNumber(best)}</b></span></div><div class="muted">Le classement se charge… Ton record y figure dès que tu es connecté.</div></div>`;
}


// ---------- v10.12 : Classement sur téléphone (kit mobile) ----------
// Un .m-chip « Étape ▾ » ouvre les critères dans une .m-sheet ; « Tout le monde / Mes amis » en modes ; non connecté = .m-empty.
function mRankRow(sort, p) {
  const second = sort === 'stage' ? `niv. ${formatNumber(p.level)}` : escapeHtml(p.stageLabel ?? '');
  return `<div class="mp-rk${p.me ? ' me' : ''}"><span class="mp-rk-rank">${p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : p.rank}</span>
    <span class="mp-rk-name"><b>${escapeHtml(p.pseudo)}${p.me ? ' (toi)' : ''}</b><small>${second}</small></span><b class="mp-rk-val">${value(sort, p)}</b></div>`;
}

function mFriends(f) {
  if (!f) return '<div class="m-card mp-reset">Chargement des amis…</div>';
  const incoming = f.incoming?.length ? `<div class="mp-sub">Demandes reçues</div>${f.incoming.map((p) => `<div class="m-card mp-row"><div class="mp-main"><b class="mp-name">${escapeHtml(p)}</b></div>
      ${mBtn('Accepter', { action: 'friend-accept', value: p, cls: 'auto ready' })}${mBtn('Refuser', { action: 'friend-remove', value: p, cls: 'auto' })}</div>`).join('')}` : '';
  const outgoing = f.outgoing?.length ? `<div class="mp-sub">En attente</div>${f.outgoing.map((p) => `<div class="m-card mp-row"><div class="mp-main"><b class="mp-name">${escapeHtml(p)}</b></div>${mBtn('Annuler', { action: 'friend-remove', value: p, cls: 'auto' })}</div>`).join('')}` : '';
  const list = f.friends?.length ? f.friends.map((p) => `<div class="m-card mp-row"><div class="mp-main"><b class="mp-name">${escapeHtml(p.pseudo)}</b><small>${escapeHtml(p.stageLabel)} · niv. ${formatNumber(p.level)}</small></div>
      ${mBtn('Retirer', { action: 'friend-remove', value: p.pseudo, cls: 'auto' })}</div>`).join('') : '<div class="mp-reset">Pas encore d\'amis : ajoute un joueur par son nom.</div>';
  return `<div class="mp-sub">Mes amis${f.friends?.length ? ` (${f.friends.length})` : ''}</div>
    <div class="m-card mp-addfriend"><input id="friend-pseudo" class="mp-input" type="text" maxlength="20" placeholder="Nom du joueur" aria-label="Nom du joueur à ajouter" autocomplete="off">${mBtn('Ajouter', { action: 'friend-add', cls: 'auto' })}</div>
    ${f.message ? `<div class="${f.error ? 'bad' : 'good'} mp-reset">${escapeHtml(f.message)}</div>` : ''}${incoming}${outgoing}${list}`;
}

function rankingPhone(ui, phone = true) {
  const r = ui.ranking ?? {};
  const sort = r.sort ?? 'stage';
  const scope = r.scope ?? 'all';
  const c = ui.cloud ?? {};
  const member = c.loggedIn && !c.guest;
  // v10.16 (B6) : sans compte, l'explication tout de suite (3 lignes) puis « Créer mon compte » ; rien ne « se charge ».
  if (!member) return mpFrame('icon_trophy', 'Classement', accountGate('ranking', c));
  const modes = mModes([{ id: 'all', label: 'Tout le monde', icon: 'icon_crown', action: 'ranking-scope', value: 'all' },
    { id: 'friends', label: 'Mes amis', icon: 'icon_heart', action: 'ranking-scope', value: 'friends', attrs: member ? '' : 'disabled' }], scope);
  const world = r.world ?? 2;
  const hint = RANKING_SORTS[sort].time && sort !== 'reach' ? '<small class="mp-n">Le plus court gagne</small>' : '';
  // PC : tous les critères en puces, d'un seul regard (action ranking-sort, celle de l'ancien rendu) ; téléphone : une puce qui ouvre la fiche des critères.
  const chips = phone ? `<div class="m-chips mp-rank-chips">${mChip(`${RANKING_SORTS[sort].label} ▾`, { action: 'mp-open', value: 'rank', on: true })}${hint}</div>`
    : `<div class="m-chips mp-rank-chips mp-sorts" role="group" aria-label="Critère">${Object.entries(RANKING_SORTS).map(([k, x]) => mChip(x.label, { action: 'ranking-sort', value: k, on: sort === k })).join('')}</div>${hint}`;
  const worldPick = sort === 'reach' ? `<div class="mp-sub">Monde à atteindre</div>${mpChips('ranking-world', ZONES.slice(1).map((z, i) => [i + 2, `${i + 2}. ${z.name}`]), world)}` : '';
  const invite = member ? '' : mEmpty(c.loggedIn ? `Tu joues en invité (${c.pseudo}). Crée ton compte pour apparaître au classement.` : 'Tu n\'es pas connecté. Crée ton compte pour apparaître au classement, voir ton rang et ajouter des amis.',
    { icon: 'icon_trophy', button: mBtnGold('Créer mon compte', { action: 'open-account' }) });
  let body;
  if (r.error) body = `<div class="m-card"><div class="bad">${escapeHtml(r.error)}</div>${mBtn('Réessayer', { action: 'ranking-sort', value: sort })}</div>`;
  else if (!r.players) body = loadState({ since: ui.loadSince?.ranking ?? Date.now() }) === 'failed' ? loadFailed('ranking') : mEmpty('Le classement se charge…', { icon: 'icon_trophy' }); // v10.16 (B6) : 5 s au plus
  else if (!r.players.length) body = `<div class="m-card mp-reset">${scope === 'friends' ? 'Ajoute des amis pour te comparer à eux.' : 'Personne au classement pour l\'instant.'}</div>`;
  else {
    const mine = r.me ? `<div class="mp-rk-gap">…</div>${mRankRow(sort, { ...r.me, me: true })}` : '';
    body = `<div class="m-card mp-rklist"><div class="mp-rk head"><span class="mp-rk-rank">#</span><span class="mp-rk-name">Joueur</span><b class="mp-rk-val">${RANKING_SORTS[sort].head}</b></div>${r.players.map((p) => mRankRow(sort, p)).join('')}${mine}</div>`;
  }
  const sheetOpen = phone && ui.view.mSheet === 'rank';
  const sheet = sheetOpen ? mSheet('Critère', `<div class="mp-crit">${Object.entries(RANKING_SORTS).map(([k, s]) => mBtn(s.label, { action: 'mp-rank', value: k, cls: sort === k ? 'ready' : '' })).join('')}</div>`, { close: 'mp-shut', back: 'mp-shut', id: 'rank-sheet' }) : '';
  return `${mpFrame('icon_trophy', 'Classement', `${modes}${chips}${worldPick}${invite}${body}${member && scope === 'friends' ? mFriends(ui.friends) : ''}`, true, sheetOpen)}${sheet}`;
}

export default {
  id: 'ranking',
  title: 'Classement',
  icon: 'icon_trophy',
  extra: (ui) => (ui.friends?.incoming?.length ? `${ui.friends.incoming.length} demande${ui.friends.incoming.length > 1 ? 's' : ''}` : ''),
  render(ui) {
    // v10.13 : le PC aussi en kit (cadre, cartouche, puces, fiche latérale) ; isMPhone ne sert plus qu'à la mise en page.
    return rankingPhone(ui, isMPhone(ui));
    const r = ui.ranking ?? {};
    const sort = r.sort ?? 'stage';
    const scope = r.scope ?? 'all';
    const c = ui.cloud ?? {};
    const member = c.loggedIn && !c.guest;
    const invite = member ? '' : `<div class="card ranking-invite"><b>${c.loggedIn ? `Tu joues en invité (${escapeHtml(c.pseudo)}).` : 'Tu n\'es pas connecté.'}</b>
      Crée ton compte pour apparaître au classement, voir ton rang et ajouter des amis.
      <div class="detail-actions"><button class="btn btn-gold" data-action="open-account">Créer mon compte</button></div></div>`;
    const scopes = `<div class="row ranking-scopes"><button class="btn${scope === 'all' ? ' btn-gold' : ''}" data-action="ranking-scope" data-value="all">Tout le monde</button>
      <button class="btn${scope === 'friends' ? ' btn-gold' : ''}" data-action="ranking-scope" data-value="friends" ${member ? '' : 'disabled title="Crée votre compte pour ajouter des amis"'}>Mes amis</button></div>`;
    const sorts = `<div class="row ranking-sorts">${Object.entries(RANKING_SORTS).map(([k, s]) =>
      `<button class="btn btn-small${sort === k ? ' btn-gold' : ''}" data-action="ranking-sort" data-value="${k}">${s.label}</button>`).join('')}</div>`;
    const world = r.world ?? 2;
    const worldPick = sort === 'reach' ? `<div class="row ranking-world"><label>Temps pour atteindre le monde <select data-action="ranking-world" aria-label="Monde à atteindre">
      ${ZONES.slice(1).map((z, i) => `<option value="${i + 2}"${world === i + 2 ? ' selected' : ''}>${i + 2}. ${escapeHtml(z.name)}</option>`).join('')}</select></label></div>`
      : RANKING_SORTS[sort].time ? '<div class="muted">Le plus court gagne.</div>' : '';
    let body;
    if (r.error) body = `<div class="card bad">${escapeHtml(r.error)} <button class="btn" data-action="ranking-sort" data-value="${sort}">Réessayer</button></div>`;
    else if (!r.players) body = rankPreview(ui);
    else if (!r.players.length) body = `<div class="card muted">${scope === 'friends' ? 'Ajoute des amis pour te comparer à eux.' : 'Personne au classement pour l\'instant.'}</div>`;
    else {
      const mine = r.me ? `<tbody class="rk-mine"><tr class="rk-gap"><td colspan="3">…</td></tr>${row(sort, { ...r.me, me: true })}</tbody>` : '';
      body = `<div class="card"><table class="ranking-table"><thead><tr><th>#</th><th>Joueur</th><th>${RANKING_SORTS[sort].head}</th></tr></thead>
        <tbody>${r.players.map((p) => row(sort, p)).join('')}</tbody>${mine}</table></div>`;
    }
    return invite + scopes + sorts + worldPick + body + (member && scope === 'friends' ? friendsBlock(ui.friends) : '');
  },
};
