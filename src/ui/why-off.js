// v10.16 (B5) : filet commun — après chaque rendu d'un écran, un bouton désactivé qui ne dit pas encore pourquoi reçoit,
// juste dessous, une courte raison (.why-off). Les écrans qui savent mieux (Invocation, Forge…) écrivent la leur avec
// whyOff() (common.js) ; ce filet ne fait que combler les oublis. Raison prise, dans l'ordre : data-why, title, sinon déduite.
const NOTE = '.why-off, .cost-missing, .m-note, [role="note"], .bad, .state-error, .lock-why, .fg-now, .mp-lock';
const SAYS = /🔒|S'ouvre|Il (te )?manque|Bientôt|plein|Aucun|Rien|Déjà|max|Prochain|demain|✓|Récupéré|Équipé|Accompli|indisponible|verrouill/i;

// Raison déduite du bouton (texte, classes) : pure, testée.
export function disabledReason({ text = '', cls = '', title = '', why = '' } = {}) {
  if (why) return why;
  if (title) return title;
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (/€/.test(t)) return 'Achats pas encore ouverts';
  if (/\bko\b/.test(cls) || /^[\d,.\s]+(K|M|B|T|Qa|Qi|Sx|Sp|Oc|No|Dc|×10\S*|[a-z]{2})?$/.test(t)) return 'Pas assez pour l\'acheter';
  if (/récupérer|Récupérer|Coffre/.test(t)) return 'Rien à récupérer pour l\'instant';
  if (/Apprendre|Améliorer|pt\b/.test(t)) return 'Pas assez de points pour l\'instant';
  return 'Pas disponible pour l\'instant';
}

export function explainDisabled(root) {
  if (!root?.querySelectorAll) return 0;
  let n = 0;
  const near = (box, b) => box && [...box.querySelectorAll(NOTE)].some((x) => x !== b && !x.contains(b) && (x.textContent ?? '').trim());
  for (const b of root.querySelectorAll('button:disabled, button[aria-disabled="true"]')) {
    if (b.closest('.m-chips, .mp-chips, #tabs') || b.dataset.whyDone) continue;
    if (b.matches('.map-dot, .lt-node, .fg-slot, .m-tile, .mp-step')) continue; // cases graphiques : le cadenas ou la case vide dit déjà l'état
    const text = b.textContent ?? '';
    if (SAYS.test(text) || near(b.parentElement, b) || near(b.parentElement?.parentElement, b)) continue;
    const s = document.createElement('small');
    s.className = 'why-off why-auto';
    s.setAttribute('role', 'note');
    s.textContent = disabledReason({ text, cls: b.className, title: b.getAttribute('title') ?? '', why: b.dataset.why ?? '' });
    b.dataset.whyDone = '1';
    b.after(s);
    n += 1;
  }
  return n;
}
