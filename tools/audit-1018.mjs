// v10.18 (parties 2.6 et 3.5) : contrôles communs à tools/mobile-audit.mjs et tools/desk-audit.mjs, posés dans la page
// par addInitScript (comme tools/audit-1016.mjs) :
//   window.__touchCover(roots)    aucun bouton recouvert par un autre au point de contact (elementFromPoint au centre)
//   window.__genericWhy(roots)    aucun texte générique « Pas disponible pour l'instant » affiché
//   window.__subtabsUnderClose()  aucun sous-onglet (partie visible) sous la croix ✕ du panneau
//   window.__hudOverlap()         écran de combat : aucun bloc de #stage-area / #combat-console n'en chevauche un autre
// Chaque fonction renvoie une liste de messages (vide = rien à signaler).
export const GENERIC_WHY = "Pas disponible pour l'instant";

export function audit1018Init() {
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} « ${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)} »`;
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false; }
    return true;
  };
  // Rectangle visible : coupé par les ancêtres qui masquent leur débordement (liste qui défile, rangée d'onglets).
  const clipRect = (el) => {
    const r = el.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, b = r.bottom;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const p = n.getBoundingClientRect();
      l = Math.max(l, p.left); t = Math.max(t, p.top); rr = Math.min(rr, p.right); b = Math.min(b, p.bottom);
    }
    return { left: l, top: t, right: Math.min(rr, innerWidth), bottom: Math.min(b, innerHeight), width: Math.min(rr, innerWidth) - l, height: Math.min(b, innerHeight) - t };
  };
  const BTN = 'button, [role="button"], a.btn';
  // Les pieds et en-têtes collants recouvrent volontairement la liste qui défile dessous : un bouton de la liste caché par eux n'est pas « recouvert ».
  const STICKY = '.gold-dock, .m-sheet-head, #panel > header, #panel-subtabs, .m-title, #tabs';

  window.__touchCover = (roots) => {
    const out = [];
    const seen = new Set();
    for (const root of roots) for (const b of root.querySelectorAll(BTN)) {
      if (seen.has(b) || b.parentElement?.closest(BTN) || !shown(b)) continue;
      seen.add(b);
      const c = clipRect(b);
      if (c.width < 8 || c.height < 8) continue; // défilé hors de sa liste
      const x = c.left + c.width / 2, y = c.top + c.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === b || b.contains(hit) || hit.contains(b)) continue;
      if (hit.closest(STICKY) && !b.closest(STICKY)) continue;
      // Une fiche ou une fenêtre ouverte par-dessus (Nouvel âge, fiche d'objet…) couvre volontairement ce qui est dessous.
      const sheet = hit.closest('.m-sheet, [role="dialog"], #modal, .unit-pop');
      if (sheet && !sheet.contains(b)) continue;
      const over = hit.closest(BTN) ?? hit;
      // Copie identique du même bouton (ancien rendu qui s'efface pendant le changement d'onglet) : ce n'est pas un autre bouton.
      if (over !== b && over.outerHTML === b.outerHTML) continue;
      out.push(`${name(b)} recouvert par ${name(over)} au point (${Math.round(x)}, ${Math.round(y)})`);
    }
    return out;
  };

  window.__genericWhy = (roots) => {
    const out = [];
    for (const root of roots) for (const el of root.querySelectorAll('*')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes("Pas disponible pour l'instant"))) continue;
      if (shown(el)) out.push(`${name(el)} : texte générique « Pas disponible pour l'instant »${el.previousElementSibling ? ` (après ${name(el.previousElementSibling)})` : ''}`);
    }
    return out;
  };

  window.__subtabsUnderClose = () => {
    const out = [];
    const close = document.querySelector('#panel-close');
    if (!close || !shown(close)) return out;
    const k = close.getBoundingClientRect();
    for (const s of document.querySelectorAll('#panel-subtabs .subtab')) {
      if (!shown(s)) continue;
      const c = clipRect(s);
      if (c.width < 2 || c.height < 2) continue;
      const ox = Math.min(c.right, k.right) - Math.max(c.left, k.left), oy = Math.min(c.bottom, k.bottom) - Math.max(c.top, k.top);
      if (ox > 0.5 && oy > 0.5) out.push(`${name(s)} : ${Math.round(ox)} px sous la croix ✕`);
      const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      if (c.width > 12 && hit && hit !== s && !s.contains(hit) && !hit.closest('.m-sheet, [role="dialog"], #modal, .unit-pop')) out.push(`${name(s)} recouvert par ${name(hit)}`);
    }
    const act = document.querySelector('#panel-subtabs .subtab.active');
    if (act && shown(act)) { const c = clipRect(act), r = act.getBoundingClientRect(); if (c.width < r.width - 1) out.push(`onglet allumé ${name(act)} pas entièrement visible (${Math.round(c.width)}/${Math.round(r.width)} px)`); }
    return out;
  };

  window.__hudOverlap = () => {
    const out = [];
    const SEL = '#zone-card, #hq-path, #hq-carnet, #hq-events, #hq-bounty, #goals-pill, #auto-toggle, #next-action, #loot-bag, #boost-group, #scene-bottom, #skill-bar > *, #combat-console button, #stage-area > button';
    const cand = [...document.querySelectorAll(SEL)].filter((el) => shown(el) && el.closest('#stage-area, #combat-console'));
    const top = cand.filter((el) => !cand.some((o) => o !== el && o.contains(el)));
    for (let i = 0; i < top.length; i++) {
      const a = top[i].getBoundingClientRect();
      for (let j = i + 1; j < top.length; j++) {
        const b = top[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) out.push(`${name(top[i])} et ${name(top[j])} se chevauchent (${Math.round(ox)}×${Math.round(oy)} px)`);
      }
    }
    return out;
  };
}
