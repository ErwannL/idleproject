// Équipe : le chevalier + 2 personnages (héros alliés) + 1 compagnon ; collection, niveaux, compétences.
import { BALANCE } from '../../data/balance.js';
import { ALLY_GRADE, COMPANION_RULES, COMPANIONS } from '../../data/companions.js';
import { MULTIPLICATIVE, RARITY_SKILL, activeSynergies, allCompanionSkills, companionById, companionMultiplier, companionUpgradeCost, equippedOfKind, teamKind } from '../../core/companions.js';
import { COMPANION_ROLES, ROLES, SYNERGIES } from '../../data/synergies.js';
import { costButton, effectText, escapeHtml, hdArt, formatNumber, icon, img, progressBar, rarityLabel, stars } from '../common.js';
import { animCanvas } from '../animator.js';
import { DUNGEONS } from '../../data/dungeons.js';
import { SKILL_RULES } from '../../data/companion-skills.js';
import { computeHeroStats } from '../../core/stats.js';
import { EXPEDITION_TYPES, availableForExpedition, expeditionDone, expeditionReward, expeditionType, isAway } from '../../core/expeditions.js';
import { rewardText } from '../../core/rewards.js';
import { formatDuration } from '../../core/format.js';

// Compétences (v8.9) : 4 par compagnon, la 4e avec 3 doublons ; chaque étoile les renforce de +15 %.
// Attaque = dégâts par seconde de ses compétences offensives ; Défense = armure, PV et boucliers qu'il apporte.
function skillsBlock(state, c, owned) {
  const stars = owned?.stars ?? 1;
  const power = (RARITY_SKILL[c.rarity] ?? 1) * (1 + SKILL_RULES.powerPerStar * (stars - 1));
  const hero = computeHeroStats(state);
  const list = allCompanionSkills(c.id);
  const unlocked = (sk) => !sk.ultimate || stars >= SKILL_RULES.ultimateStars;
  const dps = list.filter((sk) => unlocked(sk) && (sk.type === 'hit' || sk.type === 'burst')).reduce((sum, sk) => sum + (hero.damage * sk.value * power) / sk.every, 0);
  const m = owned ? companionMultiplier(state, c.id) : 1;
  const def = ['armor', 'maxHpPct', 'regenPct', 'lifesteal'].filter((k) => c.passive[k]).map((k) => effectText({ [MULTIPLICATIVE[k] ?? k]: c.passive[k] * m })).join(' · ');
  const shields = list.filter((sk) => unlocked(sk) && sk.type === 'shield').map((sk) => `bouclier −${sk.value} %`).join(' · ');
  const rows = list.map((sk) => `<div class="cskill${unlocked(sk) ? '' : ' locked'}${sk.ultimate ? ' ult' : ''}">
      ${img(sk.ultimate ? 'icon_star' : 'skill_quick')} <b>${escapeHtml(sk.name)}</b> <span class="muted">toutes les ${sk.every} s</span>
      ${sk.ultimate ? `<span class="tag-ult">${unlocked(sk) ? 'Ultime' : `Ultime · ${SKILL_RULES.ultimateStars} étoiles (3 doublons)`}</span>` : ''}
      <div class="muted">${escapeHtml(sk.text)}</div></div>`).join('');
  return `<div class="cstats"><span>⚔ Attaque <b>${formatNumber(dps)}</b>/s</span><span>🛡 Défense <b>${def || shields ? [def, shields].filter(Boolean).join(' · ') : '—'}</b></span></div>
    <div class="section-title">Compétences <span class="muted">(puissance ×${String(Math.round(power * 100) / 100).replace('.', ',')} : rareté × ${stars} étoile${stars > 1 ? 's' : ''} — chaque doublon +${Math.round(SKILL_RULES.powerPerStar * 100)} %)</span></div>
    ${rows}
    ${stars >= BALANCE.summon.maxStars ? '<div class="good">✦ Étoiles au maximum : ce compagnon brille d\'une aura sur la scène.</div>' : ''}`;
}

// Expéditions (v8.5) : 3 places ; les compagnons hors de l'équipe partent 1 h, 4 h ou 12 h.
function expeditionsCard(ui, state, now = Date.now()) {
  const slots = state.expeditions.slots.map((run, i) => {
    // v8.9 : tout se fait ici — choisir le compagnon (liste) puis la durée, sans chercher sa fiche plus bas.
    if (!run) {
      const free = availableForExpedition(state);
      if (!free.length) return '<div class="exp-slot empty"><span class="muted">Place libre — aucun compagnon disponible (ceux de l\'équipe ne partent pas).</span></div>';
      const pick = free.some((c) => c.id === ui.view.expPick?.[i]) ? ui.view.expPick[i] : free[i % free.length].id;
      return `<div class="exp-slot empty">
        <select data-action="exp-pick" data-slot="${i}" aria-label="Compagnon à envoyer">${free.map((c) => `<option value="${c.id}" ${c.id === pick ? 'selected' : ''}>${escapeHtml(c.name)} (${rarityLabel(c.rarity)} · ${stars(state.companions.owned[c.id].stars).replace(/<[^>]+>/g, '')})</option>`).join('')}</select>
        <div class="exp-buttons">${EXPEDITION_TYPES.map((t) => `<button class="btn small" data-action="start-expedition" data-value="${pick}|${t.id}"
          title="${t.text} — prévu : ${rewardText(expeditionReward(state, pick, t.id), formatNumber)}">${t.label} · ${t.hours} h</button>`).join('')}</div></div>`;
    }
    const c = companionById(run.companionId);
    const type = expeditionType(run.type);
    const done = expeditionDone(run, now);
    const ratio = Math.min(1, (now - run.start) / (run.end - run.start));
    return `<div class="exp-slot${done ? ' done' : ''}">
      <div class="exp-who">${portrait(c)}</div>
      <div class="grow"><b>${escapeHtml(c.name)}</b> <span class="muted">· ${type.label} (${type.hours} h)</span>
        ${progressBar(ratio, done ? 'Terminée !' : `encore ${formatDuration((run.end - now) / 1000)}`, done ? 'xp' : '')}
        <div class="muted exp-reward">${rewardText(run.reward, formatNumber)}</div></div>
      ${done ? `<button class="btn btn-gold small" data-action="claim-expedition" data-value="${i}">Récupérer</button>`
        : `<button class="btn small" data-action="recall-expedition" data-value="${i}" title="Rappeler maintenant : la mission est abandonnée, sans récompense">Rappeler</button>`}
    </div>`;
  }).join('');
  return `<div class="card"><div class="section-title">Expéditions <span class="muted">(${state.expeditions.done} terminée${state.expeditions.done > 1 ? 's' : ''} · elles avancent aussi jeu fermé)</span></div>${slots}</div>`;
}

// Boutons de départ en expédition (fiche d'un compagnon disponible).
function expeditionButtons(state, c) {
  if (isAway(state, c.id)) {
    const run = state.expeditions.slots.find((s) => s?.companionId === c.id);
    return `<div class="muted">En expédition : ${expeditionType(run.type).label}${expeditionDone(run) ? ' — terminée, à récupérer' : ''}.</div>`;
  }
  if (!availableForExpedition(state).some((x) => x.id === c.id)) return '';
  const free = state.expeditions.slots.some((s) => !s);
  return `<div class="section-title">Envoyer en expédition</div><div class="exp-buttons">${EXPEDITION_TYPES.map((t) => `<button class="btn small" data-action="start-expedition" data-value="${c.id}|${t.id}"
    ${free ? '' : 'disabled'} title="${t.text} — prévu : ${rewardText(expeditionReward(state, c.id, t.id), formatNumber)}">${t.label} · ${t.hours} h</button>`).join('')}</div>
    ${free ? '' : '<div class="muted">Les 3 places d\'expédition sont occupées.</div>'}`;
}

// Donjon où ce héros SSR est adapté (il y écrase tout).
function dungeonFor(c, state) {
  if (!state.cheats?.reveal) return '';
  const d = DUNGEONS.find((x) => x.ally === c.id);
  const a = BALANCE.dungeonAffinity;
  return d ? `<div class="dungeon-ally"><b class="gold-text">Adapté au donjon « ${d.name} »</b><div class="muted">Dans ce donjon : compétence ×${a.skillMultiplier}, passif ×${a.passiveMultiplier}, dégâts de l'équipe +${a.teamDamagePct} %, dégâts subis −${a.damageTakenPct} %.</div></div>` : '';
}

// Portrait animé : héros allié (taille humaine) ou petit compagnon.
function portrait(c, big = false) {
  if (c.kind === 'ally') return animCanvas(`foe:${c.sprite}`, 64, 56, big ? 2 : 1);
  return animCanvas(`pet:${c.sprite}`, big ? 26 : 24, big ? 26 : 24, 2);
}

export default {
  id: 'companions',
  title: 'Compagnons',
  icon: 'icon_paw',
  extra: (ui, state) => `Équipe ${1 + state.companions.equipped.length}/${1 + BALANCE.teamSlots.ally + BALANCE.teamSlots.pet}`,
  render(ui, state) {
    const sel = companionById(ui.view.companionSel) ?? COMPANIONS.find((c) => state.companions.owned[c.id]) ?? COMPANIONS[0];
    // Barre d'équipe : le chevalier, 2 places de personnage, 1 place de compagnon.
    const slot = (kind, i) => {
      const c = equippedOfKind(state, kind)[i];
      return c ? `<button class="team-slot r-${c.rarity}" data-action="companion-sel" data-value="${c.id}" title="${escapeHtml(c.name)}">${portrait(c)}</button>`
        : `<div class="team-slot empty" title="${kind === 'ally' ? 'Place de compagnon' : 'Place de familier'}">${kind === 'ally' ? 'Compagnon' : 'Familier'}</div>`;
    };
    const team = `<div class="team-bar">
      <div class="team-slot hero" title="Le chevalier (toujours présent)">${animCanvas('hero', 64, 58, 1)}</div>
      ${Array.from({ length: BALANCE.teamSlots.ally }, (_, i) => slot('ally', i)).join('')}
      <span class="team-sep"></span>${Array.from({ length: BALANCE.teamSlots.pet }, (_, i) => slot('pet', i)).join('')}
    </div>`;
    const thumb = (c) => {
      const owned = state.companions.owned[c.id];
      const equipped = state.companions.equipped.includes(c.id);
      return `<button class="pet-thumb r-${c.rarity}${c.id === sel.id ? ' selected' : ''}${owned ? '' : ' unowned'}"
        data-action="companion-sel" data-value="${c.id}" title="${c.name}">
        ${owned ? portrait(c) : `<img class="px" src="${icon(c.sprite, c.kind === 'ally' ? 1 : 3, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}
        ${c.kind === 'ally' ? `<span class="grade g-${c.rarity}">${ALLY_GRADE[c.rarity]}</span>` : ''}
        ${COMPANION_ROLES[c.id] ? `<span class="role-dot" style="background:${ROLES[COMPANION_ROLES[c.id]].color}" title="${ROLES[COMPANION_ROLES[c.id]].label}"></span>` : ''}
        ${equipped ? '<span class="eq">É</span>' : ''}${isAway(state, c.id) ? '<span class="away" title="En expédition">⚑</span>' : ''}</button>`;
    };
    const allies = COMPANIONS.filter((c) => teamKind(c) === 'ally');
    const pets = COMPANIONS.filter((c) => teamKind(c) === 'pet');
    const owned = state.companions.owned[sel.id];
    const equipped = state.companions.equipped.includes(sel.id);
    const m = owned ? companionMultiplier(state, sel.id) : 1;
    const passive = Object.fromEntries(Object.entries(sel.passive).map(([k, v]) => [MULTIPLICATIVE[k] ?? k, v * m]));
    let actions;
    if (!owned) {
      actions = '<button class="btn btn-gold" data-action="open-tab" data-value="summon">Invoquer…</button>';
    } else {
      const maxed = owned.level >= COMPANION_RULES.maxLevel;
      const kind = teamKind(sel);
      const full = !equipped && kind === 'ally' && equippedOfKind(state, 'ally').length >= BALANCE.teamSlots.ally;
      const swap = !equipped && kind === 'pet' && equippedOfKind(state, 'pet').length >= BALANCE.teamSlots.pet;
      // Équipe pleine : « Équiper » propose de choisir le compagnon à remplacer.
      const replacing = full && ui.view.replaceFor === sel.id;
      const away = isAway(state, sel.id);
      actions = away ? '<button class="btn" disabled>En expédition</button>' : full
        ? `<button class="btn btn-primary" data-action="ask-replace" data-value="${sel.id}">Équiper…</button>`
        : `<button class="btn ${equipped ? '' : 'btn-primary'}" data-action="toggle-companion" data-value="${sel.id}">
          ${equipped ? 'Retirer' : swap ? 'Remplacer le familier' : 'Équiper'}</button>`;
      if (replacing) {
        actions += `<div class="replace-box"><b>Qui remplacer ?</b>${equippedOfKind(state, 'ally').map((c) => `<button class="btn small"
          data-action="replace-companion" data-value="${sel.id}|${c.id}">${portrait(c)}<span>${escapeHtml(c.name)}</span></button>`).join('')}
          <button class="btn small" data-action="ask-replace" data-value="">Annuler</button></div>`;
      }
      actions += costButton({ action: 'upgrade-companion', cost: companionUpgradeCost(state, sel.id), have: state.gold, attrs: `data-value="${sel.id}"`, label: 'Améliorer ', max: maxed });
    }
    // Synergies : actives (or) et possibles (grisées) selon les rôles de l'équipe.
    const active = new Set(activeSynergies(state).map((s) => s.id));
    const synergies = SYNERGIES.map((syn) => `<div class="syn${active.has(syn.id) ? ' on' : ''}" title="${escapeHtml(syn.text)}">
      <b>${escapeHtml(syn.name)}</b> <span class="syn-roles">${syn.roles.map((r) => `<i style="color:${ROLES[r].color}">${ROLES[r].label}</i>`).join(' + ')}</span>
      <span class="${active.has(syn.id) ? 'good' : 'muted'}">${effectText(syn.effects)}</span></div>`).join('');
    const loadouts = state.loadouts.map((l, i) => `<div class="loadout">
      <b>${escapeHtml(l.name)}</b><span class="muted">${l.team ? l.team.map((id) => escapeHtml(companionById(id)?.name ?? '')).filter(Boolean).join(', ') || 'équipe vide' : 'vide'}</span>
      <button class="btn small" data-action="save-loadout" data-value="${i}">Enregistrer</button>
      <button class="btn btn-primary small" data-action="apply-loadout" data-value="${i}" ${l.team ? '' : 'disabled'}>Équiper</button></div>`).join('');
    return `${team}
      ${expeditionsCard(ui, state)}
      <div class="card"><div class="section-title">Synergies d'équipe <span class="muted">(le chevalier compte comme Gardien)</span></div><div class="syn-list">${synergies}</div></div>
      <div class="card"><div class="section-title">Configurations <span class="muted">(équipe + équipement porté)</span></div>${loadouts}</div>
      <div class="section-title">Compagnons <span class="muted">(humains R · SR · SSR — 2 places)</span></div>
      <div class="pet-grid">${allies.map(thumb).join('')}</div>
      <div class="section-title">Familiers <span class="muted">(animaux — 1 place)</span></div>
      <div class="pet-grid">${pets.map(thumb).join('')}</div>
      <div class="card pet-detail r-${sel.rarity}">
        ${hdArt(sel, owned ? 'pet-hd' : 'pet-hd locked')}
        <div class="detail-head">
          <div class="pet-portrait">${owned ? portrait(sel, true) : `<img class="px" src="${icon(sel.sprite, sel.kind === 'ally' ? 1 : 4, { tint: { color: '#3a4a66', alpha: 1 } })}" alt="">`}</div>
          <div><div class="item-name">${escapeHtml(sel.name)}</div>
            <div class="item-sub"><span class="rarity-text">${rarityLabel(sel.rarity)}</span>${owned ? ` · niv. ${owned.level}/${COMPANION_RULES.maxLevel} ${stars(owned.stars)}` : ' · non obtenu'}</div></div>
        </div>
        ${COMPANION_ROLES[sel.id] ? `<div>Rôle : <b style="color:${ROLES[COMPANION_ROLES[sel.id]].color}">${ROLES[COMPANION_ROLES[sel.id]].label}</b></div>` : ''}
        <div class="section-title">Bonus passif</div>
        <div class="good">${effectText(passive)}</div>
        ${dungeonFor(sel, state)}
        ${skillsBlock(state, sel, owned)}
        <div class="detail-actions">${actions}</div>
        ${owned ? expeditionButtons(state, sel) : ''}
      </div>`;
  },
};
