// v9.1.9 : alerte d'arrivée de boss (mini, boss, redoutable, méga, donjon, Tour) — bandeau rouge « ⚠ BOSS » /
// « ⚠ DANGER » + nom, léger assombrissement de la scène, 1,5 à 2 s. Couche UI seulement : le bandeau est posé sur la
// scène (#stage-area) sans capter les clics (pointer-events: none), les boutons restent visibles et utilisables.
// Version sobre (fondu, sans clignotement) si « réduire les animations » ; version courte si le même boss revient
// en boucle (retenté ou farmé) ; une seule alerte par arrivée.

export const LOOP_WINDOW_MS = 90000; // même boss revu en moins de 90 s : boucle → version courte
export const WARNING_MS = { full: 1800, short: 900 };

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
    ms: loop ? WARNING_MS.short : WARNING_MS.full,
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
  el.innerHTML = `<div class="bw-shade"></div><div class="bw-band"><b class="bw-head">${plan.head}</b>
    <span class="bw-sub">${plan.sub}</span><span class="bw-name"></span></div>`;
  el.querySelector('.bw-name').textContent = plan.name;
  host.appendChild(el);
  if (!plan.calm && !plan.short) {
    host.classList.remove('bw-shake'); void host.offsetWidth; host.classList.add('bw-shake');
  }
  try { if (plan.vibrate) navigator.vibrate?.(60); } catch { /* sans vibreur */ }
  timer = setTimeout(() => { el.remove(); host.classList.remove('bw-shake'); }, plan.ms);
}
