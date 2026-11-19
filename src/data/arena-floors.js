// v10.1 (P4) : Arène à cartes — réglages des étages (core/arena-cards.js). Tout l'équilibrage est ici.
//  Étages 1 à 100, puis le Sommet (étages sans fin, un palier de plus chaque semaine de saison).
//  Tous les 5 étages : une règle. Tous les 10 : un boss. Tous les 25 : un gardien (carte nommée, très solide).
export const CARD_ARENA = {
  floors: 100,
  formation: 6,             // 2 rangées × 3 (devant : encaisse ; derrière : protégé tant que l'avant tient)
  teamMax: 5,               // 5 cartes au plus (une case reste vide : choix de placement)
  sweepsPerDay: 5,
  chestEvery: 15,           // un coffre tous les 15 ★
  limit: 90,                // secondes de combat au plus (au-delà : défaite)
  ultGauge: 100,            // jauge d'ultime : +12 par coup donné, +8 par coup reçu
  ultHit: 12, ultHurt: 8,
  scale: 1.0,               // puissance ennemie par étage (n = étage × scale)
  enemy: { hp: 1900, hpGrowth: 1.03, atk: 165, atkGrowth: 1.025, def: 8, defGrowth: 1.01, interval: 1.25 },
  bossHp: 5, bossAtk: 1.7, guardianHp: 8, guardianDef: 2.5, guardianAtk: 1.4,
  rules: [
    { id: 'armored', text: 'Ennemis cuirassés : armure ×2' },
    { id: 'swift', text: 'Ennemis rapides : attaques 30 % plus vite' },
    { id: 'noheal', text: 'Soins réduits de moitié' },
    { id: 'frenzy', text: 'Frénésie : attaque ennemie +35 %' },
    { id: 'first', text: 'Embuscade : les ennemis frappent les premiers' },
    { id: 'backline', text: 'Assaut arrière : les ennemis visent la rangée de derrière' },
  ],
  guardians: ['Gardien de bronze', 'Gardienne d\'argent', 'Gardien d\'or', 'Gardien du Sommet'],
  // Récompenses : premier passage d'un étage (une fois), balayage (étage 3★, 5 fois par jour), coffre d'étoiles.
  firstReward: (f) => ({ gems: 5 + Math.round(f * 0.8) + (f % 10 === 0 ? 30 : 0) + (f % 25 === 0 ? 60 : 0), grimoire: f % 5 === 0 ? 2 : 0 }),
  sweepReward: (f) => ({ gold: 0, shards: 10 + f, grimoire: 1 }),
  chestReward: (i) => ({ gems: 40 + i * 10, ascension: 2 + Math.floor(i / 2), keys: 1 }),
  seasonDays: 28,
  seasonRewards: [{ floor: 10, reward: { gems: 50 } }, { floor: 25, reward: { gems: 100, keys: 1 } }, { floor: 50, reward: { gems: 200, ascension: 3 } }, { floor: 100, reward: { gems: 400, ascension: 6 } }],
};
