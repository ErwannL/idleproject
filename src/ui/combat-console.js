// v10.13 (lot 8, § 8.4) : la console du bas de l'écran de combat. Les éléments qui flottaient sur le mur de briques (sorts,
// vague, PV, malédiction, Sceau « Tout récupérer », coffre de butin) vivent dans UN cadre doré, en trois blocs :
//   gauche  « Attaques et Ultime »  : #skill-bar (cases de 84 px, touche, cadran de recharge)
//   centre  « Vague et héros »      : #progress, #scene-bottom (barre de PV), puis les étiquettes (#env-chip, #news…) sur une ligne
//   droite                          : #next-action (bouton doré) et #loot-bag (coffre)
// Les éléments gardent leur id (le reste du code les cherche par id) : on ne fait que les déplacer dans la console. La mise
// en page (PC : 3 blocs ; téléphone : 2 lignes) est en CSS (desk-hud.css, mobile-hud.css) ; ui.layoutColumn() ne place plus
// rien à la main, il règle seulement la hauteur du sol au-dessus de la console.
export const CONSOLE_ID = 'combat-console';

export function buildCombatConsole(ui) {
  const doc = typeof document === 'undefined' ? null : document;
  const area = doc?.getElementById('stage-area');
  if (!area) return null;
  let box = doc.getElementById(CONSOLE_ID);
  if (!box) {
    box = doc.createElement('div');
    box.id = CONSOLE_ID;
    box.innerHTML = `<section class="cc-block cc-attacks" aria-label="Attaques et Ultime"><span class="cc-lbl">Attaques et Ultime</span><div class="cc-slots"></div></section>
      <section class="cc-block cc-wave" aria-label="Vague et héros"><span class="cc-lbl">Vague et héros</span></section>
      <section class="cc-block cc-right"></section>
      <i class="cc-gem cc-gem-l" aria-hidden="true"></i><i class="cc-gem cc-gem-r" aria-hidden="true"></i>`;
    area.appendChild(box);
  }
  const slots = box.querySelector('.cc-slots'), wave = box.querySelector('.cc-wave'), right = box.querySelector('.cc-right');
  const put = (id, parent) => { const el = doc.getElementById(id); if (el && el.parentElement !== parent) parent.appendChild(el); return el; };
  put('skill-bar', slots);
  put('hud', wave);
  put('scene-bottom', wave);
  put('env-chip', wave);
  put('next-action', right);
  put('loot-bag', right);
  ui.console = box;
  return box;
}
