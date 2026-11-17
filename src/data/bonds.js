// v9.7.1 (lot 6) : liens entre compagnons — deux compagnons joués ensemble débloquent une courte scène (une fois) et
// un petit bonus tant qu'ils sont dans la même équipe. Ajouter un lien = une ligne ici.
export const BONDS = [
  { id: 'sisters', pair: ['priestess', 'pyromancer'], name: 'Sœurs d\'armes', bonus: { companionPowerPct: 10 },
    scene: ['Prêtresse : « Cette fois, on ne tombera pas. »', 'Pyromancienne : « Cette fois, c\'est lui qui brûlera. »'] },
  { id: 'oath', pair: ['squire', 'azure_paladin'], name: 'Serment du bouclier', bonus: { maxHpPct: 8 },
    scene: ['Écuyer : « Maître, je tiendrai la ligne. »', 'Paladin d\'azur : « Alors nous la tiendrons ensemble. »'] },
  { id: 'arrows', pair: ['ranger', 'elf_archer'], name: 'Flèches jumelles', bonus: { damagePct: 6 },
    scene: ['Rôdeuse : « Le vent tourne. »', 'Archère elfe : « Je l\'ai déjà compté. »'] },
  { id: 'shadows', pair: ['shadow', 'ninja'], name: 'Lames de l\'ombre', bonus: { critChance: 4 },
    scene: ['Ombre : « On ne nous verra pas venir. »', 'Ninja : « On ne nous verra pas partir. »'] },
  { id: 'frost', pair: ['ice_empress', 'witch'], name: 'Hiver éternel', bonus: { companionPowerPct: 8 },
    scene: ['Impératrice des glaces : « Ta magie est… surprenante. »', 'Sorcière : « Et la tienne, glaciale. »'] },
];

export function activeBonds(state) {
  const team = new Set(state.companions?.equipped ?? []);
  return BONDS.filter((b) => b.pair.every((id) => team.has(id)));
}
export function bondBonus(state, key) { return activeBonds(state).reduce((a, b) => a + (b.bonus[key] ?? 0), 0); }
