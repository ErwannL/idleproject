// Adresse de l'API de sauvegarde. Sur le site (/play/), même origine : chaîne vide.
// Dans l'application bureau, adresse absolue du serveur (ascendrya.com).
export const CLOUD_BASE = typeof location !== 'undefined' && location.pathname.startsWith('/play')
  ? ''
  : 'https://ascendrya.com';
