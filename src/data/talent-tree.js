// Arbre de talents « mastodonte » (v8.5) : environ 500 nœuds générés à partir de gabarits, jamais écrits un
// par un (seuls les noms des notables et les clés de voûte sont écrits à la main).
//
// Forme : le Cœur du chevalier au centre, 6 régions (une par sixième de cercle) et des anneaux
// concentriques ; plus on s'éloigne du centre, plus les nœuds sont chers et puissants. Chaque anneau
// a plus de nœuds que le précédent : les branches se divisent, se rejoignent (un nœud est relié aux deux
// nœuds les plus proches de l'anneau intérieur), se croisent (liens dans l'anneau) et des ponts relient
// les régions voisines. Un nœud s'apprend dès qu'UN de ses voisins est appris (pas un seul parent).
//
// Trois sortes de nœuds :
// - petits nœuds (3 niveaux) : une statistique de la région ;
// - notables (1 niveau, nommés) : un effet plus fort, souvent double ;
// - clés de voûte (1 niveau) : des effets qui changent la partie, parfois avec un prix, et qui demandent
//   d'avoir dépensé des points dans la région (`gate`).

export const TALENT_REGIONS = [
  { id: 'combat', label: 'Puissance', color: '#ff7a6b', icon: 'skill_mastery' },
  { id: 'hunt', label: 'Chasse', color: '#ff9a3d', icon: 'skill_quick' },
  { id: 'resources', label: 'Fortune', color: '#f2d083', icon: 'coin' },
  { id: 'special', label: 'Héritage', color: '#c9a6ff', icon: 'icon_fragment' },
  { id: 'arcane', label: 'Arcanes', color: '#6fc8ff', icon: 'icon_book' },
  { id: 'survival', label: 'Endurance', color: '#63d98a', icon: 'icon_heart' },
];

export const TREE = {
  rings: 14, // anneaux autour du Cœur
  sector: 50, // largeur angulaire d'une région (degrés) ; le reste sert aux ponts
  smallMax: 3,
  costScale: 1.5,
  bridgeRings: [3, 6, 9, 12],
};

// Statistiques des petits nœuds, par région (valeur par niveau, à l'anneau 0 ; +8 % par anneau).
const POOLS = {
  combat: [['damagePct', 3], ['critChance', 0.4], ['damageVsBossPct', 3], ['attackSpeedPct', 1.2]],
  hunt: [['damageVsNormalPct', 4], ['xpPct', 4], ['lifesteal', 0.15], ['dropChance', 0.15]],
  resources: [['goldPct', 4], ['dropChance', 0.2], ['goldPct', 3], ['xpPct', 3]],
  special: [['companionPct', 2], ['damagePct', 1.5], ['maxHpPct', 1.5], ['skillCooldownPct', 0.4]],
  arcane: [['thorns', 2], ['critChance', 0.3], ['skillCooldownPct', 0.4], ['regenPct', 0.08]],
  survival: [['maxHpPct', 3], ['armor', 0.3], ['regenPct', 0.08], ['lowHpArmor', 1]],
};

// Nom d'un petit nœud d'après sa statistique.
export const STAT_NODE_NAMES = {
  damagePct: 'Force', critChance: 'Précision', damageVsBossPct: 'Tueur de géants', attackSpeedPct: 'Célérité',
  damageVsNormalPct: 'Traque', xpPct: 'Érudition', lifesteal: 'Soif de sang', dropChance: 'Flair',
  goldPct: 'Fortune', companionPct: 'Lien animal', maxHpPct: 'Vigueur', skillCooldownPct: 'Technique',
  thorns: 'Épines', regenPct: 'Régénération', armor: 'Cuirasse', lowHpArmor: 'Dernier rempart',
};

// Notables : noms par région (dans l'ordre d'apparition) et effets (deux statistiques de la région, ×5).
const NOTABLE_NAMES = {
  combat: ['Lame affûtée', 'Fureur guerrière', 'Coup précis', 'Bras de fer', 'Rage du duel', 'Lame de l\'aube', 'Marteau des rois', 'Danse des épées', 'Frappe du titan', 'Colère sacrée', 'Lame éternelle', 'Fléau des boss'],
  hunt: ['Pisteur', 'Œil du faucon', 'Curée', 'Meute affamée', 'Instinct sauvage', 'Grand veneur', 'Sang chaud', 'Proie facile', 'Chasse royale', 'Prédateur', 'Traqueur d\'ombres', 'Roi des chasseurs'],
  resources: ['Bourse pleine', 'Coffre secret', 'Main heureuse', 'Marchand avisé', 'Filon d\'or', 'Trésor caché', 'Banquier', 'Pluie de pièces', 'Usurier', 'Mine d\'or', 'Dragon d\'or', 'Fortune royale'],
  special: ['Héritage I', 'Lignée', 'Mémoire ancestrale', 'Héritage II', 'Serment', 'Esprit de corps', 'Ancêtres', 'Héritage III', 'Âme liée', 'Grande famille', 'Dynastie', 'Légende vivante'],
  arcane: ['Runes', 'Focalisation', 'Sceau mystique', 'Miroir', 'Glyphe ardent', 'Savoir interdit', 'Bouclier runique', 'Arcane majeur', 'Œil du mage', 'Tempête de runes', 'Grimoire', 'Archimage'],
  survival: ['Peau dure', 'Second souffle', 'Rempart', 'Cœur vaillant', 'Forteresse', 'Endurance', 'Sang de fer', 'Bastion', 'Inébranlable', 'Colosse de pierre', 'Immortel', 'Gardien éternel'],
};

// Notables spéciaux de l'Héritage : emplacements de pouvoir et relances moins chères (ancien talent « Héritage »).
const SPECIAL_NOTABLES = {
  'Héritage I': { powerSlots: 1 },
  'Héritage II': { rerollDiscountPct: 25 },
  'Héritage III': { powerSlots: 1 },
};

// Clés de voûte : deux par région (anneau 7 et dernier anneau) et une sur chaque grand pont (anneau 12).
export const KEYSTONES = {
  combat: [
    { name: 'Berserker', icon: 'skill_cry', effects: { damageMultPct: 60, maxHpPct: -25 }, text: 'Tout pour l\'attaque.' },
    { name: 'Avatar de la guerre', icon: 'skill_mastery', effects: { damageMultPct: 100, critChance: 5 } },
  ],
  hunt: [
    { name: 'Massacre', icon: 'skill_whirl', effects: { damageVsNormalPct: 120, damageVsBossPct: -30 } },
    { name: 'Seigneur de la traque', icon: 'icon_paw', effects: { damageMultPct: 40, dropChance: 3 } },
  ],
  resources: [
    { name: 'Midas', icon: 'coin', effects: { goldMultPct: 100, damagePct: -15 } },
    { name: 'Roi des trésors', icon: 'icon_chest', effects: { goldMultPct: 150, dropChance: 2 } },
  ],
  special: [
    { name: 'Âme de la meute', icon: 'pet_cat', effects: { companionPct: 60, powerSlots: 1 } },
    { name: 'Héritier des anciens', icon: 'icon_rebirth', effects: { damageMultPct: 40, maxHpMultPct: 40, powerSlots: 1 } },
  ],
  arcane: [
    { name: 'Maître des runes', icon: 'icon_book', effects: { skillCooldownPct: 20, critChance: 5 } },
    { name: 'Épines du néant', icon: 'skill_holy', effects: { thorns: 150, damageMultPct: 30 } },
  ],
  survival: [
    { name: 'Colosse', icon: 'icon_shield', effects: { maxHpMultPct: 100, attackSpeedPct: -20 } },
    { name: 'Immortalité', icon: 'icon_heart', effects: { maxHpMultPct: 120, regenPct: 2, lowHpArmor: 20 } },
  ],
};
const BRIDGE_KEYSTONES = [
  { name: 'Cœur du titan', icon: 'icon_star', effects: { damageMultPct: 50, maxHpMultPct: 50 } },
  { name: 'Tempête d\'acier', icon: 'icon_bolt', effects: { attackSpeedPct: 25, damageMultPct: 25 } },
  { name: 'Pacte doré', icon: 'icon_gem', effects: { goldMultPct: 60, damageMultPct: 25 } },
  { name: 'Éveil', icon: 'icon_tree', effects: { xpPct: 100, companionPct: 30 } },
  { name: 'Bastion runique', icon: 'icon_trophy', effects: { maxHpMultPct: 60, thorns: 60 } },
  { name: 'Lame vivante', icon: 'skill_quick', effects: { lifesteal: 5, damageMultPct: 35 } },
];
const BRIDGE_NOTABLES = ['Carrefour', 'Croisée des chemins', 'Gué des anciens', 'Pont de lumière', 'Passage secret', 'Arche', 'Col', 'Défilé', 'Porte du nord', 'Porte du sud', 'Seuil', 'Traverse', 'Passerelle', 'Lisière', 'Frontière', 'Confluent', 'Jonction', 'Embranchement'];

const round = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 100) / 100);
const rad = (deg) => (deg * Math.PI) / 180;

// Nombre de nœuds d'une région sur l'anneau r.
export function lanesAt(r) {
  return 1 + Math.floor(r * 0.7);
}

function smallCost(r) {
  return { costBase: Math.max(1, Math.round((1 + r * 0.75) * TREE.costScale)), costStep: Math.max(1, Math.round((1 + r / 5) * TREE.costScale)) };
}

export function buildTree() {
  const nodes = [];
  const byId = new Map();
  const add = (node) => {
    node.links = [];
    nodes.push(node);
    byId.set(node.id, node);
    return node;
  };
  const link = (a, b) => {
    if (!a || !b || a === b || a.links.includes(b.id)) return;
    a.links.push(b.id);
    b.links.push(a.id);
  };

  add({
    id: 'core', name: 'Cœur du chevalier', region: 'core', kind: 'core', ring: 0, x: 0, y: 0, icon: 'icon_hero',
    max: 5, costBase: 1, costStep: 1, perLevel: { damagePct: 3, maxHpPct: 3 },
  });

  const grid = {}; // grid[region][ring] = [nœuds de gauche à droite]
  TALENT_REGIONS.forEach((reg, k) => {
    const center = -90 + k * 60;
    const pool = POOLS[reg.id];
    const notableNames = [...NOTABLE_NAMES[reg.id]];
    const keystones = [...KEYSTONES[reg.id]];
    grid[reg.id] = [];
    let statIndex = k;
    for (let r = 1; r <= TREE.rings; r++) {
      const n = lanesAt(r);
      const row = [];
      for (let j = 0; j < n; j++) {
        const offset = n === 1 ? 0 : (j / (n - 1) - 0.5) * TREE.sector * Math.min(1, 0.45 + r * 0.06);
        const angle = rad(center + offset);
        const mid = j === Math.floor((n - 1) / 2);
        const isKeystone = mid && (r === 7 || r === TREE.rings);
        const isNotable = !isKeystone && ((r % 3 === 2 && (j === 0 || j === n - 1)) || (r % 3 === 0 && mid && r > 1));
        const base = { id: `${reg.id}_${r}_${j}`, region: reg.id, ring: r, x: r * Math.cos(angle), y: r * Math.sin(angle) };
        let node;
        if (isKeystone) {
          const ks = keystones.shift();
          node = add({ ...base, kind: 'keystone', name: ks.name, icon: ks.icon, max: 1, costBase: Math.round((30 + r * 6) * TREE.costScale), costStep: 0, perLevel: { ...ks.effects }, gate: r === 7 ? 15 : 60 });
        } else if (isNotable && notableNames.length) {
          const name = notableNames.shift();
          const [a, b] = [pool[(r + j) % pool.length], pool[(r + j + 1) % pool.length]];
          const scale = 5 * (1 + r * 0.08);
          const effects = SPECIAL_NOTABLES[name] ?? { [a[0]]: round(a[1] * scale), [b[0]]: round((b[0] === a[0] ? b[1] * 0.5 : b[1]) * scale) };
          node = add({ ...base, kind: 'notable', name, icon: reg.icon, max: 1, costBase: Math.round((4 + r * 2) * TREE.costScale), costStep: 0, perLevel: effects });
        } else {
          const [stat, value] = pool[statIndex % pool.length];
          statIndex += 1;
          node = add({ ...base, kind: 'small', name: STAT_NODE_NAMES[stat], icon: reg.icon, max: TREE.smallMax, ...smallCost(r), perLevel: { [stat]: round(value * (1 + r * 0.08)) } });
        }
        row.push(node);
      }
      grid[reg.id].push(row);
      // Liens vers l'anneau intérieur : chaque nœud rejoint les 1 ou 2 nœuds les plus proches (fusions).
      if (r === 1) link(row[0], byId.get('core'));
      else {
        const prev = grid[reg.id][r - 2];
        row.forEach((node, j) => {
          const f = n === 1 ? 0 : (j / (n - 1)) * (prev.length - 1);
          link(node, prev[Math.floor(f)]);
          if (Math.ceil(f) !== Math.floor(f)) link(node, prev[Math.ceil(f)]);
        });
      }
      // Liens dans l'anneau : des chemins de traverse (une branche sur trois).
      for (let j = 0; j + 1 < n; j++) if ((r + j) % 3 === 0) link(row[j], row[j + 1]);
    }
  });

  // Ponts entre régions voisines : un nœud au milieu de l'espace libre, relié au bord des deux régions.
  const bridgeNames = [...BRIDGE_NOTABLES];
  TALENT_REGIONS.forEach((reg, k) => {
    const next = TALENT_REGIONS[(k + 1) % TALENT_REGIONS.length];
    const angle = rad(-90 + k * 60 + 30);
    for (const r of TREE.bridgeRings) {
      const left = grid[reg.id][r - 1].at(-1);
      const right = grid[next.id][r - 1][0];
      const big = r === 12;
      const id = `bridge_${reg.id}_${r}`;
      const node = big
        ? (() => {
          const ks = BRIDGE_KEYSTONES[k];
          return add({ id, region: 'bridge', ring: r, x: r * Math.cos(angle), y: r * Math.sin(angle), kind: 'keystone', name: ks.name, icon: ks.icon, max: 1, costBase: Math.round((40 + r * 6) * TREE.costScale), costStep: 0, perLevel: { ...ks.effects }, gate: 0 });
        })()
        : add({
          id, region: 'bridge', ring: r, x: r * Math.cos(angle), y: r * Math.sin(angle), kind: 'notable', name: bridgeNames.shift() ?? 'Carrefour', icon: 'icon_map',
          max: 1, costBase: Math.round((4 + r * 2) * TREE.costScale), costStep: 0,
          perLevel: { [POOLS[reg.id][0][0]]: round(POOLS[reg.id][0][1] * 4 * (1 + r * 0.08)), [POOLS[next.id][0][0]]: round(POOLS[next.id][0][1] * 4 * (1 + r * 0.08)) },
        });
      link(node, left);
      link(node, right);
    }
  });
  return nodes;
}
