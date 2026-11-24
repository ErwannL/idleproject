// v10.4 (partie 6) : la tour du Bastion, dessinée sur la scène près du Sceau. Visible dès que le Bastion est ouvert
// (étape 40) ; une pastille quand un chantier est fini, une commande prête, un stock plein ou qu'un ouvrier manque ;
// un toucher ouvre le Bastion. Elle se pose au-dessus du Sceau, à droite, sans couvrir la barre de compétences, le
// Sceau ni le coffre de butin : on essaie quelques places, la première qui ne touche rien gagne.
import { bastionOf } from '../core/bastion.js';
import { bastionBadge } from './panels/camp.js';

const AVOID = ['combat-console', 'next-action', 'hud', 'progress', 'news', 'strip-bar', 'skill-bar', 'loot-bag', 'zone-card', 'quest-banner', 'goals-pill', 'auto-toggle', 'speed-toggle', 'boost-group', 'rift-chip', 'weak-spot', 'scene-bottom'];
const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

let last = 0;
export function updateBastionTower(ui, state) {
  const el = ui.$('bastion-tower');
  if (!el) return;
  const show = Boolean(bastionOf(state)) && ui.layout !== 'strip';
  el.classList.toggle('hidden', !show);
  if (!show) return;
  const now = performance.now();
  if (now - last < 500) return; // deux fois par seconde suffit
  last = now;
  const n = bastionBadge(state);
  const dot = el.querySelector('.bt-dot');
  if (dot) { dot.classList.toggle('hidden', !n); const t = n ? String(n) : ''; if (dot.textContent !== t) dot.textContent = t; }
  el.setAttribute('aria-label', n ? `Bastion : ${n} à voir` : 'Bastion');
  place(ui, el);
}

function place(ui, el) {
  const area = ui.$('stage-area');
  if (!area) return;
  const A = area.getBoundingClientRect();
  if (!A.width || !A.height) return;
  const w = el.offsetWidth || 64, h = el.offsetHeight || 76;
  const blocks = AVOID.map((id) => document.getElementById(id)).filter((x) => x && x.offsetParent !== null && !x.classList.contains('hidden'))
    .map((x) => x.getBoundingClientRect()).filter((r) => r.width && r.height);
  const seal = document.getElementById('next-action');
  const S = seal && seal.offsetParent !== null && !seal.classList.contains('hidden') ? seal.getBoundingClientRect() : null;
  // Places candidates (coin haut gauche, coordonnées dans la scène) : au-dessus du Sceau à droite, puis en remontant.
  const base = S ? S.top - A.top : A.height - 90;
  const cands = [];
  // D'abord juste à droite du Sceau, puis juste au-dessus de lui.
  if (S) { cands.push([S.right - A.left + 12, S.top - A.top + S.height / 2 - h / 2], [S.left - A.left, S.top - A.top - h - 8], [S.right - A.left - w, S.top - A.top - h - 8]); }
  for (const dy of [h + 8, h + 60, h + 112, h + 164, h + 216]) for (const x of [A.width - w - 10, A.width - w - 70, A.width - w - 130, 10]) cands.push([x, base - dy]);
  const pick = cands.find(([x, y]) => {
    if (y < 4 || x < 4 || x + w > A.width - 4 || y + h > A.height - 2) return false;
    const r = { left: A.left + x - 4, right: A.left + x + w + 4, top: A.top + y - 4, bottom: A.top + y + h + 4 };
    return !blocks.some((b) => hit(r, b));
  }) ?? cands[0];
  const left = `${Math.round(pick[0])}px`, top = `${Math.round(Math.max(4, pick[1]))}px`;
  if (el.style.left !== left) el.style.left = left;
  if (el.style.top !== top) el.style.top = top;
}
