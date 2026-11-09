// v9.3.4 : la Forge, un lieu à part (Héros › Forge). En haut : la boucle Recycler → Éclats → Forger ; puis le recyclage
// des objets inutiles (aperçu de ce qui part et de ce que ça rapporte), puis la fusion et la fabrication.
import { BALANCE } from '../../data/balance.js';
import { craftCost } from '../../core/forge.js';
import { recycleGoldOf, uselessItems } from '../../core/inventory.js';
import { recycleMaterials } from '../../core/loot.js';
import { coin, escapeHtml, formatNumber, img, itemFrame, shard } from '../common.js';
import { forge } from './inventory.js';

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

export default {
  id: 'forge',
  title: 'Forge',
  icon: 'icon_anvil',
  render(ui, state) {
    const p = uselessPreview(state);
    const anim = ui.view.forgeFx ? `<div class="forge-fx ${ui.view.forgeFx}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>` : '';
    return `<div class="forge-tile"><div class="forge-anvil">${img('icon_anvil')}<span class="forge-flame"></span></div>${anim}
        <div class="forge-loop" aria-label="Recycler, puis éclats, puis forger">
          <span>${img('icon_bag')}<b>Recycler</b></span><i>→</i><span>${img('icon_shard')}<b>Éclats</b></span><i>→</i><span>${img('icon_anvil')}<b>Forger</b></span></div>
        <div class="forge-count">${shard()} <b class="num">${formatNumber(state.materials.shards)}</b> éclats</div></div>
      <div class="card"><div class="section-title">Recycler</div>
        <p class="muted">Les objets verrouillés, légendaires, ancestraux et meilleurs que les vôtres ne partent jamais.</p>
        ${p.list.length ? `<div class="recycle-preview">${p.list.slice(0, 12).map((i) => itemFrame(i, { tag: 'div' })).join('')}${p.list.length > 12 ? `<span class="muted">+${p.list.length - 12}</span>` : ''}</div>` : ''}
        ${recycleButton(state, 'primary-action')}</div>
      ${forge(ui, state)}`;
  },
};
export const escape = escapeHtml;
