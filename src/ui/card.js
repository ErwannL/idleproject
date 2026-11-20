// v10.1 (P4) : carte réutilisable (Arène à cartes, invocation, collections). Recto : portrait, nom, rareté, élément,
// rôle, PV et attaque ; verso : les sorts (companionSkillList). Un appui retourne la carte (classe .flipped).
import { escapeHtml, formatNumber, hdArt, img } from './common.js';
import { ELEMENTS } from '../core/elements.js';
import { ROLES } from '../data/synergies.js';
import { COMPANIONS } from '../data/companions.js';

// v10.3 (audit) : l'image d'une carte ennemie est celle de SA fiche (card.sprite : sprite du monstre, ou illustration
// « file:… » du gardien) ; son rôle (Lancier, Mage noir…) passe en sous-titre ; `back: 'gold'` = dos de carte doré.
export const foeSpriteUrl = (card) => (String(card.sprite ?? '').startsWith('file:') ? card.sprite.slice(5) : null);
function foePic(card) {
  const file = foeSpriteUrl(card);
  return file ? `<img class="px pc-file" src="${escapeHtml(file)}" alt="">` : img(card.sprite ?? (card.boss ? 'icon_boss' : 'icon_skull'));
}
export function cardHtml(card, { flipped = false, action = '', value = '', small = false, foe = false, hp = null, back = '' } = {}) {
  const el = ELEMENTS[card.element];
  const role = ROLES[card.role];
  const unit = COMPANIONS.find((c) => c.id === card.id);
  const pic = foe ? `<div class="pc-foe${card.boss ? ' boss' : ''}" data-sprite="${escapeHtml(String(card.sprite ?? ''))}">${foePic(card)}</div>` : (unit ? hdArt(unit, 'pc-art') || img(unit.sprite) : '');
  const ratio = hp == null ? 1 : Math.max(0, hp / card.maxHp);
  const attrs = action ? ` data-action="${action}" data-value="${escapeHtml(String(value))}"` : '';
  return `<div class="pcard${flipped ? ' flipped' : ''}${small ? ' small' : ''}${foe ? ' foe' : ''}${back === 'gold' ? ' back-gold' : ''} r-${card.rarity ?? 'common'}" style="--ec:${el?.color ?? '#5a6a90'}"${attrs} data-pos="${card.pos ?? ''}" title="${escapeHtml(card.name)}">
    <div class="pc-inner"><div class="pc-front">
      <div class="pc-top"><b>${escapeHtml(card.name)}</b>${el ? `<span class="pc-el" title="${escapeHtml(el.name)}">${escapeHtml(el.icon ?? '')}</span>` : ''}</div>
      <div class="pc-pic">${pic}</div>
      ${role ? `<div class="pc-role" style="color:${role.color}">${escapeHtml(role.label)}</div>` : card.guardian ? '<div class="pc-role gold-text">Gardien</div>' : card.boss ? '<div class="pc-role bad">Boss</div>' : card.sub ? `<div class="pc-role pc-sub">${escapeHtml(card.sub)}</div>` : ''}
      <div class="pc-stats"><span>❤ ${formatNumber(card.maxHp)}</span><span>⚔ ${formatNumber(card.atk)}</span></div>
      <div class="pc-hp"><i style="width:${ratio * 100}%"></i></div>
    </div><div class="pc-back">
      <b>${escapeHtml(card.name)}</b>
      ${(card.skills ?? []).map((s) => `<p class="${s.ultimate ? 'gold-text' : ''}"><b>${escapeHtml(s.name ?? '')}</b> ${escapeHtml(s.text ?? '')}</p>`).join('') || '<p class="muted">Frappe la carte devant elle.</p>'}
    </div></div></div>`;
}
