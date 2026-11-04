// v9.2.2 : sous-onglet visible Héros › Apparences (les skins étaient dans la fiche du héros, ouverte par le portrait,
// donc hors menu). Même écran qu'avant (hero.js lookView) : aperçu de l'apparence équipée, grille avec état et « Équiper ».
import { lookView } from './hero.js';

export default {
  id: 'looks',
  title: 'Apparences',
  icon: 'icon_summon',
  render: (ui, state) => lookView(ui, state),
};
