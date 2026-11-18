// v9.7.1 (lot 6) : le camp — un écran calme entre deux sessions : l'équipe autour du feu, les trophées (étoiles,
// revanche, Panthéon, Musée), les expéditions en cours et les liens actifs. Rien à acheter ici.
import { companionById } from '../../core/companions.js';
import { REVENGE_STEPS, revengeLevel } from '../../core/revenge.js';
import { totalStars } from '../../core/world-stars.js';
import { activeBonds } from '../../data/bonds.js';
import { escapeHtml, img } from '../common.js';

export default {
  id: 'camp',
  title: 'Camp',
  icon: 'tab_expeditions',
  render(ui, state) {
    const team = (state.companions?.equipped ?? []).map(companionById).filter(Boolean);
    const out = (state.expeditions?.slots ?? []).filter(Boolean);
    const bonds = activeBonds(state);
    const name = state.heroName ? escapeHtml(state.heroName) : 'Ton héros';
    // v9.10 (8) : grande illustration du feu de camp (celle de la Veillée), l'équipe assise autour, en grand.
    const seats = team.map((c, i) => `<span class="camp-unit s${i}" title="${escapeHtml(c.name)}">${img(c.sprite)}</span>`).join('');
    return `<div class="card camp-fire camp-art"><div class="camp-scene2"><img class="px camp-bg" src="assets/ui/art98/camp_night.png" alt="">
        ${seats}<i class="vg-ember"></i><i class="vg-ember"></i><i class="vg-ember"></i></div>
        <p class="camp-cap">${name} se repose avec ${team.length ? escapeHtml(team.map((c) => c.name).join(', ')) : 'personne pour l\'instant'}.</p></div>
      <div class="card"><b>Trophées</b><div class="camp-trophies">
        <span>★ <b>${totalStars(state)}</b> / 36 étoiles</span><span>⚔ Revanche <b>${revengeLevel(state)}</b> / ${REVENGE_STEPS}</span>
        <span>🏆 Musée <b>${Object.keys(state.museum ?? {}).length}</b></span></div></div>
      <div class="card"><b>Expéditions</b> ${out.length ? `<span class="muted">${out.length} en cours</span>` : '<span class="muted">aucune en cours</span>'}</div>
      ${bonds.length ? `<div class="card"><b>Liens actifs</b> ${bonds.map((b) => `<span class="good">${escapeHtml(b.name)}</span>`).join(' · ')}</div>` : ''}`;
  },
};
