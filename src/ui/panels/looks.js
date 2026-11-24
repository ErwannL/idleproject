// v9.2.2 : sous-onglet visible Héros › Apparences (les skins étaient dans la fiche du héros, ouverte par le portrait,
// donc hors menu). Même écran qu'avant (hero.js lookView) : aperçu de l'apparence équipée, grille avec état et « Équiper ».
import { lookView } from './hero.js';
import { HEROES } from '../../data/heroes.js';
import { SKIN_TIERS, skinTier } from '../../data/economy.js';
import { heroById, heroEffects } from '../../core/heroes.js';
import { heroPortraitUrl } from '../../render/pixel.js';
import { animCanvas } from '../animator.js';
import { showcaseSlot } from '../showcase.js';
import { effectText, hdArt, img } from '../common.js';
import { mBtn, mBtnGold, mGrid, mSheet, mTile } from '../mobile-kit.js';
import { esc, isMPhone, mpFrame } from './profile-m.js';

// v10.12 : Apparences sur téléphone — en-tête (apparence équipée), grille de 3 cases, vitrine animée dans une .m-sheet.
function looksPhone(ui, state) {
  const worn = heroById(state.heroes.active) ?? HEROES[0];
  const ownedCount = HEROES.filter((h) => state.heroes.owned[h.id]).length;
  const canShop = ui.tabVisible?.shop !== false;
  const head = `<div class="m-card mp-head mp-look-head"><span class="mp-look-pic">${hdArt(worn, 'look-hd')}${animCanvas('hero', 64, 58, 2)}</span>
    <div class="mp-main"><small>Apparence équipée</small><b class="mp-name">${esc(worn.name)}</b><small>${ownedCount}/${HEROES.length} obtenues</small></div></div>`;
  const tiles = HEROES.map((h) => {
    const owned = state.heroes.owned[h.id];
    const active = state.heroes.active === h.id;
    const src = owned ? heroPortraitUrl({}, 2, h.palette) : heroPortraitUrl({}, 2, h.palette, '#2e3a52');
    return mTile({ name: h.name, rarity: h.rarity, locked: !owned }, { size: 80, action: 'mp-open', value: `look:${h.id}`, src, label: h.name, pips: false, plus: active ? '✓' : '', selected: active });
  });
  const sel = typeof ui.view.mSheet === 'string' && ui.view.mSheet.startsWith('look:') ? heroById(ui.view.mSheet.slice(5)) : null;
  let sheet = '';
  if (sel) {
    const owned = state.heroes.owned[sel.id];
    const active = state.heroes.active === sel.id;
    const status = active ? 'Équipée' : owned ? 'Possédée' : 'Verrouillée';
    const act = owned ? (active ? (sel.id === 'knight' ? '' : mBtn('Retirer', { action: 'unequip-look' })) : mBtnGold('Équiper', { action: 'set-hero', value: sel.id }))
      : (canShop ? mBtn('Voir en boutique', { action: 'open-shop-skins', icon: 'icon_gem' }) : '<div class="muted">Boutique › Skins</div>');
    sheet = mSheet(sel.name, `<div class="m-card mp-detail mp-look-show"><div class="mp-look-meta"><span class="mp-pill2">${esc(sel.id === 'knight' ? 'Base' : SKIN_TIERS[skinTier(sel)].name)}</span><span class="mp-pill2 ${active ? 'on' : ''}">${status}</span></div>
        ${showcaseSlot('hero', sel.id)}
        <div class="good mp-look-fx">Bonus du héros (compte) : ${effectText(heroEffects(state))}</div></div>${act}`, { close: 'mp-shut', back: 'mp-shut', id: 'look-sheet' });
  }
  return `${mpFrame('icon_summon', 'Apparences', `${head}${mGrid(tiles, 3)}`, true, Boolean(sheet))}${sheet}`;
}

export default {
  id: 'looks',
  title: 'Apparences',
  icon: 'icon_summon',
  render: (ui, state) => (isMPhone(ui) ? looksPhone(ui, state) : lookView(ui, state)),
};
