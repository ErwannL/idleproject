// v9.3.7 : prologue « La chute du héros » — première connexion seulement, environ 70 s, une seule fois.
// Le héros, bien équipé, affronte seul le Colosse des Anciens ; à mi-vie, la Prêtresse et la Pyromancienne arrivent ;
// le Colosse entre en rage et balaie tout le monde ; le héros perd son équipement et ses compagnons.
// C'est une scène jouée à part : RIEN n'est pris à la partie (le joueur commence ensuite avec l'arme de départ, comme
// avant). Le joueur ne joue pas : un clic passe au dialogue suivant, « Passer » termine tout.
// Tout l'affichage est calculé à partir du temps `t` (état pur) : sauter un dialogue reste cohérent.
import { heroComposite } from '../render/pixel.js';
import { itemIconUrl } from '../render/pixel.js';
import { icon } from './common.js';
import { COMPANIONS } from '../data/companions.js';

export const PROLOGUE_HINT = 'prologue';
export const PROLOGUE_SECONDS = 70;

// Dialogues : [début (s), texte]. Un clic saute au suivant.
export const PROLOGUE_LINES = [
  [0, 'Il y a longtemps, un héros affronta seul le Colosse des Anciens.'],
  [7, 'Son épée frappe… mais le Colosse ne sent presque rien.'],
  [16, 'Chaque coup du géant fait trembler la terre. Le héros faiblit.'],
  [24, 'La Prêtresse et la Pyromancienne accourent à son secours !'],
  [32, 'Ensemble, ils font enfin plier le géant.'],
  [40, 'Le Colosse entre en rage.'],
  [46, 'Son regard brûlant balaie tout sur son passage.'],
  [55, 'Ton équipement s\'est brisé.'],
  [59, 'Tes compagnons ont disparu.'],
  [63, 'Mais tu es vivant.'],
  [66, 'Reprends tout. Reviens plus fort.'],
];
// Moments clés de la scène.
const ALLIES_AT = 25, RAGE_AT = 40, FALL = [47, 49.5, 52], BLACK_AT = 54.5;
const GEAR = { weapon: { baseId: 'greatsword', rarity: 'epic' }, helmet: { baseId: 'iron_helm', rarity: 'epic' }, armor: { baseId: 'chainmail', rarity: 'legendary' } };
const GEAR_ICONS = [{ baseId: 'greatsword', rarity: 'epic', slot: 'weapon' }, { baseId: 'chainmail', rarity: 'legendary', slot: 'armor' }, { baseId: 'band_ring_ruby', rarity: 'epic', slot: 'ring' }];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * clamp(k);

// État de la scène à l'instant t (secondes).
export function prologueState(t) {
  const heroHp = t < 10 ? 100 : t < ALLIES_AT ? lerp(100, 48, (t - 10) / (ALLIES_AT - 10)) : t < RAGE_AT ? lerp(48, 70, (t - ALLIES_AT) / 10) : t < FALL[2] ? lerp(70, 25, (t - RAGE_AT) / 12) : 0;
  const bossHp = t < ALLIES_AT ? lerp(100, 97, t / ALLIES_AT) : t < RAGE_AT ? lerp(97, 68, (t - ALLIES_AT) / 14) : 68;
  const dialog = PROLOGUE_LINES.filter(([at]) => at <= t).length - 1;
  return {
    t, heroHp, bossHp, dialog,
    allies: t >= ALLIES_AT ? clamp((t - ALLIES_AT) / 1.5) : 0, // arrivée (glissé depuis la gauche)
    rage: t >= RAGE_AT,
    fallen: FALL.map((f) => t >= f), // Prêtresse, Pyromancienne, héros
    black: t >= BLACK_AT ? clamp((t - BLACK_AT) / 1.2) : 0,
    gearBreak: t >= 55, alliesGone: t >= 59, done: t >= PROLOGUE_SECONDS,
    bossAnim: t >= FALL[0] - 1.5 && t < BLACK_AT ? 'beam' : t >= RAGE_AT && t < RAGE_AT + 3 ? 'transform' : t >= RAGE_AT ? 'fury'
      : Math.floor(t / 3) % 3 === 2 && t > 9 ? 'throw' : 'idle',
    shake: (t > 10 && t < ALLIES_AT && Math.floor(t / 3) % 3 === 2 && t % 3 > 2.4) || (t >= RAGE_AT && t < RAGE_AT + 1.5) || FALL.some((f) => t >= f && t < f + 0.4),
  };
}

const SHEETS = { idle: ['colossus_idle', 9], throw: ['colossus_throw', 13], transform: ['colossus_transform', 13], fury: ['colossus_fury', 9], beam: ['colossus_beam', 13] };

export function playPrologue({ reduced = false, onDone = () => {} } = {}) {
  if (typeof document === 'undefined') { onDone(); return null; }
  const priestess = COMPANIONS.find((c) => c.id === 'priestess');
  const pyro = COMPANIONS.find((c) => c.id === 'pyromancer');
  const el = document.createElement('div');
  el.id = 'prologue';
  el.className = `prologue${reduced ? ' reduced' : ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Prologue');
  el.innerHTML = `<div class="pro-stage">
      <div class="pro-boss"><div class="pro-boss-art"></div><div class="pro-bar boss"><i></i></div><b class="pro-name">Colosse des Anciens</b></div>
      <div class="pro-team">
        <div class="pro-ally priestess"><img class="px" src="${icon(priestess.sprite, 2)}" alt=""></div>
        <div class="pro-ally pyro"><img class="px" src="${icon(pyro.sprite, 2)}" alt=""></div>
        <div class="pro-hero"><canvas width="1" height="1"></canvas><div class="pro-bar hero"><i></i></div></div>
      </div>
      <div class="pro-ground"></div>
      <div class="pro-rage">LE COLOSSE ENTRE EN RAGE</div>
      <div class="pro-hits"></div>
      <div class="pro-black"><div class="pro-loss">${GEAR_ICONS.map((g) => `<img class="px pro-gear" src="${itemIconUrl(g)}" alt="">`).join('')}
        <img class="px pro-gone" src="${icon(priestess.sprite, 2)}" alt=""><img class="px pro-gone" src="${icon(pyro.sprite, 2)}" alt=""></div></div>
    </div>
    <div class="pro-dialog" aria-live="polite"><p></p><small>Touche pour continuer</small></div>
    <button class="btn small pro-skip" type="button">Passer ⏭</button>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const canvas = q('.pro-hero canvas');
  const ctx = canvas.getContext('2d');
  let t = 0, last = performance.now(), raf = 0, finished = false, shownDialog = -1, lastHit = -1;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    el.classList.add('out');
    setTimeout(() => el.remove(), 500);
    onDone();
  };
  q('.pro-skip').addEventListener('click', (e) => { e.stopPropagation(); finish(); });
  // Un clic : dialogue suivant (le temps saute au début du dialogue suivant).
  el.addEventListener('click', () => {
    const next = PROLOGUE_LINES.find(([at]) => at > t + 0.05);
    if (next) t = next[0]; else finish();
  });
  const hit = (text, cls, left) => {
    const h = document.createElement('span');
    h.className = ['pro-hit', cls].join(' ');
    h.textContent = text;
    h.style.left = left;
    q('.pro-hits').appendChild(h);
    setTimeout(() => h.remove(), 800);
  };
  const frame = (now) => {
    t += Math.min(0.1, (now - last) / 1000);
    last = now;
    const s = prologueState(t);
    if (s.done) { finish(); return; }
    // Héros : vrai rendu du jeu, équipement épique ; frappe en boucle, coup reçu quand le Colosse lance.
    const heroFrame = s.fallen[2] ? 'hurt' : s.shake ? 'hurt' : Math.floor(t * 2.5) % 2 ? 'attack1' : 'idle';
    let img = null;
    try { img = heroComposite(heroFrame, GEAR, s.shake, ['a', 'b', 'c', 'd'][Math.floor(t * 6) % 4]); } catch { img = null; }
    if (img) {
      if (canvas.width !== img.width || canvas.height !== img.height) { canvas.width = img.width; canvas.height = img.height; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    }
    q('.pro-bar.hero i').style.width = `${s.heroHp}%`;
    q('.pro-bar.boss i').style.width = `${s.bossHp}%`;
    q('.pro-hero').classList.toggle('down', s.fallen[2]);
    q('.pro-ally.priestess').classList.toggle('down', s.fallen[0]);
    q('.pro-ally.pyro').classList.toggle('down', s.fallen[1]);
    el.style.setProperty('--arrive', String(s.allies));
    el.classList.toggle('no-allies', s.allies <= 0);
    el.classList.toggle('rage', s.rage);
    el.classList.toggle('shake', s.shake && !reduced);
    const [sheet, n] = SHEETS[s.bossAnim];
    const art = q('.pro-boss-art');
    art.style.backgroundImage = `url('assets/world-boss/${sheet}.png')`;
    art.style.setProperty('--frames', String(n));
    art.style.backgroundPositionX = `${((Math.floor(t * 8) % n) / (n - 1)) * 100}%`; // image i sur n (0 % … 100 %)
    q('.pro-black').style.opacity = String(s.black);
    el.classList.toggle('gear-break', s.gearBreak);
    el.classList.toggle('allies-gone', s.alliesGone);
    // Petits chiffres de coups (un par demi-seconde) tant que tout le monde est debout.
    const tick = Math.floor(t * 2);
    if (tick !== lastHit && t > 4 && t < FALL[2] && !reduced) {
      lastHit = tick;
      if (t < ALLIES_AT) hit(String(12 + (tick % 5)), 'weak', '62%');
      else if (t < RAGE_AT) hit(tick % 2 ? String(480 + (tick % 7) * 13) : '+150', tick % 2 ? 'strong' : 'heal', tick % 2 ? '60%' : '22%');
    }
    if (s.dialog !== shownDialog && s.dialog >= 0) {
      shownDialog = s.dialog;
      q('.pro-dialog p').textContent = PROLOGUE_LINES[s.dialog][1];
      q('.pro-dialog').classList.remove('pop');
      void q('.pro-dialog').offsetWidth;
      q('.pro-dialog').classList.add('pop');
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { finish, el };
}
