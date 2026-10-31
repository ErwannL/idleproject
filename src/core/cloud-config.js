// Adresse de l'API de sauvegarde. Sur le site (/play/), même origine : chaîne vide.
// Dans l'application bureau, adresse absolue du serveur (remplacer par le domaine une fois acheté).
export const CLOUD_BASE = typeof location !== 'undefined' && location.pathname.startsWith('/play')
  ? ''
  : 'https://games.unicorn-geological.ts.net';
