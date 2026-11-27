// v10.17 (D) : contrôle commun à tools/desk-audit.mjs et tools/mobile-audit.mjs, installé dans la page par
// page.addInitScript(audit1017Init) puis appelé par inPage : window.__btnStyles(racines, shown) → { 'style': 'exemple' }.
// Un « style » de bouton = la combinaison fond / bordure / arrondi / taille de texte (couleur du fond ou dégradé, épaisseur et
// couleur de la bordure, rayon, corps du texte). On compte les vrais boutons à texte, PAS : les pastilles (.m-chip, puces),
// les icônes (bouton sans texte, ou rond/carré de moins de 60 px avec 2 caractères au plus), les onglets et modes
// ([role=tab], .m-mode, .subtab, #tabs, et les bascules choisies .on / .sel / [aria-pressed]), les mots du lexique (.lex), les cases de carte ou de grille (bouton qui contient une image de plus de 30 px),
// les boutons d'objets du jeu (cases, nœuds, places). Les deux outils additionnent les styles de tous les écrans
// contrôlés et échouent au-delà de 4 (principal doré, secondaire, discret, danger).
export const BTN_EXCLUDE = '.on, .sel, .active, [aria-pressed="true"], .lex, [role="tab"], .m-mode, .m-chip, .mp-chips *, .m-chips *, .subtab, #tabs *, #panel-subtabs *, .map-dot, .lt-node, .fg-slot, .m-tile, .mp-step, .stage-grid *, .bs-plot, .mp-tbar, .m-tnode, .mr-tier, .hq-ev, .skill-btn, .rush-btn, .boost-chip, .chip-btn, .chip, .pill, .m-pill, .tag, [class*="-chip"], [class*="-pill"], [class*="-tile"], [class*="-cell"], [class*="-slot"], [class*="-card"], [class*="-node"], [class*="-dot"], [class*="-tab"], [class*="-x"], .m-close, .m-back, .m-help, .close, [data-action="close-modal"], [data-action="m-help"]';
export const MAX_BTN_STYLES = 4;

export function audit1017Init() {
  window.__btnStyles = (roots, shown, exclude) => {
    const out = {};
    const px = (v) => Math.round(parseFloat(v) || 0);
    for (const r of roots) {
      for (const b of r.querySelectorAll('button, [role="button"], a.btn, .btn')) {
        if (!shown(b) || b.matches(exclude) || b.closest('.m-chips, .mp-chips, #panel-subtabs, #tabs, svg')) continue;
        const text = (b.textContent ?? '').replace(/\s+/g, ' ').trim();
        const rect = b.getBoundingClientRect();
        if (!/\p{L}{2}/u.test(text)) continue; // icône
        if ([...b.querySelectorAll('img, canvas, .px')].some((i) => i.getBoundingClientRect().height > 30)) continue; // case avec image
        if (rect.width < 60 && rect.height < 60 && text.length <= 2) continue;
        const cs = getComputedStyle(b);
        const bg = cs.backgroundImage !== 'none' ? cs.backgroundImage.replace(/\s+/g, ' ').slice(0, 80) : cs.backgroundColor;
        const key = `fond ${bg} | bord ${px(cs.borderTopWidth)}px ${cs.borderTopStyle === 'none' ? 'none' : cs.borderTopColor} | arrondi ${px(cs.borderTopLeftRadius)} | texte ${px(cs.fontSize)}`;
        if (!out[key]) out[key] = `${b.tagName.toLowerCase()}.${String(b.className).trim().split(/\s+/).slice(0, 2).join('.')} « ${text.slice(0, 24)} »`;
      }
    }
    return out;
  };
  // v10.17.1 (6) : le bouton doré principal visible est en bas du cadre : son centre est dans le dernier quart de la zone visible
  // du cadre (clip : rectangle visible de la fenêtre ; une fiche .m-sheet ou une modale compte comme cadre), ou il est épinglé en
  // bas (position sticky ou fixed, sur lui ou un parent, et posé dans le dernier quart). Renvoie la liste des défauts (texte).
  window.__goldLow = (golds, clip) => {
    const out = [];
    for (const g of golds) {
      const host = g.closest('.m-sheet, #modal:not(.hidden) .modal-box, #modal:not(.hidden) [role="dialog"]');
      const c = host ? host.getBoundingClientRect() : clip;
      const top = Math.max(c.top, clip.top), bottom = Math.min(c.bottom, clip.bottom), h = bottom - top;
      if (h < 80) continue;
      if (g.closest('[data-gold-top]')) continue; // v10.19 (3.5) : « ⬆ Équiper le meilleur (N) » est voulu au-dessus du Sac (Équipement, téléphone)
      const r = g.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      let pinned = false;
      for (let n = g; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'sticky' || p === 'fixed') { pinned = true; break; } }
      if (pinned && r.bottom >= bottom - h * 0.25) continue;
      if (mid >= top + h * 0.75 - 1) continue;
      const t = (g.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28);
      out.push(`bouton doré « ${t} » au milieu du cadre (centre à ${Math.round(((mid - top) / h) * 100)} % de la hauteur visible, attendu ≥ 75 %)`);
    }
    return out;
  };
}
