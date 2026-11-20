// v10.3 (partie 9) : la Forge explique sa boucle en images. Une seule illustration en tête (la bannière de l'onglet),
// puis 4 ateliers numérotés dans l'ordre de la boucle, reliés par des flèches : 1 Recycler, 2 Renforcer, 3 Fusionner,
// 4 Fabriquer. Chaque atelier a son schéma en images, sa phrase de règle, sa ligne verte « maintenant » et son bouton ;
// dessous, le détail de l'atelier choisi. Les règles sont dans core/forge.js (rien n'est calculé ici).
import { BALANCE } from '../../data/balance.js';
import { HERO_SLOTS, SLOTS, eqSlot } from '../../data/items.js';
import { bastionOpen } from '../../core/bastion.js';
import { levelForStage } from '../../core/combat.js';
import { companionById, skillKillGold } from '../../core/companions.js';
import { gearStats, gearUpgradePreview, slotName, statText, unitGear } from '../../core/companion-gear.js';
import { craftCost, craftOdds, estimateGainPct, fusionGroups, fusionKeep, fusionPreview, upgradeRanking } from '../../core/forge.js';
import { recycleGoldOf, uselessItems } from '../../core/inventory.js';
import { recycleMaterials } from '../../core/loot.js';
import { setById } from '../../core/sets.js';
import { slotIconName } from '../../render/pixel.js';
import { coin, escapeHtml, formatDecimal, formatNumber, img, rarityLabel, shard } from '../common.js';
import { costLines, itemTile, pctText, reinforceSection } from './equip-sheet.js';

export function uselessPreview(state) {
  const list = uselessItems(state);
  const gold = list.reduce((s, i) => s + recycleGoldOf(state, i), 0);
  const shards = list.reduce((s, i) => s + recycleMaterials(i).shards, 0);
  return { list, gold, shards };
}
export function canForgeSomething(state) {
  const c = craftCost(state, undefined, 'rare');
  return state.inventory.length < BALANCE.loot.inventorySize && state.gold >= c.gold && state.materials.shards >= c.shards;
}
export function recycleButton(state, cls = '') {
  const p = uselessPreview(state);
  return `<button class="btn btn-outline-gold recycle-useless ${cls}" data-action="recycle-useless" ${p.list.length ? '' : 'disabled'}>
    ♻ Recycler les objets inutiles (${p.list.length})${p.list.length ? ` · +${formatNumber(p.gold)} ${coin()} +${p.shards} ${shard()}` : ''}</button>`;
}
// Nombre de fusions sûres possibles (pastille de l'atelier 3).
export function fusionCount(state) {
  return fusionGroups(state, BALANCE, fusionKeep(state)).reduce((t, g) => t + Math.floor(g.usable / BALANCE.forge.fusionCount), 0);
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
// Raisons de protection affichées (fusionKeep(state).reason).
const PROTECT_LABELS = { upgraded: 'renforcé', better: 'meilleur que l\'équipé', set: 'utile à un ensemble', affix: 'effet gardé', build: 'dans un build' };
const teamOf = (state) => (state.companions?.equipped ?? []).map((id) => companionById(id)).filter((c) => c?.kind === 'ally');

// Ligne « ce que tu peux faire maintenant » de chaque atelier : { ok, text }.
export function forgeNow(state) {
  const p = uselessPreview(state);
  const count = BALANCE.forge.fusionCount;
  const ranking = upgradeRanking(state);
  const top = ranking.find((r) => r.preview.canPay);
  const first = ranking.find((r) => !r.preview.atMax);
  const groups = fusionGroups(state, BALANCE, fusionKeep(state));
  const order = ['common', 'rare', 'epic', 'legendary'];
  const sure = groups.filter((g) => g.auto).sort((a, b) => order.indexOf(b.rarity) - order.indexOf(a.rarity) || b.usable - a.usable)[0];
  const risky = groups.find((g) => g.usable >= g.stakes[0]);
  const rare = craftCost(state, undefined, 'rare'), epic = craftCost(state, undefined, 'epic');
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const can = (c) => state.gold >= c.gold && state.materials.shards >= c.shards;
  const grp = (g) => `${g.usable} × ${SLOTS[g.slot]} ${rarityLabel(g.rarity)}`;
  return {
    preview: p, ranking, groups,
    recycle: p.list.length ? { ok: true, text: `${plural(p.list.length, 'objet inutile', 'objets inutiles')} → +${p.shards} éclats, +${formatNumber(p.gold)} or` } : { ok: false, text: 'Rien à recycler : tout ce que tu as te sert.' },
    upgrade: top ? { ok: true, text: `${top.item.name} +${top.preview.level} → +${top.preview.level + 1} : ${pctText(top.gainPct)} de puissance` }
      : first ? { ok: false, text: first.preview.lack.shards ? `Il manque ${plural(first.preview.lack.shards, 'éclat', 'éclats')} pour ${first.item.name} +${first.preview.level + 1}` : `Il manque ${formatNumber(first.preview.lack.gold)} or pour ${first.item.name} +${first.preview.level + 1}` }
      : { ok: false, text: ranking.length ? 'Tes objets portés sont au maximum.' : 'Équipe d\'abord un objet.' },
    fuse: sure ? { ok: true, text: `${grp(sure)} → ${Math.floor(sure.usable / count)} × ${rarityLabel(sure.next)}, sans risque` }
      : risky ? { ok: true, text: `${grp(risky)} → 1 × ${rarityLabel(risky.next)}, à tenter` }
      : { ok: false, text: `Il faut ${count} objets de la même place et de la même rareté.` },
    craft: full ? { ok: false, text: 'Sac plein : recycle d\'abord.' } : can(epic) ? { ok: true, text: 'Tu peux fabriquer un objet Épique ou mieux.' } : can(rare) ? { ok: true, text: 'Tu peux fabriquer un objet Rare ou mieux.' }
      : { ok: false, text: state.materials.shards < rare.shards ? `Il manque ${plural(rare.shards - state.materials.shards, 'éclat', 'éclats')}.` : `Il manque ${formatNumber(Math.ceil(rare.gold - state.gold))} or.` },
  };
}

// Atelier 1 : ce qui part, ce que ça rapporte.
function recycleBody(state, p) {
  return `<div class="card fg-body">${p.list.length
    ? `<h4>Ces objets ne te servent plus</h4><div class="fg-tiles">${p.list.slice(0, 14).map((i) => itemTile(i)).join('')}${p.list.length > 14 ? `<span class="muted">+${p.list.length - 14}</span>` : ''}</div>`
    : '<p class="muted">Rien à recycler : tes objets sont protégés (verrouillés, meilleurs que l\'équipé ou utiles à un ensemble).</p>'}
    ${recycleButton(state)}<p class="muted">Jamais recyclé : objet porté, protégé, Légendaire, ancestral, ou meilleur que ce que tu portes.</p></div>`;
}

// Atelier 2 : les objets portés, triés par gain de puissance par éclat ; l'objet choisi montre la même section
// « Renforcer » que la fiche d'objet de l'Équipement.
function upgradeBody(ui, state, ranking) {
  const kg = skillKillGold(state);
  const units = teamOf(state).flatMap((c) => Object.values(unitGear(state, c.id)).filter(Boolean).map((item) => ({ item, unit: c, preview: gearUpgradePreview(state, item, kg) })));
  const all = [...ranking.map((r) => ({ ...r, unit: null })), ...units];
  if (!all.length) return `<div class="card fg-body"><p class="muted">Tu ne portes encore aucun objet. Équipe-toi d'abord.</p><button class="btn btn-primary" data-action="open-tab" data-value="inventory">Ouvrir l'Équipement ›</button></div>`;
  const sel = all.find((r) => r.item.id === ui.view.forgeUpSel) ?? all[0];
  const row = (r) => {
    const p = r.preview;
    const gain = p.atMax ? `au maximum (+${p.max})` : r.unit ? p.rows.map((x) => `${x.key === 'cd' ? '−' : '+'}${formatDecimal(x.after - x.before, 2)} %`).join(' · ') : `${pctText(r.gainPct)} de puissance`;
    return `<button class="fg-up-row r-${r.item.rarity}${r.item.id === sel.item.id ? ' on' : ''}" data-action="forge-up-sel" data-id="${r.item.id}" aria-pressed="${r.item.id === sel.item.id}">${itemTile(r.item)}
      <span class="fg-up-id"><b class="rarity-text">${escapeHtml(r.item.name)}${r.item.upgrades ? ` +${r.item.upgrades}` : ''}</b><small>${r.unit ? `${escapeHtml(slotName(r.unit, eqSlot(r.item)))} de ${escapeHtml(r.unit.name)}` : HERO_SLOTS[r.slot]}</small></span>
      <span class="fg-up-gain ${p.canPay ? 'good' : 'muted'} num">${gain}</span>${p.cost ? `<span class="fg-up-cost num">${shard()} ${p.cost.shards} · ${coin()} ${formatNumber(p.cost.gold)}</span>` : ''}</button>`;
  };
  return `<div class="fg-body fg-up"><div class="card fg-up-list"><h4>Tes objets portés : le meilleur gain par éclat d'abord</h4>${ranking.map((r) => row({ ...r, unit: null })).join('')}
      ${units.length ? `<h4>Objets de tes compagnons</h4>${units.map(row).join('')}` : ''}</div>
    <aside class="eq-sheet fg-sheet r-${sel.item.rarity}" aria-label="${escapeHtml(sel.item.name)}"><div class="eq-sh-head">${itemTile(sel.item)}<div class="eq-sh-id"><b class="eq-name r-${sel.item.rarity}">${escapeHtml(sel.item.name)}${sel.item.upgrades ? ` +${sel.item.upgrades}` : ''}</b>
        <div class="muted">${sel.unit ? `Porté par ${escapeHtml(sel.unit.name)} : ${escapeHtml(statText(gearStats(sel.item, state)))}` : `${HERO_SLOTS[sel.slot]} de ton héros`}</div></div></div>
      ${reinforceSection(ui, state, sel.item)}</aside></div>`;
}

// Atelier 3 : fusion détaillée — 5 cases remplies d'elles-mêmes, jauge de chance, règle de pitié, « Ce que tu
// obtiens », et un bouton qui reprend la mise et la chance (« Fusionner (4 objets · 65 %) »).
function fuseBody(ui, state, groups) {
  const count = BALANCE.forge.fusionCount;
  const keep = fusionKeep(state);
  if (!groups.length) {
    return `<div class="card fg-body"><div class="fg-cases">${Array.from({ length: count }, () => '<div class="eq-tile empty"></div>').join('<i>+</i>')}<i>→</i><div class="eq-tile empty next">?</div></div>
      <p class="muted">Il faut ${count} objets de la même place et de la même rareté. Ils deviennent 1 objet de la rareté au-dessus.</p></div>`;
  }
  const keyOf = (g) => `${g.slot}|${g.rarity}`;
  const g = groups.find((x) => keyOf(x) === ui.view.fuseOpen) ?? groups.find((x) => x.usable >= x.stakes[0]) ?? groups[0];
  const key = keyOf(g);
  const auto = groups.filter((x) => x.auto);
  const nAll = auto.reduce((t, x) => t + Math.floor(x.usable / count) * count, 0);
  const all = auto.length > 1 || (auto.length === 1 && auto[0].usable >= count * 2)
    ? `<button class="btn btn-outline-gold fg-all${ui.view.fuseArmed ? ' armed' : ''}" data-action="fuse-all">${ui.view.fuseArmed ? `Confirmer : fusionner ${nAll} objets ?` : `Fusionner tout ce qui est sûr · ${plural(auto.length, 'groupe', 'groupes')}`}</button>` : '';
  const chips = groups.map((x) => `<button class="fg-group${keyOf(x) === key ? ' on' : ''}" data-action="fuse-open" data-value="${keyOf(x)}" aria-pressed="${keyOf(x) === key}">${img(slotIconName(x.slot))}
      <span>${SLOTS[x.slot]} · <b class="r-${x.rarity} rarity-text">${rarityLabel(x.rarity)}</b> → <b class="r-${x.next} rarity-text">${rarityLabel(x.next)}</b></span><small class="num">${x.bag} dans le sac</small></button>`).join('');
  const included = Boolean(ui.view.fusionInclude?.[key]);
  const pv = fusionPreview(state, g.slot, g.rarity, included ? fusionKeep(state, { include: [key] }) : keep);
  const cases = Array.from({ length: count }, (_, i) => (pv.used[i] ? itemTile(pv.used[i], { note: `<small class="eq-gain">Niv. ${pv.used[i].level}</small>` }) : '<div class="eq-tile empty"></div>')).join('<i>+</i>');
  const reasons = [...new Set(state.inventory.filter((i) => i.slot === g.slot && i.rarity === g.rarity && keep(i)).map((i) => PROTECT_LABELS[keep.reason(i)]).filter(Boolean))].join(', ');
  const protectedLine = g.protected ? `<div class="fg-protected"><span class="muted">${plural(g.protected, 'objet protégé', 'objets protégés')} (${reasons})</span>
      <button class="btn small${included ? ' active' : ''}" data-action="fuse-include" data-value="${key}" aria-pressed="${included}">${included ? 'Inclus' : 'Inclure'}</button></div>` : '';
  const risky = pv.stakes.some((s) => s.chance < 100);
  const gauge = `<div class="fg-gauge"><div class="fg-gauge-bar ${pv.chance >= 100 ? 'sure' : ''}" role="img" aria-label="Chance de réussite : ${pv.chance ?? 0} %"><i style="width:${pv.chance ?? 0}%"></i><b class="num">${pv.stake ? `${pv.chance} %` : '—'}</b></div>
      <div class="fg-stakes">${pv.stakes.map((s) => `<span class="${s.stake === pv.stake ? 'on' : ''}${s.possible ? '' : ' off'}">${plural(s.stake, 'objet', 'objets')} : <b class="num">${s.chance} %</b></span>`).join('')}</div>
      <p class="muted">${risky ? `Règle de pitié : après un échec, +${pv.pityStep} % à la tentative suivante${pv.pity ? ` (déjà +${pv.pity} % en réserve)` : ''}. Si la fusion rate, l'objet de plus haut niveau t'est rendu.` : `${count} objets : la fusion réussit toujours.`}</p></div>`;
  const chosen = ui.view.fuseSet?.[key] ?? pv.inherit[0]?.set;
  const inherit = pv.inherit.length ? `<li>${img('icon_star')}<span>Ensemble gardé, au choix :</span><span class="fg-inherit">${pv.inherit.map((o) => `<button class="btn chip-btn small${chosen === o.set ? ' active' : ''}" data-action="fuse-set" data-value="${key}" data-set="${o.set}" aria-pressed="${chosen === o.set}">${img(`set_${o.set}`)} ${escapeHtml(setById(o.set)?.name ?? o.set)} · ${o.chance} %</button>`).join('')}<button class="btn chip-btn small${chosen === 'none' ? ' active' : ''}" data-action="fuse-set" data-value="${key}" data-set="none" aria-pressed="${chosen === 'none'}">Aucun</button></span></li>` : '';
  const est = pv.level ? estimateGainPct(state, g.slot, pv.next, pv.level) : null;
  const gets = `<div class="fg-gets"><h4>Ce que tu obtiens</h4><ul class="eq-stats">
      <li>${img(slotIconName(g.slot))}<span>1 ${escapeHtml(SLOTS[g.slot].toLowerCase())}, modèle au hasard</span><b class="r-${pv.next} rarity-text">${rarityLabel(pv.next)}</b></li>
      <li>${img('icon_upgrade')}<span>Niveau d'objet (celui du meilleur objet fusionné)</span><b class="num">${pv.level ?? '—'}</b></li>${inherit}
      ${est === null ? '' : `<li>${img('icon_crown')}<span>Gain estimé face à ton objet porté</span><b class="num ${est > 0 ? 'good' : 'muted'}">${est > 0 ? `${pctText(est)} de puissance` : 'pas mieux que le tien'}</b></li>`}</ul></div>`;
  const lower = pv.stakes.filter((s) => s.possible && s.stake !== pv.stake).map((s) => `<button class="btn small" data-action="fuse" data-value="${key}" data-stake="${s.stake}">Tenter à ${s.stake} · ${s.chance} %</button>`).join('');
  const main = pv.stake ? `<button class="btn btn-gold fg-fuse" data-action="fuse" data-value="${key}" data-stake="${pv.stake}">Fusionner (${pv.stake} objets · ${pv.chance} %)</button>`
    : `<span class="bad">Il manque ${plural(pv.stakes[0].stake - pv.available, 'objet', 'objets')} pour fusionner.</span>`;
  return `<div class="card fg-body fg-fusion">${all}${ui.view.fuseMsg ? `<div class="bad" role="status">${escapeHtml(ui.view.fuseMsg)}</div>` : ''}
    <div class="fg-groups" role="group" aria-label="Groupe à fusionner">${chips}</div>
    <div class="fg-fusion-grid"><div><h4>Les ${count} cases, remplies avec tes moins bons objets</h4><div class="fg-cases">${cases}<i>→</i><div class="eq-tile next r-${pv.next}">?</div></div>
      <p class="muted">Jamais pris : objet porté, protégé (cadenas), ancestral.</p>${protectedLine}${gauge}</div>
      <div>${gets}<div class="fg-fuse-btns">${main}${lower}</div></div></div></div>`;
}

// Atelier 4 : la place en icônes, les chances de rareté du résultat et son niveau.
function craftBody(ui, state) {
  const slot = SLOTS[ui.view.craftSlot] ? ui.view.craftSlot : 'weapon';
  const full = state.inventory.length >= BALANCE.loot.inventorySize;
  const lvl = levelForStage(state.maxStage);
  const slots = Object.entries(SLOTS).map(([k, l]) => `<button class="fg-slot${k === slot ? ' on' : ''}" data-action="craft-slot" data-value="${k}" aria-pressed="${k === slot}" title="${escapeHtml(l)}">${img(slotIconName(k))}<small>${escapeHtml(l)}</small></button>`).join('');
  const tier = (t) => {
    const cost = craftCost(state, undefined, t);
    const short = state.gold < cost.gold || state.materials.shards < cost.shards;
    return `<div class="fg-tier ${t}"><h4>${t === 'epic' ? 'Épique ou mieux' : 'Rare ou mieux'}</h4>
      <div class="fg-odds">${craftOdds(t).map((o) => `<span class="r-${o.rarity}"><b class="num rarity-text">${formatDecimal(o.pct, o.pct < 10 ? 1 : 0)} %</b> ${rarityLabel(o.rarity)}</span>`).join('')}</div>
      ${costLines(state, cost)}
      <button class="btn ${t === 'epic' ? 'btn-gold' : 'btn-primary'}" data-action="craft" data-value="${slot}" data-tier="${t}" ${short || full ? 'disabled' : ''}>Fabriquer ${t === 'epic' ? 'Épique+' : 'Rare+'}</button></div>`;
  };
  return `<div class="card fg-body fg-craft"><h4>1. Choisis la place</h4><div class="fg-slots" role="group" aria-label="Place à fabriquer">${slots}</div>
    <h4>2. Choisis la rareté</h4><p class="fg-level">Tu reçois : <b>${escapeHtml(SLOTS[slot])}</b>, niveau <b class="num">${lvl}</b>, ton étape max${lvl === state.maxStage ? '' : ` (étape ${state.maxStage})`}.</p>
    <div class="fg-tiers">${tier('rare')}${tier('epic')}</div>${full ? '<div class="bad">Sac plein : recycle d\'abord.</div>' : ''}
    ${bastionOpen(state) ? '<button class="fg-order" data-action="bastion-open" data-value="forge">Commander au forgeron : moins cher, prêt en 1 h à 8 h ›</button>' : ''}</div>`;
}

const SEGS = ['recycle', 'upgrade', 'fuse', 'craft'];

export default {
  id: 'forge',
  title: 'Forge',
  icon: 'icon_anvil',
  render(ui, state) {
    const now = forgeNow(state);
    const seg = SEGS.includes(ui.view.forgeSeg) ? ui.view.forgeSeg : 'recycle';
    const sword = slotIconName('weapon'), helm = slotIconName('helmet');
    const it = (pic, rar, extra = '') => `<span class="fg-it r-${rar}">${img(pic)}${extra}</span>`;
    const fx = ui.view.forgeFx ? String(ui.view.forgeFx).split(' ')[0] : '';
    const step = (id, num, title, diagram, rule, line, btn) => `<div class="fg-step${seg === id ? ' on' : ''}${(fx === 'recycle' && id === 'recycle') || (fx === 'craft' && id === 'craft') ? ' fx' : ''}" data-action="forge-seg" data-value="${id}">
        <div class="fg-step-head"><span class="fg-num">${num}</span><b>${title}</b></div>
        <div class="fg-diagram" aria-hidden="true">${diagram}</div>
        <p class="fg-rule">${rule}</p>
        <p class="fg-now ${line.ok ? 'good' : 'muted'}">${line.ok ? '▶ ' : ''}${escapeHtml(line.text)}</p>${btn}</div>`;
    const n = now.preview.list.length;
    const fuses = fusionCount(state);
    const steps = [
      step('recycle', 1, 'Recycler', `${it(sword, 'common')}${it(helm, 'rare')}<i>→</i>${img('icon_shard')}${img('coin')}`,
        'Les objets inutiles deviennent des éclats et de l\'or.', now.recycle,
        `<button class="btn btn-gold fg-btn" data-action="recycle-useless" ${n ? '' : 'disabled'}>Recycler${n ? ` (${n})` : ''}</button>`),
      step('upgrade', 2, 'Renforcer', `${it(sword, 'epic')}<b>+</b>${img('icon_shard')}<i>→</i>${it(sword, 'epic', '<em>+1</em>')}`,
        `Un objet et des éclats : une de ses statistiques gagne ${BALANCE.forge.upgradeBoostPct} %.`, now.upgrade,
        '<button class="btn btn-primary fg-btn" data-action="forge-seg" data-value="upgrade">Renforcer</button>'),
      step('fuse', 3, 'Fusionner', `<span class="fg-five">${'<s class="r-epic"></s>'.repeat(BALANCE.forge.fusionCount)}</span><i>→</i>${it(sword, 'legendary')}`,
        `${BALANCE.forge.fusionCount} objets de la même place et de la même rareté : 1 objet de la rareté au-dessus.`, now.fuse,
        `<button class="btn btn-primary fg-btn" data-action="forge-seg" data-value="fuse">Fusionner${fuses ? ` (${fuses})` : ''}</button>`),
      step('craft', 4, 'Fabriquer', `${img('coin')}<b>+</b>${img('icon_shard')}<i>→</i>${it(helm, 'rare', '<em>✦</em>')}`,
        'De l\'or et des éclats : un objet neuf, pour la place que tu choisis.', now.craft,
        '<button class="btn btn-primary fg-btn" data-action="forge-seg" data-value="craft">Fabriquer</button>'),
    ].join('<i class="fg-arrow" aria-hidden="true">→</i>');
    const body = seg === 'recycle' ? recycleBody(state, now.preview) : seg === 'upgrade' ? upgradeBody(ui, state, now.ranking) : seg === 'fuse' ? fuseBody(ui, state, now.groups) : craftBody(ui, state);
    const chip = (key, pic, v, word) => `<button class="eq-res-chip" data-gloss="${key}" title="${word}">${img(pic)}<b class="num">${formatNumber(v)}</b><small>${word}</small></button>`;
    return `<div class="fg"><div class="eq-res fg-res" role="group" aria-label="Tes ressources"><span class="eq-res-title">Tes ressources</span>${chip('shards', 'icon_shard', state.materials.shards, 'Éclats')}${chip('gold', 'coin', state.gold, 'Or')}</div>
      <div class="fg-loop">${steps}</div>${body}</div>`;
  },
};
export const escape = escapeHtml;
