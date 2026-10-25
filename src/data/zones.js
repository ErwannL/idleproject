// Zones de la campagne. Chaque zone couvre BALANCE.stages.stagesPerZone étapes ;
// la dernière zone continue au-delà avec une difficulté croissante.
// Le décor de chaque zone est peint dans assets/bg/<id>_<calque>.png (tools/art/scenery.py) ;
// `palette.sky` donne le dégradé du ciel derrière les calques, `palette.ground` le sol.

export const ZONES = [
  {
    id: 'plains',
    name: 'Plaines verdoyantes',
    enemies: ['slime', 'goblin'],
    bosses: ['slime_king'],
    sky: 'clouds',
    palette: {
      sky: ['#5aa8e6', '#7cc0ee', '#a6d8f4', '#cdeaf6'],
      ground: '#8a5a33',
    },
  },
  {
    id: 'forest',
    name: 'Forêt sombre',
    enemies: ['wolf', 'mushroom'],
    bosses: ['alpha_wolf'],
    sky: 'clouds',
    palette: {
      sky: ['#2f4a5a', '#466674', '#5f808a', '#7a989c'],
      ground: '#4a3424',
    },
  },
  {
    id: 'caves',
    name: 'Grottes de cristal',
    enemies: ['bat', 'skeleton'],
    bosses: ['bone_lord'],
    sky: 'ceiling',
    palette: {
      sky: ['#120f1c', '#1b1728', '#28223a', '#2f2843'],
      ground: '#2e2840',
    },
  },
  {
    id: 'desert',
    name: 'Désert brûlant',
    enemies: ['scorpion', 'mummy'],
    bosses: ['ash_dragon'],
    sky: 'clouds',
    palette: {
      sky: ['#f08a4a', '#f4b06e', '#f9d49a', '#fbe8bf'],
      ground: '#d49c58',
    },
  },
  {
    id: 'mountains',
    name: 'Montagnes gelées',
    enemies: ['yeti', 'ice_wolf'],
    bosses: ['fallen_knight'],
    sky: 'clouds',
    palette: {
      sky: ['#6a98d1', '#93b9dc', '#bdd8ee', '#e3eef8'],
      ground: '#9aaec8',
    },
  },
  {
    id: 'cursed',
    name: 'Terres maudites',
    enemies: ['imp', 'wraith'],
    bosses: ['demon_king'],
    sky: 'clouds',
    palette: {
      sky: ['#1a0d22', '#3a1838', '#63263d', '#8a3a3a'],
      ground: '#2a1a2e',
    },
  },
];
