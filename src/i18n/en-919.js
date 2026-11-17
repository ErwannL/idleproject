// v9.1.9 : anglais complété (textes restés en français à l'écran et chaînes sans traduction relevées par
// tools/i18n-coverage.mjs). Ajouté à ./en.js comme ./en-910.js. Motifs : même petit langage que le coréen (engine.js makeP).
import { makeP } from './engine.js';
import { NUM } from './ko-919.js';

let lookup = () => null;
export function setEnLookup(fn) { lookup = fn; }
const dur = (s) => String(s).replace(/(\d+) h (\d+) min\b/g, '$1h $2m').replace(/(\d+) min (\d+) s\b/g, '$1m $2s').replace(/(\d+) h (\d\d)\b/g, '$1h $2m')
  .replace(/(\d+) j\b/g, '$1d').replace(/(\d+) h\b/g, '$1h').replace(/(\d+) min\b/g, '$1m').replace(/(\d+) s\b/g, '$1s');
const P = makeP(NUM, () => lookup, dur);
const pl = (n, one, many) => (Number(String(n).replace(/[^\d.-]/g, '')) === 1 ? one : many);

const DAYS = { lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday', vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FR_MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
// « lundi 9 novembre » → « Monday, November 9 ».
function frDate(s) {
  const m = String(s).trim().match(/^(?:(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) )?(\d{1,2}) ([a-zéû]+)\.?$/i);
  if (!m) return null;
  const mi = FR_MONTHS.findIndex((x) => m[3].toLowerCase().startsWith(x));
  if (mi < 0) return null;
  return `${m[1] ? `${DAYS[m[1].toLowerCase()]}, ` : ''}${MONTHS[mi]} ${Number(m[2])}`;
}

export const EXACT_919 = {
  'Vitesse ×2 débloquée (bouton ⏩)': 'Speed ×2 unlocked (⏩ button)', 'Vitesse ×5 débloquée (bouton ⏩)': 'Speed ×5 unlocked (⏩ button)',
  'Vitesse ×10 débloquée (bouton ⏩)': 'Speed ×10 unlocked (⏩ button)', 'Vitesse ×100 débloquée (bouton ⏩) — effets visuels coupés à cette vitesse': 'Speed ×100 unlocked (⏩ button) — visual effects off at this speed',
  ', maximum': ', maximum', '(dépôt privé ?)': '(private repository?)', 'Serveur injoignable : classement indisponible.': 'Server unreachable: leaderboard unavailable.',
  'Amis indisponibles': 'Friends unavailable', 'Action impossible': 'Action failed', 'écriture': 'write',
  '4 menus': '4 menus', 'sont des doublons': 'are duplicates', 'est un doublon': 'is a duplicate',
  'Retire le nombre de saisies indiqué dans « × fois »': 'Removes the number of entries set in “× times”', "Nombre de fois (jusqu'à 1 000 000 000)": 'Number of times (up to 1,000,000,000)',
  'Jeton enregistré (laisser vide pour le supprimer)': 'Token saved (leave empty to delete it)', 'Dépôt privé : jeton GitHub (version dev)': 'Private repository: GitHub token (dev version)',
  'Test des gains hors ligne (dev)': 'Offline gains test (dev)', 'Temps': 'Time', 'Annuler la demande': 'Cancel request', 'Retirer de mes amis': 'Remove from friends',
  'Nom du joueur à ajouter': 'Name of the player to add', 'Monde à atteindre': 'World to reach', 'Temps pour atteindre le monde': 'Time to reach the world', 'Réessayer': 'Retry',
  'Durée des dernières': 'Duration of the last ones', 'Filtrer par monde': 'Filter by world', 'Dès le début': 'From the start', 'Par monde': 'By world',
  '(touche un monde pour le détail)': '(tap a world for details)', 'Compagnons : ils combattent aux côtés du héros (2 places dans l\'équipe).': 'Companions: they fight alongside the hero (2 team slots).',
  "Familiers : petits alliés aux bonus passifs (1 place dans l'équipe).": 'Pets: small allies with passive bonuses (1 team slot).', 'Enter': 'Enter', 'Tab': 'Tab', 'Escape': 'Esc',
  'vos compagnons combattent à vos côtés : deux compagnons et un familier.': 'your companions fight alongside you: two companions and a pet.',
  'les gemmes invoquent des compagnons, des familiers et des apparences.': 'gems summon companions, pets and looks.',
  "les compagnons hors de l'équipe partent en mission, même jeu fermé, et rapportent des ressources.": 'companions outside the team go on missions, even with the game closed, and bring back resources.',
  "les fragments anciens achètent des talents permanents. La Renaissance s'ouvre plus tard dans ce même onglet.": 'ancient fragments buy permanent talents. Rebirth opens later in this same tab.',
  'une clé par tentative : de vrais combats de boss qui donnent fragments et équipement.': 'one key per attempt: real boss fights that give fragments and gear.',
  'chaque boss vaincu laisse un pouvoir. Réaffronte-les pour leur butin et leur maîtrise.': 'each defeated boss leaves a power. Fight them again for their loot and mastery.',
  "le Défi de la semaine (3 tentatives, sans clé) puis, plus loin, la Tour de l'Éternité : chaque record rapporte des récompenses.": 'the Weekly challenge (3 attempts, no key) then, further on, the Tower of Eternity: every record earns rewards.',
  'tout ce que vous découvrez est répertorié ; chaque palier rapporte une récompense.': 'everything you discover is listed; each tier earns a reward.',
  'tout ce qui est prêt à être récupéré, au même endroit (touche G).': 'everything ready to claim, in one place (G key).',
  'Le jeu ne bloque plus : les améliorations coûtent moins cher en fin de partie (paliers ×1,75 tous les 25 niveaux), les objets grandissent bien plus avec leur niveau, la Renaissance': 'The game no longer stalls: upgrades cost less late in the game (×1.75 tiers every 25 levels), items grow much more with their level, Rebirth',
  "L'arbre de talents passe de 25 à plus de 500 talents : 6 régions autour du Cœur, des branches qui se divisent et se rejoignent, des ponts entre régions, des notables et des clés de voûte.": 'The talent tree grows from 25 to over 500 talents: 6 regions around the Heart, branches that split and merge, bridges between regions, notables and keystones.',
  "À cette vitesse, les combats défilent extrêmement vite. Pour éviter les clignotements (personnes sensibles à l'épilepsie photosensible),": 'At this speed, battles fly by extremely fast. To avoid flashing (for people sensitive to photosensitive epilepsy),',
  ': plus de flashs, de chiffres de dégâts, de secousses ni de bannières.': ': no more flashes, damage numbers, shaking or banners.', 'Menus': 'Menus',
  "Ouvrir le menu (la fenêtre s'agrandit vers la gauche)": 'Open the menu (the window widens to the left)', 'Aide': 'Help', 'Bonus du moment': 'Current bonus', 'Retour de session (S)': 'Session return (S)',
  'Crée votre compte pour ajouter des amis': 'Create your account to add friends', 'absent': 'absent', 'objet garanti': 'guaranteed item',
  "Valeurs au niveau 1 ; elles grandissent avec le niveau de l'objet. Se ramasse sur les monstres, les boss et dans les coffres.": 'Values at level 1; they grow with the item level. Dropped by monsters, bosses and chests.',
  'Ouvrir (J)': 'Open (J)',
  'Avancer automatiquement après chaque étape': 'Advance automatically after each stage', 'Dernier événement': 'Latest event',
};

export const PATTERNS_919 = [
  P('# Étoile~s', (m) => `${m[1]} ${pl(m[1], 'Star', 'Stars')}`), P('# % des Légendaires obtenus · change chaque lundi · obtenu', '$1% of Legendaries obtained · changes every Monday · owned'),
  P('@ — # / # PV', '%1 — $2 / $3 HP'),
  P('Coffre au-delà de # (pièces des anciens mannequins) : rien n\'est perdu, mais rien n\'y entre tant qu\'il n\'est pas redescendu.', 'Chest over $1 (pieces from old mannequins): nothing is lost, but nothing goes in until it drops back below.'),
  P('+# clés de donjon', (m) => `+${m[1]} dungeon keys`), P('+# ascension~s de la Tour cette semaine', '+$1 Tower climb(s) this week'), P('×# fois', '×$1 times'),
  P('@ : coffre bonus', '%1: bonus chest'), P('Fait tomber l\'or de # ennemis', 'Drops the gold of $1 enemies'), P('fait tomber l\'or de # ennemis', 'drops the gold of $1 enemies'),
  P('soigne # % des PV', 'heals $1% HP'), P('bouclier de # % (# s)', '$1% shield ($2 s)'), [/^(.+), et (.+)$/, (m) => { const a = lookup(m[1]); const b = lookup(m[2]); return a === null || b === null ? null : `${a}, and ${b}`; }],
  P('Échec (# %) : # objet~s perdu~s, @, jauge @ +#', 'Failure ($1%): $2 item(s) lost, $3, gauge $4 +$5'),
  P('@ : arme reforgée en @', '%1: weapon reforged into %2'), P('@ : @ équipée', '%1: %2 equipped'), P('Renforcé : @ +# %', 'Reinforced: %1 +$2%'),
  P('# objet~s', (m) => `${m[1]} ${pl(m[1], 'item', 'items')}`), P('(# en attente : sac et coffre pleins)', '($1 waiting: bag and chest full)'), P('Défi terminé : # vague~s franchie~s.', 'Challenge over: $1 wave(s) cleared.'),
  P('GitHub @', 'GitHub $1'), P('@ · secours : @', '$1 · fallback: $2'), P('@ retiré.', '$1 removed.'), P('Vous êtes maintenant ami avec @.', 'You are now friends with $1.'), P('Demande envoyée à @.', 'Request sent to $1.'),
  P('Le combat est automatique. Même jeu fermé, il gagne encore (# % du rythme, # h au plus) : un résumé vous attend au retour.', 'Combat is automatic. Even with the game closed it keeps earning ($1% of the pace, $2h max): a summary awaits you when you return.'),
  P('@ · étape @', '%1 · stage $2'), P('prochain boss dans # étape~s', (m) => `next boss in ${m[1]} ${pl(m[1], 'stage', 'stages')}`), P('@ · palier @', '%1 · tier $2'),
  P('Tentatives épuisées — nouvelles règles le @', (m) => { const d = frDate(m[1]); return d ? `No attempts left — new rules on ${d}` : null; }),
  P('Ascension de la semaine faite — prochaine le @', (m) => { const d = frDate(m[1]); return d ? `This week's climb is done — next on ${d}` : null; }),
  P('Dernière tentative : # vague~s en @', 'Last attempt: $1 wave(s) in &2'), P('Semaines passées : @', 'Past weeks: $1'),
  P('Des vagues de # ennemis toujours plus forts (# s par vague), un boss toutes les # vagues (sauf règle contraire). Une défaite termine la tentative. Récompenses à chaque nouveau meilleur score de la semaine et à chaque record absolu.', 'Waves of $1 ever-stronger enemies ($2 s per wave), a boss every $3 waves (unless a rule says otherwise). A defeat ends the attempt. Rewards for each new weekly best and each all-time record.'),
  P('@ @ : termine ce donjon en @.', '$1 %2: clear this dungeon on %3.'), P('Une case par rareté : @ —', 'One box per rarity: %1 —'), P('Une case par rareté :', 'One box per rarity:'), P('@. Se rencontre : @.', '%1. Found in: %2.'),
  P('# fois', (m) => `${m[1]} ${pl(m[1], 'time', 'times')}`), P('Vaincs un monstre porteur de cette mutation. @', 'Defeat a monster carrying this mutation. %1'), P('Le monstre @.', 'The monster %1.'),
  P('Chance qu\'un monstre ordinaire soit muté : # % actuellement (# % sans Transcendance, +# % par Transcendance, # % au plus ; à partir du monde 2).', 'Chance for a regular monster to be mutated: $1% now ($2% without Transcendence, +$3% per Transcendence, $4% max; from world 2).'),
  P('Objet ancestral de @ (# % par victoire).', 'Ancestral item of %1 ($2% per victory).'), P('@ @. S\'obtient par l\'Invocation.', '%1 %2. Obtained through Summoning.'), P('Encyclopédie complétée à #', 'Encyclopedia $1 complete'),
  P('# pièce~s', (m) => `${m[1]} ${pl(m[1], 'piece', 'pieces')}`), P('Touche une apparence obtenue pour la porter. Bonus +# % par étoile.', 'Tap an owned look to wear it. Bonus +$1% per star.'),
  P('(étape @)', '(stage $1)'), P('· boss # %', '· boss $1%'), P('Acheter @', 'Buy $1'), P('(à la place de @)', '(replacing %1)'), P('Renforcer +#', 'Reinforce +$1'), P('Recycler +#', 'Recycle +$1'),
  P('#/# portées', '$1/$2 worn'), P('Le coffre garde # objets de plus que le sac,', 'The chest holds $1 more items than the bag,'),
  P('# objet~s ancestra~l~u~x du sac @ : la vitrine expose déjà un exemplaire au moins aussi bon. Les objets ancestraux ne sont jamais recyclés automatiquement.', '$1 ancestral item(s) in the bag %2: the case already displays a copy at least as good. Ancestral items are never recycled automatically.'),
  P('Le Musée expose tes objets ancestraux, un par vitrine, dès qu\'ils sont ramassés. Chaque pièce exposée : dégâts, PV et or @ (multiplicatif, ×2 si Légendaire). Collection complète : dégâts et PV +# % de plus. Une pièce exposée n\'est pas portée : reprends-la (↩) pour l\'équiper.', 'The Museum displays your ancestral items, one per case, as soon as they are picked up. Each displayed piece: damage, HP and gold $1 (multiplicative, ×2 if Legendary). Full collection: damage and HP +$2% more. A displayed piece is not worn: take it back (↩) to equip it.'),
  P('Aucune fusion possible : il faut # objets du même emplacement et de la même rareté (non verrouillés, hors objets ancestraux).', 'No fusion possible: you need $1 unlocked, non-ancestral items of the same slot and rarity.'),
  P('Fabriquer @ ·', (m) => ({ 'Épique+': 'Craft Epic+ ·', 'Rare+': 'Craft Rare+ ·' })[m[1]] ?? null),
  P('# objets de même emplacement et de même rareté → 1 objet de la rareté suivante, au niveau du meilleur.', '$1 items of the same slot and rarity → 1 item of the next rarity, at the level of the best one.'),
  P('En attente : @', 'Pending: $1'), P('# demande~s', (m) => `${m[1]} ${pl(m[1], 'request', 'requests')}`), P('Tu joues en invité (@).', 'You are playing as a guest ($1).'),
  P('# point~s', (m) => `${m[1]} ${pl(m[1], 'point', 'points')}`), P('Recharge # s · lancement automatique', 'Cooldown $1 s · auto-cast'), P('@ pendant # s', '%1 for $2 s'), P('· @ pendant # s', '· %1 for $2 s'),
  P('sur les # dernières', 'over the last $1'), P('après @ de jeu', 'after &1 of play'), P('# % de la campagne', '$1% of the campaign'), P('· obtenu @', '· owned $1'), P('Passif à #★ :', 'Passive at $1★:'),
  P('Coût moyen sur la bannière : # tirages pour l\'obtenir (# au plus avec le filet), # pour #★.', 'Average cost on the banner: $1 pulls to get it ($2 at most with the pity), $3 for $4★.'),
  P('Le @ :', 'On $1:'), P('Jusqu\'au @', 'Until $1'), P('Tes gemmes et ton filet restent. Monde ouvert. Archives dès le @.', 'Your gems and pity stay. World open. Archives from $1.'),
  P('Bannière de @ terminée. Tes gemmes et ton filet restent. Monde ouvert. Archives dès le @.', '%1 banner over. Your gems and pity stay. World open. Archives from $2.'),
  P('Apparences du héros : chacune change son allure et apporte un bonus (@).', 'Hero looks: each changes how your hero looks and grants a bonus (%1).'),
  P('Dernière : # étage~s en @', 'Last: $1 floor(s) in &2'), P('Clé de voûte : dépensez # points dans la région @ (actuellement #).', 'Keystone: spend $1 points in the %2 region (currently $3).'),
  P('/# talents · #', '/$1 talents · $2'), P('investis', 'invested'), P('(# % des améliorations gardés)', '($1% of upgrades kept)'), P('@ (ou Espace sans sélection)', '$1 (or Space with nothing selected)'),
  P('+# (record @)', '+$1 (record $2)'), P('# — # encore dans le sac', '$1 — $2 still in the bag'), P('+# étage~s de record', (m) => `+${m[1]} record ${pl(m[1], 'floor', 'floors')}`),
  P('vos dégâts, PV et or, et le niveau maximum du héros passe à #.', 'your damage, HP and gold, and the hero\'s max level becomes $1.'),
  P('@ — @ : @. Contre : @.', '%1 — %2: %3. Counter: %4.'), P('@ au défi : vague # · @', '%1 in the challenge: wave $2 · %3'), P('Défi : vague # franchie.', 'Challenge: wave $1 cleared.'),
  P('Temps écoulé ! Défi de la semaine : # vague~s franchie~s. Record de la semaine : # · absolu : #.', 'Time\'s up! Weekly challenge: $1 wave(s) cleared. Weekly record: $2 · all-time: $3.'),
  P('Défi de la semaine : # vague~s franchie~s. Record de la semaine : # · absolu : #.', 'Weekly challenge: $1 wave(s) cleared. Weekly record: $2 · all-time: $3.'),
  P('@ réussi !', '%1 succeeded!'), P('@ terminé', '%1 over'), P('Palier #', 'Tier $1'),
  P('Tour de l\'Éternité : temps écoulé, la tour s\'effondre à l\'étage #. Record : #.', 'Tower of Eternity: time\'s up, the tower collapses on floor $1. Record: $2.'),
  P('(boss à # % de PV)', '(boss at $1% HP)'), P('face au boss final (encore # % de PV)', 'to the final boss ($1% HP left)'), P('en salle #', 'in room $1'),
  P('(réel ×#)', '(actual ×$1)'), P('# img/s · pas/tick #', '$1 fps · steps/tick $2'), P('vitesse ×# → réelle ×#', 'speed ×$1 → actual ×$2'), P('(dernier # ms)', '(last $1 ms)'),
  P('pire tick # ms · gels #', 'worst tick $1 ms · freezes $2'), P('sac # · ennemis #', 'bag $1 · enemies $2'), P('+# Étoiles', '+$1 Stars'),
  P('Tout repart de l\'étape 1 : Renaissances (# % conservées), arbre de talents et fragments anciens sont remis à zéro. L\'équipement, les compagnons, les gemmes et les bonus éternels sont conservés.', 'Everything restarts from stage 1: Rebirths ($1% kept), talent tree and ancient fragments are reset. Gear, companions, gems and eternal bonuses are kept.'),
  P('niveau~x de talent @, le moins cher d\'abord, pour', (m) => { const w = lookup(m[1]); return w === null ? null : `talent level(s) ${w}, cheapest first, for`; }),
  P('dans la région @', 'in the %1 region'), P('Vous étiez dans @ : il ne progresse pas hors ligne (il reprend à votre retour).', 'You were in %1: it doesn\'t progress offline (it resumes when you return).'),
  P('Hors ligne, le héros reste sur l\'étape @ (la meilleure où il gagne vraiment) à # % de son rythme, sans affronter de boss.', 'Offline, the hero stays on stage $1 (the best one where they really earn) at $2% of their pace, without fighting bosses.'),
  P('Défaite face au boss final (encore # % de PV). Conservé : @ — détails dans l\'onglet Donjons.', 'Defeated by the final boss ($1% HP left). Kept: %2 — details in the Dungeons tab.'),
  P('Défaite en salle #. Conservé : @ — détails dans l\'onglet Donjons.', 'Defeated in room $1. Kept: %2 — details in the Dungeons tab.'),
  P('@ rangé au coffre (ensemble « @ »)', '%1 stored in the chest (set “%2”)'), P('Se rencontre : @. Vaincs-le pour le découvrir.', 'Found in: %1. Defeat it to discover it.'),
];
