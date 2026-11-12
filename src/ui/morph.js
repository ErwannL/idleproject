// v9.3.9 (2.5) : mise à jour « sur place » d'un panneau. Au lieu de remplacer tout le HTML (la fiche ouverte disparaît,
// rejoue son animation d'entrée et tout bouge sous le doigt), on garde les nœuds existants et on ne change que ce qui
// diffère : textes, attributs, enfants ajoutés ou retirés. Les éléments gardent leur état (animation finie, défilement).

const tpl = typeof document !== 'undefined' ? document.createElement('template') : null;

function sameKind(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.tagName !== b.tagName) return false;
  // Deux éléments distincts (autre id ou autre clé) ne se fondent pas l'un dans l'autre.
  if ((a.id || '') !== (b.id || '')) return false;
  const ka = a.getAttribute('data-key') ?? a.getAttribute('data-value');
  const kb = b.getAttribute('data-key') ?? b.getAttribute('data-value');
  return ka === kb;
}

function syncAttrs(from, to) {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  // Propriétés vivantes des champs (valeur tapée, case cochée, bouton activé).
  if (from.tagName === 'INPUT' || from.tagName === 'SELECT' || from.tagName === 'TEXTAREA') {
    if ('checked' in to && from.checked !== to.checked) from.checked = to.checked;
  }
  if ('disabled' in to && from.disabled !== to.disabled) from.disabled = to.disabled;
}

function morphNode(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  // Une image ou un canvas dont la source change est remplacé (pas de décodage en double ni d'état périmé).
  if (from.tagName === 'CANVAS') return;
  syncAttrs(from, to);
  morphChildren(from, to);
}

function morphChildren(from, to) {
  const next = [...to.childNodes];
  let cur = from.firstChild;
  for (const want of next) {
    // Cherche un peu plus loin un nœud compatible (insertion ou retrait au milieu d'une liste).
    let match = null;
    for (let n = cur, i = 0; n && i < 6; n = n.nextSibling, i++) if (sameKind(n, want)) { match = n; break; }
    if (match) {
      while (cur && cur !== match) { const dead = cur; cur = cur.nextSibling; dead.remove(); }
      morphNode(match, want);
      cur = match.nextSibling;
    } else {
      from.insertBefore(want, cur);
    }
  }
  while (cur) { const dead = cur; cur = cur.nextSibling; dead.remove(); }
}

// Remplace le contenu de `host` par `html`, en réutilisant les nœuds déjà là.
export function morph(host, html) {
  if (!tpl) { host.innerHTML = html; return; }
  tpl.innerHTML = html;
  morphChildren(host, tpl.content);
}
