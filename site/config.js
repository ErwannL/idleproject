// Configuration publique du site. Remplacer le domaine avant la mise en ligne.
// Aucune clé ni secret ici : ce fichier est servi au navigateur.
export const SITE = {
  name: 'Ascendrya',
  domain: 'ascendrya.com',
  contactEmail: 'contact@ascendrya.com',
  // v9.3.0 : réseaux du pied de page (un lien vide est masqué). v10.8 : à remplir avec les vraies adresses des comptes.
  socials: {
    discord: '',
    x: 'https://x.com/Ascendrya',
    youtube: 'https://www.youtube.com/@AscendryaRPG',
    tiktok: 'https://www.tiktok.com/@ascendrya',
  },
  // v10.8 : pixels publicitaires (identifiants publics). Vides = rien n'est chargé.
  pixels: { meta: '', tiktok: '' },
};
