// v9.2.0 : anglais des six nouvelles améliorations (Dégâts critiques, Vol de vie, Lien des compagnons, Esquive,
// Tueur de boss, Savoir) et de l'annonce « Nouvelle amélioration ». Ajouté à ./en.js en fin de fichier.
export const EXACT_920_UPG = {
  'Dégâts critiques': 'Critical damage',
  '+2 % de dégâts des coups critiques par niveau (×2 → ×4 au niveau 100)': '+2% critical hit damage per level (×2 → ×4 at level 100)',
  '+0,1 % des dégâts infligés rendus en PV (3 % au plus)': '+0.1% of damage dealt restored as HP (3% max)',
  'Lien des compagnons': 'Companion bond',
  '+3 % de puissance des compétences des compagnons (coups, soins, cris) par niveau': '+3% companion skill power (hits, heals, rallies) per level',
  'Esquive': 'Dodge',
  "+0,5 % de chance d'esquiver un coup ennemi (moitié contre les boss, 20 % au plus)": '+0.5% chance to dodge an enemy hit (half against bosses, 20% max)',
  '+1 % de dégâts du héros contre les boss par niveau (+100 % au niveau 100)': '+1% hero damage against bosses per level (+100% at level 100)',
  'Savoir': 'Knowledge',
  "+3 % d'expérience gagnée par niveau (+150 % au niveau 50)": '+3% experience gained per level (+150% at level 50)',
  '+0,2 % des PV max régénérés par seconde, ×1,1 tous les 10 niveaux': '+0.2% of max HP regenerated per second, ×1.1 every 10 levels',
};
export const patterns920Upg = (lookup) => [
  [/^Nouvelle amélioration : (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `New upgrade: ${w}`; }],
];
