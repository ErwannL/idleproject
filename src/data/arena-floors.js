// v10.1 (P4) : Arène à cartes — réglages des étages (core/arena-cards.js). Tout l'équilibrage est ici.
//  Étages 1 à 100, puis le Sommet (étages sans fin, un palier de plus chaque semaine de saison).
//  Tous les 5 étages : une règle. Tous les 10 : un boss. Tous les 25 : un gardien (carte nommée, très solide).
export const CARD_ARENA = {
  floors: 100,
  formation: 6,             // 2 rangées × 3 (devant : encaisse ; derrière : protégé tant que l'avant tient)
  teamMax: 5,               // 5 cartes au plus (une case reste vide : choix de placement)
  sweepsPerDay: 5,
  chestEvery: 15,           // un coffre tous les 15 ★
  limit: 150,               // secondes de combat au plus (au-delà : défaite)
  star3: 30,                // v10.2 : 3 ★ = aucune carte perdue en moins de 30 s
  // v10.3.1 : le plan (6.2) dit « 45 s », mais avec la courbe calibrée (étage 9 ≈ 28 s) les étages 11 à 19 durent
  // 30 à 44 s sans perte : à 45 s, 8 à 10 étages de plus après le 10e passeraient à 3 ★ (parties de 11 h, débutant et
  // de fin), contre l'exigence 1.4 (« 1 ★ ou 2 ★ dès l'étage 8 à 10 »). Allonger les combats de 50 % pour la tenir
  // ferait durer l'étage 25 jusqu'à 217 s (limite 150 s) : 30 s est gardé (tests/v1031-arena.test.js).
  calTarget: 30,            // v10.2 (1.4) : l'équipe du premier passage bute vers l'étage 30
  calSlowFloor: 9,          //   et met ~28 s à l'étage 9 (2 ★ dès les étages 8-10)
  ultGauge: 100,            // jauge d'ultime : +12 par coup donné, +8 par coup reçu
  ultHit: 12, ultHurt: 8,
  scale: 1.0,               // puissance ennemie par étage (n = étage × scale)
  enemy: { hp: 1000, hpGrowth: 1.04, atk: 100, atkGrowth: 1.03, def: 8, defGrowth: 1.01, interval: 1.25 },
  bossHp: 4, bossAtk: 1.5, guardianHp: 3.2, guardianDef: 1.3, guardianAtk: 1.1,
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
  // v10.2 (1.6) : premiers étages bien plus généreux (25 gemmes au 1er, des éclats et grimoires à chaque étage).
  firstReward: (f) => ({ gems: (f <= 10 ? 25 + 3 * f : 5 + Math.round(f * 0.8)) + (f % 10 === 0 ? 30 : 0) + (f % 25 === 0 ? 60 : 0), shards: 10 + 2 * f, grimoire: f % 5 === 0 ? 3 : 1 }),
  sweepReward: (f) => ({ gold: 0, shards: 10 + f, grimoire: 1 }),
  chestReward: (i) => ({ gems: 40 + i * 10, ascension: 2 + Math.floor(i / 2), keys: 1 }),
  seasonDays: 28,
  seasonRewards: [{ floor: 10, reward: { gems: 50 } }, { floor: 25, reward: { gems: 100, keys: 1 } }, { floor: 50, reward: { gems: 200, ascension: 3 } }, { floor: 100, reward: { gems: 400, ascension: 6 } }],
};
