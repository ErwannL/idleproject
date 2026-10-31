// Type de build. La version publique garde ces valeurs ; `tools/build-web.mjs --dev` les remplace
// pour produire la version dev (codes de triche actifs, pas de synchro cloud, donc pas de classement).
export const BUILD = {
  name: 'public',
  cheats: false, // codes de triche (Paramètres) : désactivés, et l'état de triche est retiré des sauvegardes
  cloud: true, // compte et synchronisation cloud (classement compris)
};
