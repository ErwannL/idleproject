// Zones de la campagne. Chaque zone couvre BALANCE.stages.stagesPerZone étapes ;
// la dernière zone continue au-delà avec une difficulté croissante.
// Le décor de chaque zone (ciel, calques peints) est généré par tools/art/scenery.py :
// assets/bg/<id>_*.png et le manifeste src/render/bg.js.

export const ZONES = [
  {
    id: 'plains',
    name: 'Plaines verdoyantes',
    enemies: ['slime', 'goblin', 'boar', 'mandrake'],
    bosses: ['slime_king'],
  },
  {
    id: 'forest',
    name: 'Forêt sombre',
    enemies: ['wolf', 'mushroom', 'mushroom_green', 'goblin_shaman', 'slime_blue'],
    bosses: ['alpha_wolf'],
  },
  {
    id: 'caves',
    name: 'Grottes de cristal',
    enemies: ['bat', 'skeleton', 'skeleton_shield', 'golem'],
    bosses: ['bone_lord'],
  },
  {
    id: 'desert',
    name: 'Désert brûlant',
    enemies: ['scorpion', 'mummy', 'skeleton_archer', 'goblin_armored'],
    bosses: ['ash_dragon'],
  },
  {
    id: 'mountains',
    name: 'Montagnes gelées',
    enemies: ['yeti', 'ice_wolf', 'slime_ice', 'ogre'],
    bosses: ['fallen_knight'],
  },
  {
    id: 'cursed',
    name: 'Terres maudites',
    enemies: ['imp', 'wraith', 'lich', 'slime_fire'],
    bosses: ['demon_king'],
  },
];
