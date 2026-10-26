// Cinématiques (v8.1) : bandes noires façon film, titre qui s'écrit, phrase d'ambiance, sur la scène du jeu.
// Au lancement du jeu (« Bon retour ») et à l'arrivée dans un nouveau monde. Un clic passe.
import { ZONE_INTRO } from '../data/lore.js';

let current = null;

export function playCinematic({ kicker = '', title, line = '', zone = null, duration = 4200 }) {
  const host = document.getElementById('stage-area');
  if (!host || document.querySelector('#app.layout-strip')) return;
  current?.remove();
  const el = document.createElement('div');
  el.className = `cinematic${zone ? ` zone-${zone}` : ''}`;
  el.innerHTML = `<i class="cine-bar top"></i><i class="cine-bar bottom"></i>
    <div class="cine-text">${kicker ? `<small>${kicker}</small>` : ''}<h1></h1><p>${line}</p></div>`;
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

export function worldCinematic(zone, cycleLabel = '') {
  playCinematic({ kicker: `Nouveau monde${cycleLabel}`, title: zone.name, line: ZONE_INTRO[zone.id] ?? '', zone: zone.id });
}
