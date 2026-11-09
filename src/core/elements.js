// v9.3.1 : système de types (éléments) — rouge, bleu, vert, lumière, ténèbres.
// Triangle : rouge (feu) > vert (nature) > bleu (eau) > rouge. Lumière et ténèbres se battent l'une l'autre :
// chacune frappe fort l'autre (et en reçoit autant). Avantage : dégâts × ADV ; faiblesse : dégâts × WEAK.
export const ELEMENTS = {
  red: { name: 'Feu', icon: '🔥', color: '#ff5a3c' },
  blue: { name: 'Eau', icon: '💧', color: '#3ca8ff' },
  green: { name: 'Nature', icon: '🍃', color: '#4cd26a' },
  light: { name: 'Lumière', icon: '☀', color: '#ffe27a' },
  dark: { name: 'Ténèbres', icon: '☾', color: '#a46bff' },
};
export const ADV = 1.25; // v9.3.2 : +25 % (validé)
export const WEAK = 0.8;
const BEATS = { red: 'green', green: 'blue', blue: 'red', light: 'dark', dark: 'light' };

// Compagnons et familiers (les entrées « héros » ne servent qu'à l'affichage : le héros frappe en neutre).
export const UNIT_ELEMENT = {
  // héros
  knight: 'blue', paladin: 'light', guardian: 'green', fortune_knight: 'light', berserker: 'red', dragon_knight: 'red',
  fairy: 'green', valkyrie: 'blue', witch: 'dark', vampire: 'dark', ninja: 'dark', demoness: 'dark', seraph: 'light', grombar: 'red',
  // familiers
  golden_slime: 'light', cat: 'dark', owl: 'blue', golem: 'green', wisp: 'light', crystal_hedgehog: 'blue', dragonling: 'red',
  jade_turtle: 'green', kitsune: 'red', phoenix: 'red',
  // compagnons
  squire: 'blue', mercenary: 'red', ranger: 'green', pyromancer: 'red', priestess: 'light', lancer: 'blue', shadow: 'dark',
  dwarf: 'red', azure_paladin: 'blue', rose_blade: 'red', elf_archer: 'green', high_priest: 'light', barbarian: 'red',
  archangel: 'light', demon_queen: 'dark', ice_empress: 'blue', shadow_lord: 'dark', sylvan_guardian: 'green',
};

// Ennemis : l'élément de leur monde (les 12 mondes, dans l'ordre de ZONES).
export const ZONE_ELEMENT = ['green', 'green', 'blue', 'red', 'blue', 'dark', 'green', 'light', 'red', 'dark', 'blue', 'dark'];

export function unitElement(id) { return UNIT_ELEMENT[id] ?? null; }
export function zoneElement(zoneIndex) { return ZONE_ELEMENT[zoneIndex] ?? null; }

// Multiplicateur de dégâts d'un attaquant `a` contre un défenseur `d` (éléments, ou null = neutre).
// v9.3.2 : un seul multiplicateur par coup, appliqué une fois dans core/combat.js hitEnemy (attaque des compagnons) et
// dans le combat des modes compagnons (attaques des ennemis sur les compagnons typés). Le héros est neutre (null) :
// ni bonus ni malus, dans les deux sens. Les critiques, buffs, boucliers et armures s'appliquent ensuite, sans
// toucher au type : aucun double comptage.
export function elementMultiplier(a, d) {
  if (!a || !d) return 1;
  if (BEATS[a] === d) return ADV;
  if (BEATS[d] === a) return WEAK;
  return 1;
}

const VS = { red: ['green', 'blue'], green: ['blue', 'red'], blue: ['red', 'green'], light: ['dark', 'dark'], dark: ['light', 'light'] };
// Pastille HTML (interface) : icône et nom du type ; `long` ajoute l'avantage et la faiblesse.
export function elementBadge(el, long = false, iconOnly = false) {
  const e = ELEMENTS[el];
  if (!e) return '';
  const [strong, weak] = VS[el];
  const tip = `Fort contre ${ELEMENTS[strong].name} (+${Math.round((ADV - 1) * 100)} % de dégâts)${el === 'light' || el === 'dark' ? '' : `, faible contre ${ELEMENTS[weak].name}`}`;
  if (iconOnly) return `<span class="elem-badge elem-icon elem-${el}" title="${e.name} — ${tip}" aria-label="Type ${e.name}" style="--ec:${e.color}">${e.icon}</span>`;
  return `<span class="elem-badge elem-${el}" title="${tip}" style="--ec:${e.color}">${e.icon} ${e.name}</span>${long ? ` <small class="muted elem-tip">${tip}</small>` : ''}`;
}
