// Cinématiques (v8.1) : bandes noires façon film, titre qui s'écrit, phrase d'ambiance, sur la scène du jeu.
// Au lancement du jeu (« Bon retour ») et à l'arrivée dans un nouveau monde. Un clic passe.
import { ZONE_INTRO } from '../data/lore.js';

let current = null;

// v10.16 : `light` : sans bandes noires ni assombrissement (« Moment fort », passé par la file d'annonces).
export function playCinematic({ kicker = '', title, line = '', zone = null, duration = 4200, light = false }) {
  const host = document.getElementById('stage-area');
  if (!host || document.querySelector('#app.layout-strip')) return;
  current?.remove();
  const el = document.createElement('div');
  el.className = `cinematic${zone ? ` zone-${zone}` : ''}${light ? ' light' : ''}`;
  el.innerHTML = `${light ? '' : '<i class="cine-bar top"></i><i class="cine-bar bottom"></i>'}
    <div class="cine-text">${kicker ? `<small>${kicker}</small>` : ''}<h1></h1><p>${line}</p></div>`;
  if (light) el.style.background = 'none';
  host.appendChild(el);
  current = el;
  const h1 = el.querySelector('h1');
  // Titre « tapé » lettre par lettre.
  let i = 0;
  const type = setInterval(() => {
    i += 1;
    h1.textContent = title.slice(0, i);
    if (i >= title.length) clearInterval(type);
  }, Math.max(25, Math.min(70, 900 / title.length)));
  const end = () => {
    clearInterval(type);
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
    if (current === el) current = null;
  };
  const timer = setTimeout(end, duration);
  el.addEventListener('click', () => { clearTimeout(timer); end(); });
  requestAnimationFrame(() => el.classList.add('in'));
}

// v10.16 : arrête la cinématique en cours (une annonce urgente passe devant, une fenêtre s'ouvre).
export function stopCinematic() {
  const el = current;
  if (!el) return;
  current = null;
  el.classList.add('out');
  setTimeout(() => el.remove(), 600);
}

// v8.9 : transition entre deux lieux (monde, donjon, tour, défi…) : des nuages arrivent de la gauche et de la
// droite, couvrent la scène, puis se lèvent pour laisser place aux bandes noires et au titre du lieu.
export function playTransition(opts) {
  const host = document.getElementById('stage-area');
  if (!host || document.querySelector('#app.layout-strip')) return;
  host.querySelector('.cloud-transition')?.remove();
  const el = document.createElement('div');
  // v9.2.0 (monde marin) : vers le Royaume englouti, une vague d'eau bleue chargée de bulles remplace les nuages.
  const water = opts.zone === 'ocean';
  el.className = `cloud-transition${water ? ' water' : ''}`;
  el.innerHTML = `<i class="cloud-bank left"></i><i class="cloud-bank right"></i>${water ? '<i class="sea-bubbles"></i>' : ''}`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('closing'));
  setTimeout(() => {
    el.classList.add('lifting');
    playCinematic(opts);
  }, 750);
  setTimeout(() => el.remove(), 1800);
}

export function worldCinematic(zone, cycleLabel = '') {
  playTransition({ kicker: `Nouveau monde${cycleLabel}`, title: zone.name, line: ZONE_INTRO[zone.id] ?? '', zone: zone.id });
}
