// v9.3.4 : la Forge, un lieu à part (Héros › Forge). En haut : la boucle Recycler → Éclats → Forger ; puis le recyclage
// des objets inutiles (aperçu de ce qui part et de ce que ça rapporte), puis la fusion et la fabrication.
import { BALANCE } from '../../data/balance.js';
import { craftCost } from '../../core/forge.js';
import { recycleGoldOf, uselessItems } from '../../core/inventory.js';
import { recycleMaterials } from '../../core/loot.js';
import { coin, escapeHtml, formatNumber, img, itemFrame, shard } from '../common.js';
import { forge, fusionCount } from './inventory.js';

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
    // v9.8 (C2) : la grande enclume, 3 gros boutons avec un compteur, puis la seule partie choisie.
    const p = uselessPreview(state);
    const seg = ['recycle', 'fuse', 'craft'].includes(ui.view.forgeSeg) ? ui.view.forgeSeg : 'recycle';
    const fuses = fusionCount(state);
    const crafts = canForgeSomething(state) ? 1 : 0;
    const anim = ui.view.forgeFx ? `<div class="forge-fx ${ui.view.forgeFx}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>` : '';
    const btn = (id, icon, label, n) => `<button class="forge-big${seg === id ? ' on' : ''}" data-action="forge-seg" data-value="${id}" aria-pressed="${seg === id}">
        ${img(icon)}<b>${label}</b>${n ? `<span class="forge-badge">${n}</span>` : ''}</button>`;
    const body = seg === 'recycle'
      ? `<div class="card">${p.list.length ? `<div class="recycle-preview">${p.list.slice(0, 12).map((i) => itemFrame(i, { tag: 'div' })).join('')}${p.list.length > 12 ? `<span class="muted">+${p.list.length - 12}</span>` : ''}</div>` : '<p class="muted">Rien à recycler : tes objets sont protégés (verrouillés, meilleurs ou utiles à un ensemble).</p>'}
        ${recycleButton(state, 'primary-action')}</div>`
      : forge(ui, state, seg);
    return `<div class="forge-tile forge-hero"><div class="forge-anvil big">${img('icon_anvil')}<span class="forge-flame"></span></div>${anim}
        <div class="forge-count">${shard()} <b class="num">${formatNumber(state.materials.shards)}</b></div></div>
      <div class="forge-bigs">${btn('recycle', 'icon_bag', 'Recycler', p.list.length)}${btn('fuse', 'icon_anvil', 'Fusionner', fuses)}${btn('craft', 'icon_shard', 'Fabriquer', crafts)}</div>
      ${body}`;
  }
};
export const escape = escapeHtml;
