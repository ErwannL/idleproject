// Boss : Codex des pouvoirs ancestraux, relance (après avoir réaffronté le boss), maîtrise, synergies.
import { BALANCE } from '../../data/balance.js';
import { BOSSES, ENEMIES } from '../../data/enemies.js';
import { POWER_FAMILIES, POWER_RULES } from '../../data/powers.js';
import { stageLabel } from '../../core/combat.js';
import { itemBase, signatureItemFor } from '../../core/loot.js';
import {
  bossDungeon, bossFirstStage, bossesInOrder, pityRemaining, powerById, powerSlots,
  rerollCost, synergyFamilies,
} from '../../core/powers.js';
import { rewardText } from '../../core/rewards.js';
import { itemIconUrl } from '../../render/pixel.js';
import { ZONES } from '../../data/zones.js';
import { COLLECTIONS } from '../../data/codex.js';
import { BOSS_LORE } from '../../data/lore.js';
import { collectionStatus } from '../../core/codex.js';
import { coin, effectText, escapeHtml, formatNumber, icon, img, progressBar, rarityLabel } from '../common.js';
import { animCanvas } from '../animator.js';

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
  if (known) return animCanvas(`foe:${boss.sprite ?? ENEMIES[boss.base].sprite}`, 92, 80, scale);
  const sprite = boss.sprite ?? ENEMIES[boss.base].sprite;
  return icon(sprite, 1, known ? (boss.palette ? { colors: boss.palette } : {}) : { tint: { color: '#4a5a78', alpha: 1 } });
}

// Collections du Codex : paliers de découverte et récompenses.
function collections(state) {
  return `<div class="collections">${COLLECTIONS.map((c) => {
    const st = collectionStatus(state, c);
    const goal = st.next ?? c.milestones[c.milestones.length - 1];
    return `<div class="collection">${img(c.icon)}<div class="grow"><b>${c.label}</b>
        ${progressBar(Math.min(1, st.found / goal), `${st.found} / ${goal}`)}</div>
      ${st.next === null ? '<span class="good">✔</span>' : `<button class="btn small ${st.ready ? 'btn-gold' : ''}" data-action="claim-collection" data-value="${c.id}"
        ${st.ready ? '' : 'disabled'} title="${rewardText(c.reward)}">${st.ready ? 'Récupérer' : '…'}</button>`}</div>`;
  }).join('')}</div>`;
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
  const header = `<div class="boss-hero">
      <div class="boss-big">${entry ? portrait(bossId, true, 2) : `<img class="px" src="${portrait(bossId, false)}" alt="">`}</div>
      <div class="grow"><div class="row"><span class="boss-title">${entry ? escapeHtml(boss.name) : '???'}</span><span class="badge-ancestral">Boss ancestral</span></div>
        <div class="muted">📍 ${escapeHtml(where)}</div>
        <p class="lore">${entry ? escapeHtml(BOSS_LORE[bossId] ?? '') : 'Vainquez ce boss pour découvrir son histoire et son pouvoir ancestral.'}</p></div>
    </div>`;
  if (!entry) {
    return `${header}<div class="power-box unknown"><div class="section-title">Pouvoir ancestral</div><div class="power-name">À découvrir</div>
        <div class="muted">Vainquez ce boss pour obtenir un pouvoir ancestral unique.</div></div>
      <button class="btn" data-action="rechallenge" data-boss="${bossId}">⚔ Combattre ce boss</button>
      <div class="card-sub"><div class="section-title">Récompenses possibles</div><div class="reward-row">${rewards}</div></div>`;
  }
  const current = powerById(entry.current);
  const active = state.equippedPowers.includes(bossId);
  const pity = pityRemaining(state, bossId);
  const cost = rerollCost(state, bossId);
  const charges = entry.charges;
  const offer = entry.pending
    ? `<div class="power-offer"><div class="offer-cols">${powerBox(current, 'Pouvoir ancestral actuel')}<div class="offer-arrow">»</div>${powerBox(powerById(entry.pending), 'Nouveau pouvoir proposé')}</div>
      <div class="detail-actions">
        <button class="btn btn-gold" data-action="take-power" data-boss="${bossId}">Prendre le nouveau</button>
        <button class="btn btn-primary" data-action="keep-power" data-boss="${bossId}">Conserver le pouvoir actuel</button></div></div>`
    : `${powerBox(current, 'Pouvoir ancestral actuel')}
      <div class="detail-actions">
        <button class="btn btn-gold num" data-action="reroll" data-boss="${bossId}" data-cost="${cost}" data-needs-charge="${charges}"
          ${state.gold < cost || charges < 1 ? 'disabled' : ''}
          title="${charges < 1 ? 'Réaffrontez ce boss pour gagner une charge de relance' : 'Propose un autre pouvoir ; vous choisirez ensuite'}">Relancer ${coin()} ${formatNumber(cost)}</button>
        <button class="btn" data-action="rechallenge" data-boss="${bossId}">⚔ Réaffronter</button>
        <button class="btn small${active ? ' btn-primary' : ''}" data-action="toggle-power" data-boss="${bossId}">${active ? 'Actif ✓' : 'Activer'}</button>
      </div>
      <div class="muted pity">Charges de relance : <b class="${charges ? 'good' : 'bad'}">${charges}/${POWER_RULES.maxCharges}</b> (1 par nouvelle victoire)
        · ${pity === 0 ? 'prochaine relance Épique+ garantie' : `Épique+ garanti dans ${pity} relance${pity > 1 ? 's' : ''}`}</div>`;
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
      <div class="card-sub"><div class="section-title">Récompenses possibles</div><div class="reward-row">${rewards}</div></div>
      <div class="card-sub"><div class="row-between"><div class="section-title">Maîtrise du boss</div><span class="muted">${entry.victories} victoire${entry.victories > 1 ? 's' : ''}</span></div>
        <div class="m-track"><div class="m-fill" style="width:${Math.min(100, (entry.victories / last) * 100)}%"></div>${track}</div></div>
    </div>`;
}

export default {
  id: 'boss',
  title: 'Codex des boss',
  icon: 'icon_boss',
  extra: (ui, state) => `Pouvoirs actifs ${state.equippedPowers.length}/${powerSlots(state)}`,
  render(ui, state) {
    const order = bossesInOrder();
    const known = order.filter((id) => state.powers[id]).length;
    const sel = BOSSES[ui.view.bossSel] && order.includes(ui.view.bossSel) ? ui.view.bossSel : (order.find((id) => state.powers[id]) ?? order[0]);
    const synergies = synergyFamilies(state).map((f) => POWER_FAMILIES[f].label);
    return `<div class="card"><div class="row-between"><div class="section-title">Collections</div>
        <span class="muted">Boss découverts : ${known}/${order.length}</span></div>${collections(state)}</div>
      <div class="codex">
        <div class="codex-list">${order.map((id) => bossListItem(ui, state, id, sel)).join('')}</div>
        <div class="card codex-detail">${bossDetail(ui, state, sel)}
          <div class="muted codex-help">${powerSlots(state)} pouvoirs actifs à la fois. Synergie : 2 pouvoirs de la même famille = effets +${POWER_RULES.synergy.bonusPct} %.
            ${synergies.length ? `<span class="good">Synergie active : ${synergies.join(', ')}</span>` : ''}</div></div>
      </div>`;
  },
};
