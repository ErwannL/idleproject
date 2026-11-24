// v10.12 (lot « combat ») : petits outils communs aux écrans Carte, Donjons, Arène, Défis, Événement sur téléphone.
// Le PC garde son HTML d'avant : chaque panneau ne prend la voie « téléphone » que si ce test est vrai.
export const isPhoneUi = (ui) => Boolean(ui?.root?.classList?.contains('m-phone')) || (ui?.root?.clientWidth ?? 9999) <= 600;
