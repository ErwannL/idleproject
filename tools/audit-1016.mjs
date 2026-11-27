// v10.16 (B9) : deux contrôles communs à tools/desk-audit.mjs (11, 12) et tools/mobile-audit.mjs (16, 17), installés dans
// la page par page.addInitScript(audit1016Init) puis appelés par inPage : window.__audit1016(racines, shown) → [{ check, msg }].
//   'abbr' : aucun libellé court (bouton, onglet, puce, nom) terminé par un point d'abréviation (« Amélio. », « Équip. »).
//   'why'  : chaque bouton désactivé visible a un texte d'explication (.why-off, .cost-missing, .m-note, [role=note], .bad…)
//            juste à côté (même parent ou grand-parent), ou dit lui-même pourquoi (« 🔒 S'ouvre… », « Il manque… »).
export function audit1016Init() {
  window.__audit1016 = (roots, shown) => {
    const out = [];
    const seen = new Set();
    const push = (check, msg) => { if (!seen.has(msg)) { seen.add(msg); out.push({ check, msg }); } };
    const name = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
    const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    // Un mot de 2 à 7 lettres suivi d'un point, en fin de libellé court (3 mots au plus) : une abréviation.
    const ABBR = /(?:^|[\s(«'’])\p{L}{2,7}\.$/u;
    const LABELS = 'button, [role="tab"], [role="button"], .subtab, .sub-long, .sub-short, .m-chip, .m-mode, .mp-name, .lbl-txt, .tab-label, #tabs span, .bt-name, .bc-name, .m-fg-tier-t b, label > b, small, b, span';
    for (const r of roots) {
      for (const el of r.querySelectorAll(LABELS)) {
        const t = ownText(el);
        if (!t || t.length > 24 || t.split(' ').length > 3 || !ABBR.test(t) || !shown(el)) continue;
        push('abbr', `${name(el)} « ${t} » se termine par un point d'abréviation`);
      }
    }
    const NOTE = '.why-off, .cost-missing, .m-note, [role="note"], .bad, .state-error, .lock-why, .fg-now, .mp-lock';
    const SAYS = /🔒|S'ouvre|Il (te )?manque|Bientôt|plein|Aucun|Rien|Déjà|max|Max|Prochain|demain|✓|Récupéré|Équipé|Accompli|indisponible|verrouill/i;
    const hasNote = (box, b) => box && [...box.querySelectorAll(NOTE)].some((n) => n !== b && !n.contains(b) && (n.textContent ?? '').trim() && getComputedStyle(n).display !== 'none'); // présente juste à côté (même si un défilement la cache encore)
    for (const r of roots) {
      for (const b of r.querySelectorAll('button:disabled, button[aria-disabled="true"], [role="button"][aria-disabled="true"]')) {
        if (!shown(b) || b.closest('#tabs') || b.closest('.m-chips, .mp-chips')) continue;
        if (b.matches('.map-dot, .lt-node, .fg-slot, .m-tile, .mp-step, .stage-grid button, .world-picker .m-btn, .fw-prize-c')) continue; // cases graphiques (carte, arbre, places, gros lot) : le cadenas ou la ligne au-dessus dit l'état (comme src/ui/why-off.js)
        const own = (b.textContent ?? '').replace(/\s+/g, ' ').trim();
        const desc = b.getAttribute('aria-describedby') && document.getElementById(b.getAttribute('aria-describedby'))?.textContent?.trim();
        // v10.18 (3.5) : comme src/ui/why-off.js — une explication dans la carte .m-card, ou juste au-dessus (frères précédents), compte aussi.
        const before = (el) => { for (let s = el?.previousElementSibling, k = 0; s && k < 3; s = s.previousElementSibling, k++) { const t = (s.textContent ?? '').trim(); if (t && (s.matches(NOTE) || s.querySelector(NOTE) || SAYS.test(t))) return true; } return false; };
        if (desc || SAYS.test(own) || hasNote(b.parentElement, b) || hasNote(b.parentElement?.parentElement, b) || hasNote(b.closest('.m-card'), b) || before(b) || before(b.parentElement) || before(b.parentElement?.parentElement)) continue;
        push('why', `${name(b)} « ${own.slice(0, 30)} » désactivé sans explication`);
      }
    }
    return out;
  };
}
