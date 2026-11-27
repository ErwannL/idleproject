// v9.9 (K4) : Conseil du mentor — après une défaite (boss, donjon, Tour, Défi, Arène, grand boss), 3 cartes « pour
// devenir plus fort », choisies selon la partie : élément défavorable, amélioration abordable, objet meilleur,
// compagnon non placé, talent à apprendre, Renaissance au mur. Chaque carte ouvre le bon écran (et pointe la ligne).
import { BALANCE } from '../data/balance.js';
import { PRESTIGE } from '../data/prestige.js';
import { ELEMENTS, unitElement, zoneElement } from './elements.js';
import { UPGRADE_NAMES, bestOpenUpgrade, companionToPlace } from './guide.js';
import { isUpgrade } from './inventory.js';
import { computeHeroStats } from './stats.js';
import { upgradeProfits } from './profit.js';
import { canRebirth, rebirthBlocked, rebirthGain, rebirthReward, suggestedTalent } from './rebirth.js';
import { COMPANIONS } from '../data/companions.js';
import { currentEncounter } from './combat.js';
import { formatNumber } from './format.js';
import { canSummonNow } from './menu-gates.js'; // v10.19 (6.2)

const BEATS = { red: 'green', green: 'blue', blue: 'red', light: 'dark', dark: 'light' };
const beaterOf = (el) => Object.keys(BEATS).find((k) => BEATS[k] === el) ?? null;

export function mentorTips(state, { element = null, wall = false } = {}, balance = BALANCE) {
  const out = [];
  const foe = element ?? zoneElement(currentEncounter(state).zoneIndex);
  const strong = beaterOf(foe);
  const team = state.companions?.equipped ?? [];
  if (strong && !team.some((id) => unitElement(id) === strong)) {
    const owned = Object.keys(state.companions?.owned ?? {}).filter((id) => unitElement(id) === strong && COMPANIONS.find((c) => c.id === id)?.kind === 'ally');
    // v10.19 (6.2) : « Un compagnon de Feu ferait… » seulement si le joueur peut invoquer maintenant (menu ouvert, de quoi payer).
    if (owned.length || canSummonNow(state, balance)) out.push({ id: 'element', icon: 'tab_companions', title: `Ennemi de ${ELEMENTS[foe]?.name ?? foe}`,
      text: owned.length ? `Place un compagnon de ${ELEMENTS[strong].name} (+50 % de dégâts)` : `Un compagnon de ${ELEMENTS[strong].name} ferait +50 % de dégâts`,
      tab: owned.length ? 'companions' : 'summon', point: owned.length ? `[data-action="companion-sel"][data-value="${owned[0]}"]` : '[data-action="summon"]' });
  }
  const current = computeHeroStats(state, balance);
  const better = state.inventory.find((i) => isUpgrade(state, i, balance, current));
  if (better) out.push({ id: 'item', icon: 'tab_equipment', title: 'Objet meilleur', text: `Équipe ${better.name}`, tab: 'inventory', point: '[data-action="eq-quick"], [data-action="equip"]' });
  const up = bestOpenUpgrade(state, balance);
  if (up && up.cost <= state.gold) {
    const pct = Math.round((upgradeProfits(state, balance)[up.key]?.pct ?? 0) * 10) / 10;
    // v9.11 (6) : seulement un conseil qui change quelque chose (au moins +5 %).
    if (pct >= 5) out.push({ id: 'upgrade', icon: 'icon_upgrade', title: 'Amélioration abordable', text: `${UPGRADE_NAMES[up.key] ?? up.key}${pct ? ` +${String(pct).replace('.', ',')} %` : ''} pour ${formatNumber(up.cost)} or`,
      tab: 'upgrades', point: `[data-action="buy"][data-key="${up.key}"]` });
  }
  const place = companionToPlace(state, balance);
  if (place) out.push({ id: 'place', icon: 'tab_companions', title: 'Place libre dans l\'équipe', text: `Place ${place.name}`, tab: 'companions', point: `[data-action="companion-sel"][data-value="${place.id}"]` });
  if (suggestedTalent(state)) out.push({ id: 'talent', icon: 'tab_talents', title: 'Talent à apprendre', text: 'Tes fragments achètent un talent', tab: 'tree', point: '[data-action="talent-best"]' });
  if (canRebirth(state) && !rebirthBlocked(state) && rebirthReward(state) > 0 && (wall || out.length < 3)) {
    out.unshift({ id: 'rebirth', icon: 'icon_star', title: 'Le mur est atteint', text: `Renaître : +${Math.round((PRESTIGE.rebirthMultiplier ** rebirthGain(state) - 1) * 100)} % de dégâts pour toujours`,
      tab: 'tree', view: { treeSeg: 'rebirth' }, point: '[data-action="rebirth"], .rebirth-card .btn-gold' });
  }
  if (!out.length) out.push({ id: 'level', icon: 'icon_star', title: 'Continue de t\'entraîner', text: 'Les monstres d\'avant rapportent de l\'or et de l\'expérience', tab: 'upgrades' });
  return out.slice(0, 3);
}

// v10.19 (6.2) : le conseil « invoque un compagnon de l'élément X » est au hasard (une invocation ne le garantit pas) :
// sur le Sceau, il se montre au plus une fois toutes les 10 minutes, pendant SUMMON_TIP_SHOW_MS au plus ; après 2 affichages
// sans effet (aucun nouveau compagnon), il laisse la place au conseil suivant pour de bon (jusqu'au prochain compagnon).
// memo : objet gardé par l'appelant (state.ui.mentorSummon) ; now : horloge réelle (ms).
export const SUMMON_TIP_EVERY_MS = 600000;
export const SUMMON_TIP_SHOW_MS = 30000;
export const SUMMON_TIP_MAX = 2;
export function mentorTipAllowed(state, tip, memo, now = Date.now()) {
  if (!tip || tip.id !== 'element' || tip.tab !== 'summon' || !memo) return Boolean(tip);
  const owned = Object.keys(state.companions?.owned ?? {}).length;
  if (memo.owned !== owned) { memo.owned = owned; memo.n = 0; memo.at = -Infinity; } // un nouveau compagnon : le conseil a servi
  if (now - (memo.at ?? -Infinity) < SUMMON_TIP_SHOW_MS) return true; // affichage en cours
  if ((memo.n ?? 0) >= SUMMON_TIP_MAX || now - (memo.at ?? -Infinity) < SUMMON_TIP_EVERY_MS) return false;
  memo.n = (memo.n ?? 0) + 1; memo.at = now; // nouvel affichage
  return true;
}
// Le premier conseil du mentor que le Sceau peut montrer maintenant (le suivant si le premier attend son tour).
export function sealMentorTip(state, memo, now = Date.now(), balance = BALANCE) {
  return mentorTips(state, { wall: true }, balance).find((t) => mentorTipAllowed(state, t, memo, now)) ?? null;
}
