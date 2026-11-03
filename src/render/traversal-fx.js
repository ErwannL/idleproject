// v9.2.1 : déplacement propre à chaque monde (données : src/data/traversal.js ; tableau : docs/deplacements-v921.md).
// Méthodes ajoutées au prototype de SceneRenderer (`this` = la scène), comme class-fx.js :
//   travLift(seed)        hauteur du personnage (sauts de nuage, lévitation, enfoncé dans le marais)
//   travWalk(seed, walking) image de pas (1..4) ou 0 = pose de repos (glissade, saut en l'air, lévitation)
//   travFeet(key, x, walking, seed, small) effets aux pieds (feuilles, éclats de cristal, sable, neige, brume,
//                         éclaboussures, nuages, braises, poussière d'étoiles, ombres) et traces au sol
//   drawTravGround(ctx, scroll) traces, nuages sous les pieds, surface du marais, brume de chaleur
// Tout est au pixel entier. « Réduire les animations » : hauteurs fixes, pas d'effet ni de trace.
import { traversalFor } from '../data/traversal.js';

const MAX_MARKS = 40;
const HOP = 0.62; // durée d'un saut de nuage en nuage (s)

export function installTraversalFx(proto) {
  Object.assign(proto, {
    setTraversal(zone) {
      const tr = traversalFor(zone?.id);
      if (tr !== this.trav) { this.trav = tr; this.travMarks = []; this.travTimers = new Map(); }
      this.travWalking = false;
    },

    travLift(seed = 0) {
      const tr = this.trav;
      if (!tr) return 0;
      if (tr.gait === 'hop') {
        // Debout sur son nuage (5 px) ; en avançant, bonds en cloche d'un nuage au suivant.
        if (this.focus || !this.travWalking) return 5;
        const f = ((this.time + seed * 0.21) / HOP) % 1;
        return 5 + Math.round(Math.sin(f * Math.PI) * 11);
      }
      if (tr.gait === 'float') return this.focus ? tr.lift : tr.lift + Math.round(Math.sin(this.time * 1.6 + seed) * 1.5);
      return tr.lift;
    },

    // Cadence et pose de pas : 1..4 = image de pas, 0 = repos.
    travWalk(seed, walking) {
      const tr = this.trav;
      if (!walking) return 0;
      const rate = tr?.rate ?? 1;
      if (!tr || tr.gait === 'walk') return 1 + (Math.floor(this.time * 9 * rate + seed * 2) % 4);
      if (tr.gait === 'slide') { const k = Math.floor(this.time * 7 + seed * 3) % 8; return k < 2 ? 1 + k * 2 : 0; } // 2 poussées, 6 temps de glisse
      if (tr.gait === 'hop') { const f = ((this.time + seed * 0.21) / HOP) % 1; return f < 0.12 || f > 0.88 ? 0 : 2; }
      return 0; // lévitation
    },

    travFeet(key, x, walking, seed = 0, small = false) {
      const tr = this.trav;
      if (!tr?.feet || tr.feet === 'dust' || this.focus) return;
      const G = this.groundY;
      const step = this.travWalk(seed, walking);
      const timers = this.travTimers ?? (this.travTimers = new Map());
      const prev = timers.get(key);
      timers.set(key, step);
      const plant = walking && step !== prev && (step === 1 || step === 3); // pied posé
      const c = tr.colors;
      const pick = () => c[Math.floor(Math.random() * c.length)];
      const n = small ? 1 : 2;
      const fx = (o) => this.effects.push(o);
      const every = (dt) => {
        const k = `${key}~`;
        const last = timers.get(k) ?? 0;
        if (this.time - last < dt) return false;
        timers.set(k, this.time);
        return true;
      };
      switch (tr.feet) {
        case 'leaves':
          if (plant) for (let i = 0; i < n + 1; i++) fx({ kind: 'particle', x: x - 3 + Math.random() * 6, y: G - 2, vx: -20 - Math.random() * 20, vy: -40 - Math.random() * 20, color: pick(), life: 0.6, max: 0.6, size: 2 });
          // Feuilles mortes qui tombent autour de l'équipe, même à l'arrêt (sous-bois sombre).
          if (every(walking ? 0.5 : 0.9)) fx({ kind: 'ember', x: x - 10 + Math.random() * 20, y: G - 40, vx: -6, vy: 22, color: pick(), life: 1.6, max: 1.6 });
          break;
        case 'glint':
          if (plant) {
            fx({ kind: 'sprite', frames: ['fx_spark'], x: x - 2, y: G + 2, life: 0.22, max: 0.22, delay: 0, tint: c[2], vx: 0 });
            for (let i = 0; i < n; i++) fx({ kind: 'ember', x: x - 4 + Math.random() * 8, y: G - 1, vx: (Math.random() - 0.5) * 16, vy: -14, color: pick(), life: 0.45, max: 0.45 });
          } else if (every(1.1)) fx({ kind: 'ember', x: x - 6 + Math.random() * 12, y: G - 1, vy: -6, color: pick(), life: 0.6, max: 0.6 }); // reflets du cristal au sol
          break;
        case 'sand':
          if (plant) {
            for (let i = 0; i < n + 1; i++) fx({ kind: 'puff', x: x - 2 + Math.random() * 4, y: G - 1, vx: -18 - Math.random() * 18, vy: -6 - Math.random() * 8, color: pick(), life: 0.55, max: 0.55 });
            this.travMark(x, 'print', tr.prints, 2.2);
          } else if (every(0.7)) fx({ kind: 'puff', x: x - 6 + Math.random() * 12, y: G - 1, vx: -14, vy: -2, color: pick(), life: 0.8, max: 0.8 }); // sable que le vent soulève
          break;
        case 'snow':
          if (walking && step === 0 && every(0.05)) fx({ kind: 'particle', x: x - 4, y: G - 1, vx: -30 - Math.random() * 20, vy: -20 - Math.random() * 15, color: pick(), life: 0.4, max: 0.4, size: 2 });
          if (walking && step === 0 && every(0.09)) this.travMark(x - 2, 'streak', tr.prints, 1.6);
          if (plant) this.travMark(x, 'print', tr.prints, 2);
          if (!walking && every(1)) fx({ kind: 'puff', x: x + 4, y: G - 30, vx: 8, vy: -3, color: '#ffffff', life: 0.7, max: 0.7 }); // souffle givré
          break;
        case 'mist':
          if (every(walking ? 0.12 : 0.3)) fx({ kind: 'puff', x: x - 6 + Math.random() * 12, y: G - 1, vx: walking ? -12 : (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 4, color: pick(), life: 1, max: 1 });
          break;
        case 'splash':
          if (plant) {
            for (let i = 0; i < n + 1; i++) fx({ kind: 'particle', x: x - 2 + Math.random() * 4, y: G - 6, vx: (Math.random() - 0.6) * 30, vy: -45 - Math.random() * 20, color: c[3 - (i % 2)], life: 0.45, max: 0.45, size: 1 });
            this.travMark(x, 'ripple', c[3], 0.8);
          } else if (every(walking ? 0.5 : 0.9 + (seed % 3) * 0.2)) this.travMark(x, 'ripple', c[3], 1.1);
          break;
        case 'cloud':
          // Un nuage se forme sous les pieds à chaque réception ; l'ancien reste en arrière (il défile avec le sol).
          if ((walking && step === 0 && prev === 2) || (!walking && every(0.8))) {
            this.travMark(x, 'cloud', c[0], walking ? 1.2 : 0.95, small ? 5 : 8);
            if (walking) for (let i = 0; i < n + 1; i++) fx({ kind: 'puff', x: x - 5 + Math.random() * 10, y: G - 2, vx: (Math.random() - 0.5) * 24, vy: -4, color: pick(), life: 0.5, max: 0.5 });
          }
          break;
        case 'ember':
          if (plant) {
            this.travMark(x, 'print', tr.prints, 1.4, 0, true);
            for (let i = 0; i < n + 1; i++) fx({ kind: 'ember', x: x - 3 + Math.random() * 6, y: G - 1, vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 16, color: c[i % 3], life: 0.7, max: 0.7 });
          } else if (every(0.6)) fx({ kind: 'ember', x: x - 4 + Math.random() * 8, y: G - 1, vy: -12, color: c[1], life: 0.6, max: 0.6 });
          break;
        case 'stars':
          if (every(walking ? 0.07 : 0.22)) fx({ kind: 'ember', x: x - 4 + Math.random() * 8, y: G - this.travLift(seed) + 1, vx: walking ? -26 : 0, vy: 6, color: pick(), life: 0.7, max: 0.7 });
          break;
        case 'shadow':
          if (plant) this.travMark(x, 'ripple', c[2], 0.9);
          if (every(walking ? 0.1 : 0.25)) fx({ kind: 'ember', x: x - 5 + Math.random() * 10, y: G - 1, vx: walking ? -10 : 0, vy: -10 - Math.random() * 10, color: Math.random() < 0.3 ? c[3] : c[1], life: 0.8, max: 0.8 });
          break;
        default: break;
      }
    },

    travMark(x, kind, color, life, size = 0, hot = false) {
      const list = this.travMarks ?? (this.travMarks = []);
      if (list.length >= MAX_MARKS) list.shift();
      list.push({ x: Math.round(x + (this.travScroll ?? 0)), kind, color, life, max: life, size, hot });
    },

    // Au ras du sol, par-dessus les herbes : traces, nuages, surface du marais, brume de chaleur.
    drawTravGround(ctx, scroll, dt) {
      const tr = this.trav;
      this.travScroll = scroll;
      if (!tr) return;
      const G = this.groundY;
      if (tr.wade) {
        // Surface du marais : eau trouble jusqu'aux mollets (voile de 4 px par-dessus les jambes, corps coupés
        // dessous), ligne claire de surface qui miroite, reflets qui défilent avec le sol.
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = tr.colors[1];
        ctx.fillRect(0, G - 5, this.width + 8, 4);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = tr.colors[0];
        ctx.fillRect(0, G - 1, this.width + 8, 3);
        ctx.fillStyle = tr.colors[2];
        ctx.fillRect(0, G - 6, this.width + 8, 1);
        ctx.fillStyle = tr.colors[3];
        for (let x = -((Math.round(scroll) % 13) + 13); x < this.width; x += 13) ctx.fillRect(x + (Math.floor(this.time * 2) % 2), G - 6, 4, 1);
        ctx.globalAlpha = 1;
      }
      const list = this.travMarks ?? [];
      let j = 0;
      for (const m of list) {
        m.life -= dt;
        if (m.life <= 0) continue;
        list[j++] = m;
        const t = m.life / m.max;
        const x = Math.round(m.x - scroll);
        if (x < -20 || x > this.width + 20) continue;
        ctx.globalAlpha = Math.min(1, t * 1.5) * 0.8;
        ctx.fillStyle = m.hot ? (t > 0.6 ? '#ffe27a' : t > 0.3 ? '#ff7a2a' : '#5a2a1a') : m.color;
        if (m.kind === 'print') { ctx.fillRect(x - 1, G, 2, 1); ctx.fillRect(x + 2, G + 1, 2, 1); }
        else if (m.kind === 'streak') ctx.fillRect(x - 3, G, 5, 1);
        else if (m.kind === 'ripple') {
          const r = Math.round(3 + (1 - t) * 8);
          const G = this.groundY - (tr.wade ? 5 : 0); // v9.2.1 : à la surface de l'eau dans le marais
          ctx.fillRect(x - r, G - 1, 2, 1); ctx.fillRect(x + r - 1, G - 1, 2, 1);
          ctx.fillRect(x - r + 2, G - 2, r * 2 - 4, 1);
          ctx.fillRect(x - r + 2, G, r * 2 - 4, 1);
        } else if (m.kind === 'cloud') {
          // Petit nuage en pixels (3 rangées), qui se dissout en fin de vie.
          const w = m.size || 8;
          ctx.globalAlpha = Math.min(1, t * 2) * 0.95;
          ctx.fillStyle = '#5a7ea8'; ctx.fillRect(x - w + 1, G + 1, w * 2 - 2, 1); ctx.fillRect(x - w - 1, G - 2, 1, 3); ctx.fillRect(x + w, G - 2, 1, 3);
          ctx.fillStyle = '#a8c8ec'; ctx.fillRect(x - w, G - 1, w * 2, 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w, G - 3, w * 2, 2);
          ctx.fillRect(x - Math.round(w / 2), G - 5, w, 2);
          ctx.fillStyle = '#5a7ea8'; ctx.fillRect(x - Math.round(w / 2), G - 6, w, 1); ctx.fillRect(x - w, G - 4, Math.round(w / 2), 1); ctx.fillRect(x + Math.round(w / 2), G - 4, Math.round(w / 2), 1);
        }
      }
      list.length = j;
      if (tr.haze && !this.focus) {
        // Mirage : traits de chaleur ondulants qui montent du sable (1 px, sans flou).
        ctx.fillStyle = '#fff4d0';
        for (let i = 0; i < 9; i++) {
          const p = ((this.time * 0.5 + i * 0.37) % 1);
          const bx = Math.round((((i * 97) - scroll * 0.6) % (this.width + 40) + this.width + 40) % (this.width + 40)) - 20;
          ctx.globalAlpha = Math.sin(p * Math.PI) * 0.35;
          for (let k = 0; k < 6; k++) ctx.fillRect(bx + k * 2 + Math.round(Math.sin(this.time * 5 + k + i) * 1), Math.round(G - 6 - p * 26), 2, 1);
        }
      }
      ctx.globalAlpha = 1;
    },
  });
}
