// v10.14.1 (lot 4) : anglais des Fêtes du mois — titres, phrases, monnaies et régions de FEST_MONTHS, titres automatiques,
// missions de la fête, bénédictions de la Brèche, écran de la fête (fest-hub.js, fest-tabs.js), onglet Événement, messages de
// main.js, fiche « ? », notifications et ligne « Jalons » de l'Invocation. Branché à la fin de ./en.js, sans écraser l'existant.
let LK = () => null;
const t = (s) => LK(s) ?? s;
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // virgule décimale → point
const grp = (s) => String(s).replace(/ /g, ','); // « 6 000 » → « 6,000 »
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Monnaies des fêtes (data/fest.js) : les phrases les citent par leur nom, on ne traduit que ces noms-là.
export const FEST_CURRENCIES_EN = {
  'Cœurs de braise': 'Ember Hearts', 'Bourgeons': 'Buds', "Plumes d'aube": 'Dawn Feathers', "Éclats d'éclipse": 'Eclipse Shards',
  'Flocons': 'Snowflakes', 'Médailles': 'Medals', 'Pétales': 'Petals', "Flèches d'or": 'Golden Arrows', 'Cierges': 'Candles',
  'Shuriken': 'Shuriken', 'Braises de lune': 'Moon Embers', 'Lauriers': 'Laurels', 'Insignes': 'Badges', 'Jetons': 'Tokens',
};
const CUR = `(${[...Object.keys(FEST_CURRENCIES_EN), 'pièces'].map(esc).join('|')})`;
const N = '([+\\-−~]?\\d+(?:[,.]\\d+)?(?: (?:K|M|B|T|Qa|Qi))?)';
const G = '(\\d+(?: \\d{3})*)'; // nombre avec milliers (missions : « 6 000 »)
const cur = (s) => FEST_CURRENCIES_EN[s] ?? (s === 'pièces' ? 'coins' : s);
const plural = (n) => (Number(String(n).replace(/\D/g, '')) > 1 ? 's' : '');

export const EXACT_1014 = {
  // ---- vocabulaire
  ...FEST_CURRENCIES_EN,
  'Grande fête': 'Grand festival', 'Petite fête': 'Mini festival', 'Fête': 'Fest',
  'Brèche': 'Breach', 'Sentier': 'Trail', 'Échange': 'Exchange', 'échange': 'trade',
  // ---- FEST_MONTHS : titres, phrases, régions
  'Fête des Cœurs ardents': 'Festival of Burning Hearts',
  'La Reine démone ouvre son bal de braises.': 'The Demon Queen opens her ball of embers.',
  'Jardins rougeoyants': 'Glowing Gardens', 'Salle du bal': 'Ballroom', 'Trône des braises': 'Ember Throne',
  'Bal des Lames roses': 'Rose Blade Ball',
  'Danse avec la Lame rose, adopte un Hérisson de cristal.': 'Dance with the Rose Blade, adopt a Crystal Hedgehog.',
  'Éveil du Printemps': 'Spring Awakening',
  'La Gardienne sylvestre réveille la forêt.': 'The Sylvan Guardian awakens the forest.',
  'Clairière': 'Glade', 'Bois ancien': 'Ancient Woods', 'Cœur de la forêt': 'Heart of the Forest',
  'Concours des Archers': "Archers' Contest",
  "L'Archère elfe et la Fée des bois t'attendent.": 'The Elf Archer and the Wood Fairy are waiting for you.',
  'Aube dorée': 'Golden Dawn',
  "L'Archange descend des Îles célestes.": 'The Archangel descends from the Sky Islands.',
  'Escalier des nuages': 'Cloud Stairway', 'Temple du ciel': 'Sky Temple', 'Porte du soleil': 'Sun Gate',
  'Pèlerinage de Lumière': 'Pilgrimage of Light',
  'Le Grand prêtre et le Mini-golem font route avec toi.': 'The High Priest and the Mini Golem travel with you.',
  'Nuit des Éclipses': 'Night of Eclipses',
  "Le Seigneur de l'ombre déchire le ciel.": 'The Shadow Lord tears the sky apart.',
  'Faille': 'Rift', "Citadelle d'ombre": 'Shadow Citadel', 'Trône du Néant': 'Throne of the Void',
  'Nuit des Shinobis': 'Night of the Shinobi',
  "Le Ninja et le Hibou érudit veillent dans l'ombre.": 'The Ninja and the Scholarly Owl keep watch in the shadows.',
  'Solstice de Givre': 'Frost Solstice',
  "L'Impératrice des glaces fige les marées.": 'The Ice Empress freezes the tides.',
  'Côte gelée': 'Frozen Coast', 'Palais de glace': 'Ice Palace', 'Trône de givre': 'Frost Throne',
  'Sabbat de la Saint-Jean': 'Midsummer Sabbath',
  'La Sorcière allume les feux, le Hérisson de cristal revient.': 'The Witch lights the bonfires, the Crystal Hedgehog returns.',
  'Festival des Titans': 'Titan Festival',
  'La Reine démone revient affronter le Colosse.': 'The Demon Queen returns to face the Colossus.',
  "Arène d'été": 'Summer Arena', 'Volcan': 'Volcano', 'Sommet des Titans': 'Titan Summit',
  'Jeux des Champions': "Champions' Games",
  'Le Barbare et la Fée des bois relèvent le défi.': 'The Barbarian and the Wood Fairy take up the challenge.',
  // titres automatiques (rotation au-delà de juillet 2027)
  "Le héros du mois t'attend.": 'The hero of the month is waiting for you.',
  'Un héros et un familier gratuits à gagner.': 'A free hero and a free pet to win.',
  'Avant-poste': 'Outpost', 'Terres du héros': "Hero's Lands", 'Sanctuaire': 'Sanctuary',
  'viens voir les nouveautés !': "come and see what's new!",
  // ---- missions de la fête
  'Se connecter': 'Log in',
  // ---- bénédictions de la Brèche
  'Lame bénie': 'Blessed Blade', '+20 % de dégâts': '+20% damage',
  'Fureur': 'Fury', '+35 % de dégâts, −5 s de combat': '+35% damage, −5 s of fight time',
  'Sablier': 'Hourglass', '+6 s de combat': '+6 s of fight time',
  'Bourse pleine': 'Full Purse', '+30 % de monnaie': '+30% currency',
  'Second souffle': 'Second Wind', '+1 cœur': '+1 heart',
  'Concentration': 'Focus', '+10 % de dégâts, +3 s': '+10% damage, +3 s',
  // ---- écran de la fête : en-tête, onglets, fiche « ? »
  'Comment ça marche ?': 'How does it work?',
  'Rythme': 'Pace', 'Monnaie': 'Currency', 'Éclats': 'Shards',
  'Combats fermés, boutique ouverte. Le reste devient des éclats.': 'Fights closed, shop open. What is left becomes shards.',
  'Dernière chance': 'Last chance',
  // ---- Aventure
  'Carte terminée : bravo !': 'Map complete: well done!',
  'Héros du mois': 'Hero of the month',
  'Dans l\'équipe': 'In the team',
  "Mettre dans l'équipe ›": 'Put in the team ›',
  'avec le héros dans l\'équipe': 'with the hero in the team',
  '✓ Région libérée': '✓ Region cleared',
  "Jalons d'invocation": 'Summon milestones',
  'Jalons :': 'Milestones:',
  // ---- World Boss
  'World Boss de la fête': 'Festival World Boss',
  'Le World Boss est fermé pour cette fête.': 'The World Boss is closed for this festival.',
  'Tentatives': 'Attempts', "Aujourd'hui": 'Today',
  'Bilan de la tentative': 'Attempt summary', 'Nouveau record': 'New record', 'Palier atteint': 'Floor reached',
  'Titan verrouillé': 'Titan locked',
  "Fermé pendant l'échange.": 'Closed during the exchange.',
  'Gagné': 'Earned',
  // ---- Brèche
  'Brèche de la fête': 'Festival Breach', 'Brèche terminée': 'Breach over',
  'Prêt à entrer ?': 'Ready to enter?', "Plus d'entrée aujourd'hui": 'No entries left today',
  'Entrer (1 entrée)': 'Enter (1 entry)', 'Encore une fois (1 entrée)': 'Once more (1 entry)',
  "Fermée pendant l'échange.": 'Closed during the exchange.',
  'Bénédictions prises': 'Blessings taken',
  'Première fois': 'First time',
  'Victoire :': 'Win:', 'gagné dans cette course': 'earned this run', 'gagnés pendant la course': 'earned during the run',
  'Quitter la Brèche ?': 'Leave the Breach?',
  'Quitter​': 'Leave', // le bouton de la Brèche : « Quitter » seul veut dire quitter la guilde
  // ---- Missions
  "Les missions sont fermées pendant l'échange.": 'Missions are closed during the exchange.',
  'elles changent à minuit': 'they change at midnight',
  'Missions de la fête': 'Festival missions',
  'Faite': 'Done', 'Récupérer': 'Claim',
  // ---- Boutique
  'Épuisé': 'Sold out',
  'Ticket permanent': 'Permanent ticket', 'Fragment Légendaire': 'Legendary Fragment', "Pierres d'ascension": 'Ascension stones',
  "Universel : n'importe quel héros Légendaire": 'Universal: any Legendary hero',
  'Familier gratuit de la fête': 'Free festival pet', 'Héros gratuit de la fête': 'Free festival hero',
  'Limitée': 'Limited', 'Permanente': 'Permanent',
  // ---- Sentier
  'Héros gratuit': 'Free hero', 'Familier gratuit': 'Free pet', 'Sentier ·': 'Trail ·',
  // ---- onglet Événement
  'Entrer dans la fête': 'Enter the festival', 'Mode de la fête': 'Festival mode', 'Du jour et de la fête': 'Daily and festival',
  'Héros et familier gratuits': 'Free hero and free pet', 'Échange de fin de fête': 'End-of-festival exchange',
  // ---- messages de main.js et de l'interface
  'Gardien trop solide : renforce le héros': 'Guardian too strong: strengthen your hero',
  'Brèche ouverte : palier 1': 'Breach open: floor 1',
  'Échange en cours : les combats sont fermés.': 'Exchange under way: fights are closed.',
  'Récompense de la fête': 'Festival reward', 'Récompenses de la fête': 'Festival rewards', 'Boutique de la fête': 'Festival shop',
  'Classement de la fête': 'Festival ranking', 'Top 30 %': 'Top 30%', 'Top 60 %': 'Top 60%', 'Participant': 'Participant',
  'La fête commence': 'The festival begins', 'Entrées de Brèche pleines': 'Breach entries full', 'Dernier jour': 'Last day',
  "6/6 : entre dans la Brèche avant d'en perdre.": "6/6: enter the Breach before you lose any.",
  'demain, plus de combats. Récupère tes récompenses !': 'tomorrow, no more fights. Claim your rewards!',
  'Légendaire garanti dans 100 invocations': 'Legendary guaranteed within 100 summons',
};

export const patterns1014 = (lookup = () => null) => { LK = lookup; return [
  // ---- temps
  [/^(\d+) j (\d+) h$/, (m) => `${m[1]}d ${m[2]}h`],
  [/^(\d+) h (\d{2})$/, (m) => `${m[1]}h ${m[2]}m`],
  [/^encore (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `${x} left`; }],
  [/^puis (\d+) jours d'échange$/, (m) => `then ${m[1]} days of exchange`],
  [/^(Grande|Petite) fête · jour (\d+)\/(\d+)$/, (m) => `${m[1] === 'Grande' ? 'Grand' : 'Mini'} festival · day ${m[2]}/${m[3]}`],
  [new RegExp(`^Dépense tes ${CUR} : encore (.+)$`), (m) => { const x = LK(m[2]); return x === null ? null : `Spend your ${cur(m[1])}: ${x} left`; }],
  [new RegExp(`^Dépense tes ${CUR} à la boutique : le reste deviendra des éclats\\.$`), (m) => `Spend your ${cur(m[1])} in the shop: what is left will become shards.`],
  [/^Missions du jour : elles changent à minuit$/, () => 'Daily missions: they change at midnight'],
  // ---- titres automatiques
  [/^Fête du héros : (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `Hero Festival: ${x}`; }],
  [/^Foire : (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `Fair: ${x}`; }],
  [/^((?:Fête du héros|Foire) : .+?) : (.+)$/, (m) => { const a = LK(m[1]); const b = LK(m[2]); return a === null || b === null ? null : `${a}: ${b}`; }],
  [/^(.+?) : (demain, plus de combats\. Récupère tes récompenses !)$/, (m) => { const a = LK(m[1]); const b = LK(m[2]); return a === null || b === null ? null : `${a}: ${b}`; }],
  // ---- missions de la fête
  [new RegExp(`^Vaincre ${G} monstres$`), (m) => `Defeat ${grp(m[1])} monsters`],
  [new RegExp(`^Vaincre ${G} boss$`), (m) => `Defeat ${grp(m[1])} bosses`],
  [new RegExp(`^Terminer ${G} donjons$`), (m) => `Complete ${grp(m[1])} dungeons`],
  [new RegExp(`^Faire ${G} invocations$`), (m) => `Do ${grp(m[1])} summons`],
  [new RegExp(`^Faire ${G} améliorations$`), (m) => `Do ${grp(m[1])} upgrades`],
  [/^(\d+) faites? (▸|▾)$/, (m) => `${m[1]} done ${m[2]}`],
  // ---- Aventure
  [/^Carte de (.+) · (\d+)\/(\d+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `${x}'s Map · ${m[2]}/${m[3]}`; }],
  [/^Étape (\d+)$/, (m) => `Stage ${m[1]}`],
  [new RegExp(`^Étape (\\d+) : \\+(\\d+) ${CUR}$`), (m) => `Stage ${m[1]}: +${m[2]} ${cur(m[3])}`],
  [new RegExp(`^Étape (\\d+) : débloque le World Boss · \\+(\\d+) ${CUR}$`), (m) => `Stage ${m[1]}: unlocks the World Boss · +${m[2]} ${cur(m[3])}`],
  [new RegExp(`^Étape (\\d+) : coffre de région · \\+(\\d+) ${CUR}$`), (m) => `Stage ${m[1]}: region chest · +${m[2]} ${cur(m[3])}`],
  [/^Étape (\d+) : fragment Légendaire universel$/, (m) => `Stage ${m[1]}: universal Legendary fragment`],
  [/^Étape (\d+) : World Boss · étape (\d+) : fragment Légendaire universel$/, (m) => `Stage ${m[1]}: World Boss · stage ${m[2]}: universal Legendary fragment`],
  [/^Gardien niv\. (\d+-\d+(?: ×\d+)?)$/, (m) => `Guardian lvl ${m[1]}`],
  [/^combat de (\d+) s$/, (m) => `${m[1]} s fight`],
  [new RegExp(`^\\+(\\d+) % de ${CUR}$`), (m) => `+${m[1]}% ${cur(m[2])}`],
  // ---- World Boss
  [new RegExp(`^Combat de (\\d+) s · \\+(\\d+) ${CUR} par tentative, \\+(\\d+) par palier\\.$`), (m) => `${m[1]} s fight · +${m[2]} ${cur(m[3])} per attempt, +${m[4]} per tier.`],
  [/^Libère l'étape (\d+) ›$/, (m) => `Clear stage ${m[1]} ›`],
  [/^(\d+) sur (\d+)$/, (m) => `${m[1]} of ${m[2]}`],
  // ---- Brèche
  [/^(\d+) paliers · 1 bénédiction par victoire$/, (m) => `${m[1]} floors · 1 blessing per win`],
  [/^Les (\d+) paliers$/, (m) => `The ${m[1]} floors`],
  [/^(\d+) par jour · record (\d+)\/(\d+)$/, (m) => `${m[1]} per day · record ${m[2]}/${m[3]}`],
  [/^(\d+) entrées? sur (\d+)$/, (m) => `${m[1]} of ${m[2]} entries`],
  [/^(\d+) cœurs?$/, (m) => `${m[1]} heart${plural(m[1])}`],
  [/^Palier (\d+)\/(\d+)$/, (m) => `Floor ${m[1]}/${m[2]}`],
  [/^Gardien du palier (\d+) : niv\. (\d+-\d+(?: ×\d+)?)$/, (m) => `Floor ${m[1]} guardian: lvl ${m[2]}`],
  [/^Palier (\d+) franchi : choisis une bénédiction$/, (m) => `Floor ${m[1]} cleared: choose a blessing`],
  [new RegExp(`^Tu gardes les ${N} ${CUR} gagnés\\.$`), (m) => `You keep the ${d(m[1])} ${cur(m[2])} you earned.`],
  [/^Première fois au palier (\d+)$/, (m) => `First time on floor ${m[1]}`],
  [/^Palier (\d+) franchi : \+(.+)$/, (m) => `Floor ${m[1]} cleared: +${d(m[2])}`],
  [/^Brèche refermée au palier (\d+)$/, (m) => `Breach closed at floor ${m[1]}`],
  [/^Palier (\d+) : gardien trop solide \((\d+) cœurs?\)$/, (m) => `Floor ${m[1]}: guardian too strong (${m[2]} heart${plural(m[2])})`],
  [/^Brèche quittée : (\d+) paliers?, \+(.+)$/, (m) => `Breach left: ${m[1]} floor${plural(m[1])}, +${d(m[2])}`],
  // ---- Boutique
  [/^Reste (\d+)\/(\d+)$/, (m) => `${m[1]}/${m[2]} left`],
  [new RegExp(`^Acheter pour ${N} ${CUR}$`), (m) => `Buy for ${d(m[1])} ${cur(m[2])}`],
  [new RegExp(`^Boutique · ${CUR}$`), (m) => `Shop · ${cur(m[1])}`],
  [/^Copie : (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `Copy: ${x}`; }],
  [/^(.+) rejoint l'équipe !$/, (m) => { const x = LK(m[1]); return x === null ? null : `${x} joins the team!`; }],
  [/^Ce qui reste à la fin de l'échange devient des éclats \((\d+) par (.+)\)\.$/, (m) => `What is left when the exchange ends becomes shards (${m[1]} per coin).`],
  [/^· ce qui reste à la fin devient des éclats \((\d+) par (.+)\)\.$/, (m) => `· what is left at the end becomes shards (${m[1]} per coin).`],
  [/^Combats, boss et missions sont fermés\. Dépense ta monnaie : ce qui reste à la fin sera converti en éclats \((\d+) par pièce\)\.$/, (m) => `Fights, bosses and missions are closed. Spend your currency: what is left at the end will be converted into shards (${m[1]} per coin).`],
  [/^Échange effectué$/, () => 'Exchange done'],
  // ---- Sentier
  [/^(\d+) \/ (\d+) obtenus$/, (m) => `${m[1]} / ${m[2]} obtained`],
  [new RegExp(`^${N} ${CUR} gagnés$`), (m) => `${d(m[1])} ${cur(m[2])} earned`],
  [new RegExp(`^${N} ${CUR}$`), (m) => `${d(m[1])} ${cur(m[2])}`],
  [/^La monnaie tombe en jouant \(monstres et boss, (\d+) par jour au plus\) et avec les missions\. Dépenser ne fait pas reculer sur le sentier\.$/, (m) => `Currency drops as you play (monsters and bosses, ${m[1]} a day at most) and with missions. Spending does not set you back on the trail.`],
  // ---- fiche « ? »
  [/^la grande fête dure (\d+) jours, puis (\d+) jours d'échange, puis la petite fête du mois\.$/, (m) => `the grand festival lasts ${m[1]} days, then ${m[2]} days of exchange, then the month's mini festival.`],
  [new RegExp(`^tes ${CUR} se gagnent sur la Carte, au World Boss, dans la Brèche et avec les missions\\.$`), (m) => `your ${cur(m[1])} are earned on the Map, at the World Boss, in the Breach and with missions.`],
  [/^les (\d+) derniers jours, les combats sont fermés et la boutique reste ouverte\.$/, (m) => `during the last ${m[1]} days, fights are closed and the shop stays open.`],
  [/^ce qui reste à la fin devient des éclats \((\d+) par pièce\)\. Tu ne perds rien\.$/, (m) => `what is left at the end becomes shards (${m[1]} per coin). You lose nothing.`],
  [/^la petite fête dure jusqu'à l'échange des (\d+) derniers jours du mois\.$/, (m) => `the mini festival lasts until the exchange of the last ${m[1]} days of the month.`],
  [new RegExp(`^tes ${CUR} tombent en jouant \\(monstres, boss\\) et avec les missions : elles font avancer le sentier\\.$`), (m) => `your ${cur(m[1])} drop as you play (monsters, bosses) and with missions: they move you along the trail.`],
  [/^les (\d+) derniers jours, il ne reste que la boutique\.$/, (m) => `during the last ${m[1]} days, only the shop is left.`],
  // ---- onglet Événement, Invocation, HUD
  [/^(\d+)\/(\d+) étapes$/, (m) => `${m[1]}/${m[2]} stages`],
  [/^(\d+) à récupérer$/, (m) => `${m[1]} to claim`],
  [/^(\d+) à faire$/, (m) => `${m[1]} to do`],
  [/^Héros du mois · (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `Hero of the month · ${x}`; }],
  [/^Gratuits · (.+) et (.+)$/, (m) => { const a = LK(m[1]); const b = LK(m[2]); return a === null || b === null ? null : `Free · ${a} and ${b}`; }],
  [/^(\d+) invocations$/, (m) => `${m[1]} summons`],
  [/^Jalons de la fête : (\d+) sur (\d+)\. Ouvrir l'Aventure de la fête$/, (m) => `Festival milestones: ${m[1]} of ${m[2]}. Open the festival Adventure`],
  // ---- messages de main.js
  [/^Étape (\d+) réussie : \+(.+)$/, (m) => `Stage ${m[1]} cleared: +${d(m[2])}`],
  [/^Étape (\d+) : gardien trop solide$/, (m) => `Stage ${m[1]}: guardian too strong`],
  [/^(\d+) étapes? gagnées? : \+(.+)$/, (m) => `${m[1]} stage${plural(m[1])} won: +${d(m[2])}`],
  [/^World Boss : (.+) dégâts · \+(\d+)( · record !)?$/, (m) => `World Boss: ${d(m[1])} damage · +${m[2]}${m[3] ? ' · record!' : ''}`],
  [/^Classement de la fête : (.+)$/, (m) => `Festival ranking: ${t(m[1])}`],
  [/^Mission réussie : \+(\d+)$/, (m) => `Mission complete: +${m[1]}`],
  [/^Missions : \+(\d+)$/, (m) => `Missions: +${m[1]}`],
  [/^×(\d+) : (\d+) tickets? de compagnon$/, (m) => `×${m[1]}: ${m[2]} companion ticket${plural(m[2])}`],
  [/^Fin de la fête : monnaie restante convertie en (.+) éclats$/, (m) => `Festival over: remaining currency converted into ${d(m[1])} shards`],
]; };
