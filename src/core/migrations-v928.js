// v9.2.8 : conversion d'une sauvegarde d'avant l'économie du document du producteur (SAVE_VERSION < 10). Rien n'est
// perdu, et la conversion est généreuse :
// - compteurs d'invocation : l'ancien compteur commun (Légendaire garanti au 60e) devient le compteur de chaque
//   bannière à la même proportion du chemin (× 100/60 pour les héros, plafonné à 99 ; tel quel pour les familiers,
//   plafonné à 59) ; « Légendaire perdu » devient la garantie de la vedette ; le compteur Épique devient celui des SR ;
// - apparences : le bonus de l'apparence portée devient un bonus de compte permanent (« Héritage des apparences »),
//   et chaque doublon d'apparence invoquée est remboursé par un ticket limité (core/cosmetics.js) ;
// - familiers : ils ne s'invoquent plus avec des gemmes ; 20 tickets familiers offerts pour démarrer.
import { BANNERS } from '../data/economy.js';
import { migrateLooks } from './cosmetics.js';
import { emptyPity } from './invocation.js';
import { addWallet } from './wallet.js';

export const PET_TICKETS_GIFT = 20;

export function migratePity(rawSummon) {
  const s = rawSummon && typeof rawSummon === 'object' ? rawSummon : {};
  const n = (v) => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const old = n(s.sinceLegendary);
  const sr = Math.min(n(s.sinceEpic), BANNERS.limited.srEvery - 1);
  const pity = emptyPity();
  const hero = Math.min(BANNERS.limited.hard - 1, Math.round((old * BANNERS.limited.hard) / 60));
  pity.limited = { ssr: hero, sr, guaranteed: s.lostLegend === true };
  pity.permanent = { ssr: Math.min(BANNERS.permanent.hard - 1, hero), sr };
  pity.pet = { ssr: Math.min(BANNERS.pet.hard - 1, old), sr };
  return pity;
}

// Après cleanCollections (state.heroes et state.summon nettoyés). Renvoie le détail (écran « Mise à jour »).
export function migrateEconomy928(state, raw) {
  state.summon.pity = migratePity(raw?.summon);
  const tickets = migrateLooks(state);
  if (tickets) addWallet(state, 'ticketLimited', tickets);
  addWallet(state, 'ticketPet', PET_TICKETS_GIFT);
  return { lookTickets: tickets, petTickets: PET_TICKETS_GIFT };
}
