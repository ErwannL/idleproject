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
import { animCanvas } from '../animator.js';

// v9.1.0 : un boss hors de portée n'est plus « combattu » (le jeu restait à l'étape max et coupait l'avance auto).
function rechallengeButton(state, bossId, label) {
  const stage = bossDungeon(bossId) ? null : bossFirstStage(bossId);
  if (stage !== null && stage > state.maxStage) {
    return `<button class="btn" disabled>${label}</button><span class="muted"> Atteignez l'étape ${stageLabel(stage)}</span>`;
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
    `<div class="reward-icon r-rare" title="Essences">${img('icon_essence')}</div>`,
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
    ${trait ? `<div class="trait-box" style="--trait:${trait.color}"><b>${escapeHtml(trait.name)}</b> : ${escapeHtml(trait.text)}. <span class="muted">Contre : ${escapeHtml(trait.counter)}</span></div>` : ''}`;
  const lore = entry && BOSS_LORE[bossId] ? fold(ui, 'boss-lore', 'Histoire', `<p class="lore">${escapeHtml(BOSS_LORE[bossId])}</p>`) : '';
  const rewardFold = fold(ui, 'boss-rewards', 'Récompenses possibles', `<div class="reward-row">${rewards}</div>`);
  if (!entry) {
    return `${header}<div class="power-box unknown"><div class="section-title">Pouvoir</div><div class="power-name">À découvrir</div>
        <div class="muted">Vainquez ce boss pour obtenir un pouvoir unique.</div></div>
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
      <div class="muted power-rules">${charges ? '' : 'Réaffrontez ce boss : 1 charge par victoire. '}<button class="btn small help-q${pityOpen ? ' active' : ''}" data-action="power-pity" data-value="${bossId}" aria-expanded="${pityOpen}" aria-label="Règles du changement de pouvoir">?</button>
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

export default {
  id: 'boss',
  title: 'Boss',
  icon: 'icon_boss',
  extra: (ui, state) => `Pouvoirs actifs ${state.equippedPowers.length}/${powerSlots(state)}`,
  render(ui, state) {
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
