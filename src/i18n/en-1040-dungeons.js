// v10.4 (partie 4) : anglais de la liste en bannières et de la page du donjon. Branché à la fin de ./en.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
export const EXACT_1040_DUNGEONS = {
  'Tu gagnes': 'You win',
  'Ton équipe': 'Your team',
  'Les salles': 'The rooms',
  'Équipe : actuelle': 'Team: current',
  'Équipes enregistrées': 'Saved teams',
  'Balayer': 'Sweep',
  '1 clé': '1 key',
  'Après Facile': 'After Easy',
  'Après Normal': 'After Normal',
  'Quitte la Tour d\'abord.': 'Leave the Tower first.',
  'Termine le Défi d\'abord.': 'Finish the Challenge first.',
  'Aucune clé.': 'No key.',
  'Aide du donjon': 'Dungeon help',
  'Gros coffre du premier passage': 'Big first-clear chest',
  'Gros coffre du premier passage : déjà reçu': 'Big first-clear chest: already received',
  'Combat franc : aucune mécanique spéciale': 'Straight fight: no special mechanic',
  'Invocatrice : 2 serviteurs toutes les 12 s · ton arme : dégâts de zone': 'Summoner: 2 minions every 12 s · your weapon: area damage',
  'Carapace : −60 % de dégâts reçus · ton arme : vitesse d\'attaque': 'Shell: −60% damage taken · your weapon: attack speed',
  'Fournaise : dégâts +6 % toutes les 3 s · ton atout : PV et vol de vie': 'Furnace: damage +6% every 3 s · your asset: HP and lifesteal',
  'Désespoir : enragé sous 50 % de PV · ton atout : armure': 'Despair: enraged below 50% HP · your asset: armor',
  'Un chemin par défaut « Normal » est choisi pour toi. Une porte s\'ouvre entre deux salles : combat, élite, trésor, autel ou repos.': 'A default "Normal" route is chosen for you. A door opens between rooms: combat, elite, treasure, altar or rest.',
};
export const patterns1040Dungeons = (lookup = () => null) => { LK = lookup; return [
  [/^Entrer · (Facile|Normal|Difficile)$/, (m) => `Enter · ${tr(m[1])}`],
  [/^×(\d+) (.+) ici$/, (m) => `×${m[1]} ${tr(m[2])} here`],
  [/^Équipe : (.+)$/, (m) => `Team: ${tr(m[1])}`],
  [/^Balayer ×(\d+)$/, (m) => `Sweep ×${m[1]}`],
  [/^Balayer tout \((\d+)\)$/, (m) => `Sweep all (${m[1]})`],
  [/^Équipement Épique ou mieux(?: — ensemble (.+))?$/, (m) => `Epic or better gear${m[1] ? ` — ${tr(m[1])} set` : ''}`],
  [/^Danger ×(\d+)$/, (m) => `Danger ×${m[1]}`],
  [/^Équipe conseillée : (.+)$/, (m) => `Suggested team: ${m[1].split(', ').map(tr).join(', ')}`],
]; };
