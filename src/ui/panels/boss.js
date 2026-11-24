// Boss : Codex des pouvoirs ancestraux, relance (après avoir réaffronté le boss), maîtrise, synergies.
import { BALANCE } from '../../data/balance.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { POWER_FAMILIES, POWER_RULES } from '../../data/powers.js';
import { stageLabel } from '../../core/combat.js';
import { itemBase, signatureItemFor } from '../../core/loot.js';
import {
  bossDungeon, bossFirstStage, bossesInOrder, pityRemaining, powerById, powerSlots,
  maxCharges, synergyFamilies,
} from '../../core/powers.js';
import { rewardText } from '../../core/rewards.js';
import { itemIconUrl } from '../../render/pixel.js';
import { ZONES } from '../../data/zones.js';
import { BOSS_LORE } from '../../data/lore.js';
import { bossTrait } from '../../core/boss-traits.js';
import { effectText, escapeHtml, fold, formatNumber, icon, img, progressBar, rarityLabel } from '../common.js';
import { mBar, mBtn, mBtnGold, mGrid, mSheet, mTile } from '../mobile-kit.js'; // v10.12
import { isMPhone, mpBtns, mpFold, mpFrame } from './profile-m.js';
import { animCanvas } from '../animator.js';

// v9.1.0 : un boss hors de portée n'est plus « combattu » (le jeu restait à l'étape max et coupait l'avance auto).
function rechallengeButton(state, bossId, label) {
  const stage = bossDungeon(bossId) ? null : bossFirstStage(bossId);
  if (stage !== null && stage > state.maxStage) {
    return `<button class="btn" disabled>${label}</button><span class="muted"> Atteins l'étape ${stageLabel(stage)}</span>`;
  }
  return `<button class="btn" data-action="rechallenge" data-boss="${bossId}">${label}</button>`;
}

function powerBox(power, label) {
  const family = POWER_FAMILIES[power.family];
  return `<div class="power-box r-${power.rarity}">
    <div class="section-title">${label}</div>
    <div class="power-name rarity-text">${escapeHtml(power.name)}</div>
    <div class="power-rarity"><span class="rarity-text">${rarityLabel(power.rarity)}</span> · <span style="color:${family.color}">${family.label}</span></div>
    <div class="power-effect">${effectText(power.effects)}</div>
  </div>`;
}

function portrait(bossId, known, scale = 1) {
  const boss = BOSSES[bossId];
  if (known) return animCanvas(`foe:${boss.sprite ?? ENEMIES[boss.base].sprite}`, 124, 80, scale);
  const sprite = boss.sprite ?? ENEMIES[boss.base].sprite;
  return icon(sprite, 1, known ? (boss.palette ? { colors: boss.palette } : {}) : { tint: { color: '#4a5a78', alpha: 1 } });
}

// Couronnes de maîtrise : une par palier récupéré.
function crowns(entry) {
  const n = BALANCE.mastery.length;
  const got = entry?.masteryClaimed ?? 0;
  return `<span class="crowns">${Array.from({ length: n }, (_, i) => `<i class="${i < got ? 'on' : ''}">♛</i>`).join('')}</span>`;
}

function bossListItem(ui, state, bossId, sel) {
  const boss = BOSSES[bossId];
  const entry = state.powers[bossId];
  const known = Boolean(entry) || (state.codex?.kills?.[bossId] ?? 0) > 0;
  const dungeon = bossDungeon(bossId);
  const where = dungeon ? dungeon.name : `Monde ${ZONES.findIndex((z) => z.bosses.includes(bossId)) + 1} · ${stageLabel(bossFirstStage(bossId))}`;
  const wins = entry?.victories ?? 0;
  return `<button class="boss-item${bossId === sel ? ' selected' : ''}${known ? '' : ' unknown'}" data-action="boss-sel" data-value="${bossId}">
    <div class="boss-thumb">${known ? portrait(bossId, true) : `<img class="px" src="${portrait(bossId, false)}" alt="">`}</div>
    <div class="grow"><b>${known ? escapeHtml(boss.name) : '???'}</b><div class="muted">${escapeHtml(where)}</div>
      <div><span class="${wins ? 'gold-text' : 'bad'}">${wins}</span> victoire${wins > 1 ? 's' : ''} ${crowns(entry)}</div></div>
    <span class="chev">›</span></button>`;
}

function bossDetail(ui, state, bossId) {
  const boss = BOSSES[bossId];
  const entry = state.powers[bossId];
  const dungeon = bossDungeon(bossId);
  const where = dungeon ? `Donjon « ${dungeon.name} »` : `${ZONES[ZONES.findIndex((z) => z.bosses.includes(bossId))]?.name ?? ''} · étape ${stageLabel(bossFirstStage(bossId))}`;
  const signature = signatureItemFor(bossId);
  const rewards = [
    signature ? `<div class="reward-icon r-legendary" title="${escapeHtml(itemBase(signature.id).name)} (objet ancestral, ${Math.round(BALANCE.loot.signatureChance * 100)} %)"><img class="px" src="${itemIconUrl({ baseId: signature.id, rarity: 'legendary', slot: signature.slot })}" alt=""></div>` : '',
    `<div class="reward-icon r-epic" title="Objet Rare ou mieux garanti">${img('icon_bag')}</div>`,
    `<div class="reward-icon r-rare" title="Éclats">${img('icon_shard')}</div>`,
    `<div class="reward-icon r-rare" title="Gemmes">${img('icon_gem')}</div>`,
    `<div class="reward-icon r-common" title="Or">${img('coin')}</div>`,
  ].join('');
  // v9.1.3 (doc1 « Aventure : Boss ») : une colonne ; l'histoire, les récompenses et les familles sont repliées.
  const trait = bossTrait(bossId);
  const header = `<div class="boss-hero">
      <div class="boss-big">${entry ? portrait(bossId, true, 1) : `<img class="px" src="${portrait(bossId, false)}" alt="">`}</div>
      <div class="grow"><div class="row"><span class="boss-title">${entry ? escapeHtml(boss.name) : '???'}</span><span class="badge-ancestral">Boss ancestral</span></div>
        <div class="muted">📍 ${escapeHtml(where)}</div></div>
    </div>
    ${trait ? `<div class="trait-box" style="--trait:${trait.color}"><b>${escapeHtml(trait.name)}</b> : ${escapeHtml(trait.text)}. <span class="muted">Parade : ${escapeHtml(trait.counter)}</span></div>` : ''}`;
  const lore = entry && BOSS_LORE[bossId] ? fold(ui, 'boss-lore', 'Histoire', `<p class="lore">${escapeHtml(BOSS_LORE[bossId])}</p>`) : '';
  const rewardFold = fold(ui, 'boss-rewards', 'Récompenses possibles', `<div class="reward-row">${rewards}</div>`);
  if (!entry) {
    return `${header}<div class="power-box unknown"><div class="section-title">Pouvoir</div><div class="power-name">À découvrir</div>
        <div class="muted">Vaincs ce boss pour obtenir un pouvoir unique.</div></div>
      ${rechallengeButton(state, bossId, '⚔ Combattre ce boss')}
      ${rewardFold}`;
  }
  const current = powerById(entry.current);
  const active = state.equippedPowers.includes(bossId);
  const pity = pityRemaining(state, bossId);
  const charges = entry.charges;
  const maxC = maxCharges(state);
  const pityOpen = ui.view.powerPity === bossId;
  const offer = entry.pending
    ? `<div class="power-offer"><div class="offer-cols">${powerBox(current, 'Pouvoir actuel')}<div class="offer-arrow">»</div>${powerBox(powerById(entry.pending), 'Nouveau pouvoir proposé')}</div>
      <div class="detail-actions">
        <button class="btn btn-gold" data-action="take-power" data-boss="${bossId}">Prendre le nouveau</button>
        <button class="btn btn-primary" data-action="keep-power" data-boss="${bossId}">Conserver le pouvoir actuel</button></div></div>`
    : `${powerBox(current, 'Pouvoir actuel')}
      <div class="detail-actions">
        <button class="btn btn-gold num" data-action="reroll" data-boss="${bossId}" ${charges < 1 ? 'disabled' : ''}
          title="Une charge par changement ; 1 charge par nouvelle victoire sur ce boss">Changer le pouvoir (${charges}/${maxC})</button>
        ${rechallengeButton(state, bossId, '⚔ Réaffronter')}
        <button class="btn small${active ? ' btn-primary' : ''}" data-action="toggle-power" data-boss="${bossId}">${active ? 'Actif ✓' : 'Activer'}</button>
      </div>
      <div class="muted power-rules">${charges ? '' : 'Réaffronte ce boss : 1 charge par victoire. '}<button class="btn small help-q${pityOpen ? ' active' : ''}" data-action="power-pity" data-value="${bossId}" aria-expanded="${pityOpen}" aria-label="Règles du changement de pouvoir">?</button>
        ${pityOpen ? `<span>Chaque changement coûte une charge (${maxC} au plus, 1 par nouvelle victoire sur ce boss). ${pity === 0 ? 'Prochain changement : Épique ou mieux garanti.' : `Épique ou mieux garanti dans ${pity} changement${pity > 1 ? 's' : ''}.`}</span>` : ''}</div>`;
  // Piste de maîtrise : paliers de victoires et leurs récompenses.
  const tiers = BALANCE.mastery;
  const last = tiers[tiers.length - 1].victories;
  const track = tiers.map((t, i) => {
    const got = i < entry.masteryClaimed;
    const ready = !got && entry.victories >= t.victories;
    const { victories, ...reward } = t;
    return `<div class="m-step${got ? ' got' : ready ? ' ready' : ''}" style="left:${(victories / last) * 100}%" title="${victories} victoires : ${rewardText(reward, formatNumber)}">
      ${ready ? `<button class="btn btn-gold small" data-action="claim-mastery" data-boss="${bossId}">!</button>` : `<span>${got ? '✔' : img('icon_chest')}</span>`}
      <small>${victories}</small></div>`;
  }).join('');
  return `${header}${offer}
    <div class="boss-bottom">
      <div class="card-sub"><div class="row-between"><div class="section-title">Maîtrise du boss</div><span class="muted">${entry.victories} victoire${entry.victories > 1 ? 's' : ''}</span></div>
        <div class="m-track"><div class="m-fill" style="width:${Math.min(100, (entry.victories / last) * 100)}%"></div>${track}</div></div>
    </div>
    ${lore}${rewardFold}`;
}



// ---------- v10.12 : fiche du boss sur téléphone, en kit (cartes, lignes .m-stat, puces, un seul bouton doré) ----------
// Mêmes actions que sur PC : rechallenge, take-power, keep-power, reroll, toggle-power, claim-mastery ; la règle du changement est dans un repli « ? ».
function bossDetailPhone(ui, state, bossId) {
  const boss = BOSSES[bossId];
  const entry = state.powers[bossId];
  const dungeon = bossDungeon(bossId);
  const where = dungeon ? `Donjon « ${dungeon.name} »` : `${ZONES[ZONES.findIndex((z) => z.bosses.includes(bossId))]?.name ?? ''} · étape ${stageLabel(bossFirstStage(bossId))}`;
  const signature = signatureItemFor(bossId);
  const rw = (cls, title, inner) => `<span class="mp-rwi ${cls}" title="${escapeHtml(title)}" role="img" aria-label="${escapeHtml(title)}">${inner}</span>`;
  const rewards = [
    signature ? rw('r-legendary', `${itemBase(signature.id).name} (objet ancestral, ${Math.round(BALANCE.loot.signatureChance * 100)} %)`, `<img class="px" src="${itemIconUrl({ baseId: signature.id, rarity: 'legendary', slot: signature.slot })}" alt="">`) : '',
    rw('r-epic', 'Objet Rare ou mieux garanti', img('icon_bag')), rw('r-rare', 'Éclats', img('icon_shard')), rw('r-rare', 'Gemmes', img('icon_gem')), rw('r-common', 'Or', img('coin')),
  ].join('');
  const trait = bossTrait(bossId);
  const hero = `<div class="m-card mp-bhero"><div class="mp-bpic">${entry ? portrait(bossId, true, 1) : `<img class="px" src="${portrait(bossId, false)}" alt="">`}</div>
      <div class="mp-bmeta"><b class="mp-bname">${entry ? escapeHtml(boss.name) : '???'}</b><span class="m-chip on mp-static">Boss ancestral</span><small>${escapeHtml(where)}</small></div></div>`;
  const traitCard = trait ? `<div class="m-card mp-trait" style="--trait:${trait.color}"><b>${escapeHtml(trait.name)}</b><small>${escapeHtml(trait.text)}</small><small class="mp-counter">Parade : ${escapeHtml(trait.counter)}</small></div>` : '';
  const lore = entry && BOSS_LORE[bossId] ? mpFold(ui, 'boss-lore', 'Histoire', `<div class="m-card"><div class="mp-note">${escapeHtml(BOSS_LORE[bossId])}</div></div>`) : '';
  const rewardFold = mpFold(ui, 'boss-rewards', 'Récompenses possibles', `<div class="m-card mp-rwrow">${rewards}</div>`);
  const stage = bossDungeon(bossId) ? null : bossFirstStage(bossId);
  const locked = stage !== null && stage > state.maxStage;
  const fight = (label, gold) => (locked
    ? `${(gold ? mBtnGold : mBtn)(label, { disabled: true })}<div class="mp-note mp-center">Atteins l'étape ${stageLabel(stage)}</div>`
    : (gold ? mBtnGold : mBtn)(label, { action: 'rechallenge', attrs: `data-boss="${bossId}"` }));
  if (!entry) {
    return `${hero}${traitCard}<div class="m-card"><div class="mp-sub0">Pouvoir</div><b class="mp-pname">À découvrir</b><div class="mp-note">Vaincs ce boss pour obtenir un pouvoir unique.</div></div>
      ${fight('Combattre ce boss', true)}<div class="mp-gap"></div>${rewardFold}`;
  }
  const current = powerById(entry.current);
  const active = state.equippedPowers.includes(bossId);
  const pity = pityRemaining(state, bossId);
  const charges = entry.charges;
  const maxC = maxCharges(state);
  const powerCard = (power, label) => {
    const family = POWER_FAMILIES[power.family];
    return `<div class="m-card mp-power r-${power.rarity}"><div class="mp-sub0">${label}</div><b class="mp-pname rarity-text r-${power.rarity}">${escapeHtml(power.name)}</b>
      <div class="mp-pmeta"><span class="m-chip on mp-static">${rarityLabel(power.rarity)}</span><span class="m-chip mp-static" style="color:${family.color}">${family.label}</span></div>
      <div class="mp-peff">${effectText(power.effects)}</div></div>`;
  };
  const pityText = `Chaque changement coûte une charge (${maxC} au plus, 1 par nouvelle victoire sur ce boss). ${pity === 0 ? 'Prochain changement : Épique ou mieux garanti.' : `Épique ou mieux garanti dans ${pity} changement${pity > 1 ? 's' : ''}.`}`;
  const actions = entry.pending
    ? `${powerCard(current, 'Pouvoir actuel')}${powerCard(powerById(entry.pending), 'Nouveau pouvoir proposé')}
      ${mBtnGold('Prendre le nouveau', { action: 'take-power', attrs: `data-boss="${bossId}"` })}<div class="mp-gap"></div>${mBtn('Conserver le pouvoir actuel', { action: 'keep-power', attrs: `data-boss="${bossId}"` })}`
    : `${powerCard(current, 'Pouvoir actuel')}
      ${mBtnGold(`Changer le pouvoir (${charges}/${maxC})`, { action: 'reroll', attrs: `data-boss="${bossId}"`, disabled: charges < 1 })}
      <div class="mp-gap"></div>${mpBtns([fight('Réaffronter', false), mBtn(active ? 'Actif ✓' : 'Activer', { action: 'toggle-power', attrs: `data-boss="${bossId}"`, cls: active ? 'ready' : '' })])}
      ${mpFold(ui, 'boss-pity', 'Règles du changement', `<div class="m-card"><div class="mp-note">${charges ? '' : 'Réaffronte ce boss : 1 charge par victoire. '}${pityText}</div></div>`)}`;
  const tiers = BALANCE.mastery;
  const last = tiers[tiers.length - 1].victories;
  const steps = tiers.map((t, i) => {
    const got = i < entry.masteryClaimed;
    const ready = !got && entry.victories >= t.victories;
    const { victories, ...reward } = t;
    const label = `${victories} victoires : ${rewardText(reward, formatNumber)}`;
    const inner = `<span class="mp-stepi">${got ? '✔' : ready ? '!' : img('icon_chest')}</span><small>${victories}</small>`;
    return ready ? `<button type="button" class="mp-step ready" data-action="claim-mastery" data-boss="${bossId}" title="${escapeHtml(label)}" aria-label="Récupérer : ${escapeHtml(label)}">${inner}</button>`
      : `<span class="mp-step${got ? ' got' : ''}" title="${escapeHtml(label)}" role="img" aria-label="${escapeHtml(label)}">${inner}</span>`;
  }).join('');
  const mastery = `<div class="m-card"><div class="mp-between"><span>Maîtrise du boss</span><b>${entry.victories} victoire${entry.victories > 1 ? 's' : ''}</b></div>
      ${mBar(Math.min(1, entry.victories / last))}<div class="mp-steps">${steps}</div></div>`;
  return `${hero}${traitCard}${actions}${mastery}${lore}${rewardFold}`;
}
// ---------- v10.12 : Boss / Pouvoirs sur téléphone (kit mobile) ----------
// Grille de 3 cases (silhouettes tant qu'un boss n'est pas vaincu), « couronnes » dans la tête, fiche du boss dans une .m-sheet.
const TIER_RARITY = { mini: 'common', mid: 'rare', hard: 'epic', dungeon: 'rare' };
function bossPhone(ui, state) {
  const order = bossesInOrder();
  const known = order.filter((id) => state.powers[id]).length;
  const sel = BOSSES[ui.view.bossSel] && order.includes(ui.view.bossSel) ? ui.view.bossSel : (order.find((id) => state.powers[id]) ?? order[0]);
  const crownsMax = order.length * BALANCE.mastery.length;
  const crownsGot = order.reduce((n, id) => n + (state.powers[id]?.masteryClaimed ?? 0), 0);
  const head = `<div class="m-card mp-head"><span class="mp-ico big">${img('icon_boss')}</span><div class="mp-main"><div class="mp-head-line"><b class="num">♛ ${crownsGot}/${crownsMax}</b><small>couronnes</small></div>
      ${mBar(crownsGot / Math.max(1, crownsMax))}<small>${known}/${order.length} boss découverts · pouvoirs actifs ${state.equippedPowers.length}/${powerSlots(state)}</small></div></div>`;
  const tiles = order.map((id) => {
    const boss = BOSSES[id];
    const entry = state.powers[id];
    const seen = Boolean(entry) || (state.codex?.kills?.[id] ?? 0) > 0;
    const sprite = boss.sprite ?? ENEMIES[boss.base].sprite;
    const src = seen ? icon(sprite, 1, boss.palette ? { colors: boss.palette } : {}) : icon(sprite, 1, { tint: { color: '#4a5a78', alpha: 1 } });
    const crowns = entry?.masteryClaimed ?? 0;
    return mTile({ name: seen ? boss.name : '???', rarity: seen ? (TIER_RARITY[boss.tier] ?? 'legendary') : 'common' }, { size: 80, action: 'boss-sel', value: id, src, label: seen ? boss.name : '???', pips: false, plus: crowns ? `♛${crowns}` : '' });
  });
  const open = ui.view.sheetOpen === 'boss';
  const synergies = synergyFamilies(state).map((f) => POWER_FAMILIES[f].label);
  const entry = state.powers[sel];
  const sheet = open ? mSheet(entry ? BOSSES[sel].name : '???', `${bossDetailPhone(ui, state, sel)}
      ${mpFold(ui, 'boss-families', 'Bonus de famille', `<div class="m-card"><div class="mp-note">2 pouvoirs de la même famille = effets +${POWER_RULES.synergy.bonusPct} %.</div></div>`, synergies.length ? `<span class="good">${synergies.join(', ')}</span>` : '')}`, { close: 'close-sheet', back: 'close-sheet', id: 'boss-sheet' }) : '';
  return `${mpFrame('icon_boss', 'Boss', `${head}${mGrid(tiles, 3)}`, true, open)}${sheet}`;
}

export default {
  id: 'boss',
  title: 'Boss',
  icon: 'icon_boss',
  extra: (ui, state) => `Pouvoirs actifs ${state.equippedPowers.length}/${powerSlots(state)}`,
  render(ui, state) {
    if (isMPhone(ui)) return bossPhone(ui, state);
    const order = bossesInOrder();
    const known = order.filter((id) => state.powers[id]).length;
    const sel = BOSSES[ui.view.bossSel] && order.includes(ui.view.bossSel) ? ui.view.bossSel : (order.find((id) => state.powers[id]) ?? order[0]);
    const synergies = synergyFamilies(state).map((f) => POWER_FAMILIES[f].label);
    // v9.1.0 : les collections du Codex sont dans Objectifs › Collections ; ici, victoires, maîtrise et pouvoirs.
    // v9.1.3 (doc2, idée TT) : une barre et une phrase en tête — couronnes de maîtrise obtenues sur toutes celles possibles.
    const crownsMax = order.length * BALANCE.mastery.length;
    const crownsGot = order.reduce((n, id) => n + (state.powers[id]?.masteryClaimed ?? 0), 0);
    return `<div class="mastery-head">${progressBar(crownsGot / crownsMax, `♛ ${crownsGot} / ${crownsMax}`)}
        <div class="muted">Maîtrise : ${crownsGot} couronne${crownsGot > 1 ? 's' : ''} sur ${crownsMax} · ${known}/${order.length} boss découverts · ${powerSlots(state)} pouvoirs actifs à la fois.</div></div>
      <div class="codex">
        <div class="codex-list">${order.map((id) => bossListItem(ui, state, id, sel)).join('')}</div>
        <div class="card codex-detail sheet${ui.view.sheetOpen === 'boss' ? ' sheet-open' : ''}">
          <button class="btn small sheet-close" data-action="close-sheet" aria-label="Fermer la fiche">✕</button>
          ${bossDetail(ui, state, sel)}
          ${fold(ui, 'boss-families', `Bonus de famille${synergies.length ? ` : <span class="good">${synergies.join(', ')}</span>` : ''}`, `<div class="muted codex-help">2 pouvoirs de la même famille = effets +${POWER_RULES.synergy.bonusPct} %.</div>`)}</div>
      </div>`;
  },
};
