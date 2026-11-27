// v9.1.9 : alerte d'arrivée de boss (mini, boss, redoutable, méga, donjon, Tour) — bandeau rouge « ⚠ BOSS » /
// « ⚠ DANGER » + nom, léger assombrissement de la scène, 1,5 à 2 s. Couche UI seulement : le bandeau est posé sur la
// scène (#stage-area) sans capter les clics (pointer-events: none), les boutons restent visibles et utilisables.
// Version sobre (fondu, sans clignotement) si « réduire les animations » ; version courte si le même boss revient
// en boucle (retenté ou farmé) ; une seule alerte par arrivée.

export const LOOP_WINDOW_MS = 90000; // même boss revu en moins de 90 s : boucle → version courte
export const WARNING_MS = { full: 1800, short: 900 };
export const PHONE_WARNING_MS = 2000; // v10.18 (4.3) : sur téléphone, 2 s, sous les cartes du haut de la scène

const TIER_LABEL = { mini: 'Mini-boss', mid: 'Boss', hard: 'Boss redoutable', mega: 'MÉGA BOSS' };

// Décision pure (testée) : faut-il une alerte, laquelle, combien de temps ?
// memory : { [clé]: horodatage de la dernière alerte } (modifié) ; ctx : { tier, name, kind, mode, now, calm, fast, enemyId }.
export function bossWarningPlan(memory, ctx) {
  if (ctx.fast) return null; // ×100 et plus : aucune alerte
  if (memory.lastId != null && memory.lastId === ctx.enemyId) return null; // une fois par arrivée
  memory.lastId = ctx.enemyId;
  const key = `${ctx.mode ?? 'stage'}|${ctx.kind}`;
  const last = memory[key];
  memory[key] = ctx.now;
  const loop = last != null && ctx.now - last < LOOP_WINDOW_MS;
  const tier = TIER_LABEL[ctx.tier] ? ctx.tier : 'mega';
  const danger = tier === 'hard' || tier === 'mega';
  const where = ctx.mode === 'dungeon' ? 'Boss du donjon' : ctx.mode === 'tower' ? 'Boss de la Tour' : TIER_LABEL[tier];
  return {
    head: danger ? '⚠ DANGER' : '⚠ BOSS',
    sub: where,
    name: ctx.name,
    tier,
    short: loop,
    calm: Boolean(ctx.calm),
    ms: ctx.phone ? PHONE_WARNING_MS : loop ? WARNING_MS.short : WARNING_MS.full,
    phone: Boolean(ctx.phone),
    vibrate: !loop && !ctx.calm && danger,
  };
}

let timer = null;
export function showBossWarning(plan, host = document.getElementById('stage-area')) {
  if (!plan || !host) return;
  host.querySelector('.boss-warning')?.remove();
  clearTimeout(timer);
  const el = document.createElement('div');
  el.className = `boss-warning tier-${plan.tier}${plan.short ? ' short' : ''}${plan.calm ? ' calm' : ''}`;
  el.setAttribute('aria-hidden', 'true'); // l'annonce vocale passe par ui.announce()
  el.style.setProperty('--bw-ms', `${plan.ms}ms`);
  // v10.16 : plus d'assombrissement de la scène (bandeau seul) ; l'alerte passe par la file d'annonces (announce-queue.js).
  el.innerHTML = `<div class="bw-band"><b class="bw-head">${plan.head}</b>
    <span class="bw-sub">${plan.sub}</span><span class="bw-name"></span></div>`;
  el.querySelector('.bw-name').textContent = plan.name;
  host.appendChild(el);
  if (plan.phone) placeBelowTopCards(el, host);
  if (!plan.calm && !plan.short) {
    host.classList.remove('bw-shake'); void host.offsetWidth; host.classList.add('bw-shake');
  }
  try { if (plan.vibrate) navigator.vibrate?.(60); } catch { /* sans vibreur */ }
  timer = setTimeout(() => { el.remove(); host.classList.remove('bw-shake'); }, plan.ms);
}

// v10.18 (4.3) : sur téléphone, la carte de zone, les icônes d'événements et la carte d'objectif couvrent le haut de la
// scène : le bandeau se pose juste en dessous (dans la scène), au lieu de s'écrire par-dessus.
export function topCardsBottom(hostRect, rects) {
  let bottom = hostRect.top;
  const limit = hostRect.top + hostRect.height * 0.45; // seulement les cartes du haut de la scène
  for (const r of rects) {
    if (!r || r.width < 24 || r.height < 12 || r.height > hostRect.height * 0.5) continue;
    if (r.top < hostRect.top - 4 || r.top > limit || r.bottom <= hostRect.top) continue;
    if (r.right <= hostRect.left || r.left >= hostRect.right) continue;
    bottom = Math.max(bottom, r.bottom);
  }
  return Math.round(bottom - hostRect.top);
}
function placeBelowTopCards(el, host) {
  const hr = host.getBoundingClientRect();
  const rects = [];
  for (const c of host.querySelectorAll('*')) {
    if (c === el || el.contains(c) || c.tagName === 'CANVAS') continue;
    const cs = getComputedStyle(c);
    if (cs.position !== 'absolute' && cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    rects.push(c.getBoundingClientRect());
  }
  const top = topCardsBottom(hr, rects);
  if (top > 0) { el.style.top = `${top + 2}px`; el.style.bottom = 'auto'; el.classList.add('below-cards'); }
}
