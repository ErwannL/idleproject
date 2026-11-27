// v10.17.1 (6) : un seul bouton doré par écran, toujours en bas du cadre. Après chaque rendu d'un onglet (avant morph), le premier
// bouton doré du cadre (.m-frame / .mp-frame) qui n'est pas déjà dans un pied de fiche est déplacé, avec sa rangée de boutons s'il
// en a une, dans un pied `.gold-dock` ajouté à la fin du cadre ; ce pied est épinglé en bas de la fenêtre pendant le défilement
// (position: sticky, src/ui/finitions10171.css) et prend toute la largeur sur téléphone. Les fiches (.m-sheet), les fenêtres
// d'unité, les colonnes de détail du PC et les scènes en surimpression gardent leur propre pied.
const GOLD = '.m-btn-gold, .btn-gold';
const KEEP = '.m-sheet, .unit-pop, .gold-dock, [data-nodock], [class*="dock"], .de-det, .de-actions, .m-modes, .m-tabs, [role="dialog"], [class*="overlay"], [class*="story"], [class*="intro"], .em-actions, .panel-help-card';
const BTN = 'button, a, .m-btn, .btn';

// Sur PC, un bouton doré rangé dans une colonne (fiche de détail, panneau latéral, carte de grille) y reste : il est déjà au pied
// de sa colonne ; seuls les écrans d'une colonne (Objectifs, Classement, Guilde…) le déplacent.
const KEEP_DESK = '[class*="cols"], [class*="-side"], [class*="-det"], .d-stack, [class*="rs-"], [class*="dsk-"], [class*="-panel"], [class*="-card"]:not(.m-card)';

export function dockGold(html, phone = true) {
  if (typeof document === 'undefined' || !/m-btn-gold|btn-gold/.test(html)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const gold = [...tpl.content.querySelectorAll(GOLD)].find((g) => !g.closest(KEEP) && (phone || !g.closest(KEEP_DESK)) && g.closest('.m-frame, .mp-frame'));
  if (!gold) return html;
  const frame = gold.closest('.m-frame, .mp-frame');
  // La rangée du bouton (ex. « Tout récupérer » et « Voir », « ×1 » et « ×10 ») part avec lui si elle ne contient que des boutons.
  let group = gold;
  const row = gold.parentElement;
  if (row && row !== frame && row.children.length <= 3 && [...row.children].every((c) => c.matches(BTN)) && !row.matches('.m-card, .mp-frame, .m-frame')) group = row;
  const dock = document.createElement('div');
  dock.className = 'gold-dock';
  dock.appendChild(group);
  frame.appendChild(dock);
  return tpl.innerHTML;
}

// Après le rendu : le cadre qui porte un pied doré descend au moins jusqu'en bas de la fenêtre (le pied est alors en bas même
// quand le contenu est court). Hauteur posée en style, recalculée à chaque rendu (l'affichage du corps ne change pas).
export function fillDock(body) {
  if (!body) return;
  for (const frame of body.querySelectorAll(':is(.m-frame, .mp-frame):has(> .gold-dock)')) {
    const top = frame.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const pad = parseFloat(getComputedStyle(body).paddingBottom) || 0;
    const h = Math.floor(body.clientHeight - top - pad - 2);
    const v = h > 120 ? `${h}px` : '';
    if (frame.style.minHeight !== v) frame.style.minHeight = v;
  }
}
