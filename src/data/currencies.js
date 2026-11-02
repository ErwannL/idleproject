// Monnaies (v9.1.0) : nom, usage, où en gagner (2 lignes au plus), écran d'usage. Fiche ouverte d'un appui sur
// l'icône (barre du haut, coûts) — une seule règle pour toutes les monnaies.
export const CURRENCIES = {
  gold: { name: 'Or', icon: 'coin', tab: 'upgrades',
    use: 'Améliorations, boosts, forge, compagnons, changement de pouvoir, marchands.',
    gain: 'Combat, recyclage, expéditions.' },
  gems: { name: 'Gemmes', icon: 'icon_gem', tab: 'summon',
    use: 'Invocation, réinitialisation des talents.',
    gain: 'Monstres, niveaux, nouvelles étapes, boss, missions, contrats, hauts faits, prime, donjons, Tour, défi, expéditions, collections.' },
  // v9.1.3 (lot E) : plus de tickets d'invocation, fondus dans les gemmes (1 ticket = 100 gemmes).
  fragments: { name: 'Fragments anciens', icon: 'icon_fragment', tab: 'tree',
    use: 'Talents, bonus éternels.',
    gain: 'Renaissance, donjons, Tour, défi, expéditions.' },
  shards: { name: 'Éclats', icon: 'icon_shard', tab: 'inventory', view: { invView: 'forge' },
    use: 'Forge (renforcer, réaffûter, relancer les effets, fabriquer).',
    gain: 'Recyclage, expéditions, collections.' },
  essence: { name: 'Essences', icon: 'icon_essence', tab: 'inventory', view: { invView: 'forge' },
    use: 'Forge (relancer les effets, fabriquer).',
    gain: 'Recyclage, boss, donjons, expéditions, collections.' },
  keys: { name: 'Clés de donjon', icon: 'icon_key', tab: 'dungeons',
    use: 'Une tentative de donjon par clé.',
    gain: 'Missions, contrats, expéditions, Tour, défi (1 au départ).' },
  stars: { name: 'Étoiles', icon: 'icon_star', tab: 'tree', view: { treeSeg: 'rebirth' },
    use: 'Bonus stellaires.',
    gain: 'Transcendance.' },
};

export function currencyAmount(state, id) {
  switch (id) {
    case 'shards': return state.materials.shards;
    case 'essence': return state.materials.essence;
    case 'stars': return state.transcend?.stars ?? 0;
    default: return state[id] ?? 0;
  }
}
