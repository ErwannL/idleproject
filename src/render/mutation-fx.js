// v9.2.3 : ennemis mutés lisibles au premier coup d'œil (retour joueur : « la duplication, on croit que c'est un bug »).
// - étiquette au-dessus de la barre de PV : losange + nom court, de la couleur de la mutation ;
// - contour plus épais et plus net que l'ancien liseré, propre à chaque mutation (frénétique : rouge et rapide) ;
// - à l'apparition : « Mutation : X » au-dessus de l'ennemi ;
// - Scissipare : éclat, l'ennemi se fend en deux, les deux moitiés s'écartent, « Se divise ! » ;
// - Régénérant : chiffres verts de soin ; Cuirassé : « Bloqué » ; Vampirique : trait de vol de vie.
// « Réduire les animations » (this.focus) garde les étiquettes et les textes, retire les particules et les mouvements.
// Les mots sont écrits avec une police système (traduits par t()) : la police pixel de la scène n'a que des chiffres.
// Installé sur le prototype de la scène (comme class-fx.js) : `this` est la scène.
import { mutationById } from '../core/mutations.js';
import { formatNumber } from '../core/format.js';
import { t } from '../i18n/i18n.js';
import { capeCanvas, mutatedCanvas } from './mutation-look.js';

const FONT = '700 5px system-ui, "Noto Sans KR", "Malgun Gothic", sans-serif';
const FONT_BIG = '800 6px system-ui, "Noto Sans KR", "Malgun Gothic", sans-serif';
const SPLIT_LIFE = 0.75;
const BANNER_LIFE = 1.8;

// Étiquette : fond sombre, bord de couleur, losange puis texte. (cx, bottom) : centre et bas de l'étiquette.
export function drawTag(ctx, text, cx, bottom, color, { big = false, alpha = 1, diamond = true } = {}) {
  ctx.save();
  ctx.font = big ? FONT_BIG : FONT;
  ctx.textBaseline = 'alphabetic';
  const h = big ? 8 : 7;
  const tw = Math.ceil(ctx.measureText(text).width);
  const w = tw + (diamond ? 8 : 4);
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottom - h);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = 'rgba(10, 10, 16, 0.86)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1 / 2);
  ctx.fillRect(x, y + h - 0.5, w, 1 / 2);
  if (diamond) {
    const dx = x + 3;
    const dy = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(dx, dy - 2); ctx.lineTo(dx + 1.6, dy); ctx.lineTo(dx, dy + 2); ctx.lineTo(dx - 1.6, dy); ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x + (diamond ? 6 : 2), y + h - (big ? 1.8 : 1.6));
  ctx.restore();
}

export function installMutationFx(proto, { HERO_X }) {
  Object.assign(proto, {
    mutFxList() { return (this.mutFx ??= []); },

    // Événements de la simulation (x déjà converti en coordonnées d'écran).
    mutationEvent(event, world) {
      switch (event.type) {
        case 'mutantSpawn': {
          const m = mutationById(event.mutation);
          if (m) this.mutFxList().push({ kind: 'banner', id: event.enemyId, text: `Mutation : ${m.name}`, color: m.color, life: BANNER_LIFE, max: BANNER_LIFE });
          break;
        }
        case 'mutantSplit': {
          const fx = this.enemyFx.get(event.enemyId);
          const m = mutationById('split');
          // v9.2.4 : l'image affichée (image dessinée PixelLab comprise), pas l'image de base.
          const v = fx?.vis;
          const at = v ? { x: v.x, y: v.y, w: v.w, h: v.h } : { x: event.x - 8, y: this.groundY - 16, w: 16, h: 16 };
          this.mutFxList().push({ kind: 'split', img: v?.img ?? null, ...at, color: m.color, life: SPLIT_LIFE, max: SPLIT_LIFE });
          this.mutFxList().push({ kind: 'word', text: 'Se divise !', x: at.x + at.w / 2, y: at.y - 8, color: m.color, big: true, life: 1.3, max: 1.3 });
          if (!this.focus) {
            this.burst(at.x + at.w / 2, at.y + at.h / 2, m.color, 14, 48);
            this.burst(at.x + at.w / 2, at.y + at.h / 2, '#ffffff', 5, 30);
          }
          break;
        }
        case 'enemyHit': {
          const enemy = world.enemies.find((e) => e.id === event.enemyId);
          if (enemy?.mutation !== 'armored' || enemy.hp <= enemy.maxHp * 0.5) break;
          const fx = this.enemyFxFor(enemy.id);
          if ((fx.blockedAt ?? -1) > this.time - 0.5) break; // pas plus de deux « Bloqué » par seconde
          fx.blockedAt = this.time;
          const m = mutationById('armored');
          const cx = fx.sx !== undefined ? fx.sx + fx.sw / 2 : event.x;
          this.mutFxList().push({ kind: 'word', text: 'Bloqué', x: cx - 6, y: (fx.sy ?? this.groundY - 20) + 4, color: m.color, life: 0.7, max: 0.7, rise: 8 });
          if (!this.focus) {
            // v9.2.3 : étincelles jaunes et blanches qui jaillissent de la cuirasse.
            const sy = (fx.sy ?? this.groundY - 20) + (fx.sh ?? 16) / 2;
            this.burst(cx - 6, sy, '#fff2a0', 6, 46);
            this.burst(cx - 6, sy, '#ffffff', 4, 30);
          }
          break;
        }
        case 'heroHit': {
          const enemy = world.enemies.find((e) => e.id === event.enemyId);
          if (enemy?.mutation !== 'vampire') break;
          const fx = this.enemyFxFor(enemy.id);
          const m = mutationById('vampire');
          const x1 = fx.sx !== undefined ? fx.sx + fx.sw / 2 : this.wx(enemy.x);
          const y1 = (fx.sy ?? this.groundY - 20) + (fx.sh ?? 16) / 2;
          this.mutFxList().push({ kind: 'drain', x0: HERO_X + 2, y0: this.groundY - 14, x1, y1, color: m.color, life: 0.55, max: 0.55 });
          this.addText(`+${formatNumber(Math.max(1, Math.round(event.damage * 3)))}`, x1, (fx.sy ?? this.groundY - 30) - 10, m.color, '#ffd0da');
          break;
        }
        default:
          break;
      }
    },

    // Contour de la mutation (à la place de l'ancien liseré d'1 px) : 2 px, pulsé ; frénétique : rouge et rapide,
    // plus vif quand il prépare un coup ; géant : doré et plus épais.
    // v9.2.3 : plus une surcouche propre à chaque mutation (apparence : mutation-look.js) :
    // géant : pas lourds (secousse, poussière) ; vampirique : cape d'ombre ; frénétique : vapeur et yeux qui brillent ;
    // régénérant : lueur verte qui pulse et feuilles ; scissipare : membrane qui ondule et bulles.
    drawMutationAura(ctx, enemy, m, glow, x, y, appear, paint, fx, look = {}) {
      const frenzied = m.id === 'frenzied';
      const speed = frenzied ? 16 : 6;
      const pulse = this.focus ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * speed + enemy.id);
      const hot = frenzied && (fx?.windup > 0 || fx?.lunge > 0) ? 0.25 : 0;
      const sw = look.w ?? fx?.sw ?? 16, sh = look.h ?? fx?.sh ?? 16, scale = look.scale ?? 1;
      if (m.id === 'vampire' && look.src) {
        const cape = capeCanvas(look.src);
        if (cape) {
          const flap = this.focus ? 0 : Math.round(Math.sin(this.time * 5 + enemy.id) * scale);
          ctx.globalAlpha = appear * 0.95;
          paint(cape, x - cape.pad * scale + flap, y - cape.pad * scale);
        }
      }
      if (m.id === 'split') {
        // Membrane : contour qui ondule (décalages qui tournent), plus large que le corps.
        ctx.globalAlpha = appear * 0.55;
        const t = this.focus ? 0 : this.time * 7 + enemy.id;
        for (let i = 0; i < 6; i++) {
          const a = t + i * (Math.PI / 3);
          paint(glow, x + Math.round(Math.cos(a) * 2), y + Math.round(Math.sin(a * 1.3) * 2));
        }
      }
      if (m.id === 'regen') {
        // Lueur verte qui pulse lentement (halo large).
        const p = this.focus ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 3 + enemy.id);
        ctx.globalAlpha = appear * (0.15 + 0.3 * p);
        for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) paint(glow, x + dx, y + dy);
      }
      ctx.globalAlpha = appear * Math.min(1, 0.75 + 0.25 * pulse + hot);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) paint(glow, x + dx, y + dy);
      ctx.globalAlpha = appear * (0.25 + 0.3 * pulse + hot);
      const r = m.id === 'giant' ? 3 : 2;
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) paint(glow, x + dx, y + dy);
      if (this.focus) return;
      const tick = (n) => (this.frameNo + enemy.id) % n === 0;
      if (frenzied) {
        // Braises rouges qui jaillissent vite, vapeur qui monte de la tête, yeux qui brillent.
        if (tick(4)) this.mutFxList().push({ kind: 'mote', x: x + Math.random() * sw, y: y + Math.random() * sh * 0.6, color: '#ff3a2a', life: 0.35, max: 0.35, vy: -40 });
        if (tick(6)) this.mutFxList().push({ kind: 'steam', x: x + sw * (0.25 + Math.random() * 0.5), y: y + 2, life: 0.9, max: 0.9, vx: 6 + Math.random() * 6 });
        const eyes = look.src ? mutatedCanvas(look.src, 'frenzied').eyes ?? [] : [];
        ctx.globalAlpha = appear * (0.55 + 0.45 * pulse);
        ctx.fillStyle = '#ffe14a';
        for (const [ex, ey] of eyes) {
          const px = x + (look.ox ?? 0) + ex * scale, py = y + (look.oy ?? 0) + ey * scale;
          ctx.fillRect(Math.round(px - scale), Math.round(py - scale / 2), Math.max(2, Math.round(scale * 3)), Math.max(1, Math.round(scale * 2)));
        }
      } else if (m.id === 'regen') {
        if (tick(10)) this.mutFxList().push({ kind: 'mote', x: x + Math.random() * sw, y: y + Math.random() * sh * 0.6, color: m.color, cross: true, life: 0.8, max: 0.8, vy: -12 });
        if (tick(14)) this.mutFxList().push({ kind: 'leaf', x: x + Math.random() * sw, y: y + sh * 0.2, life: 1.2, max: 1.2, vx: 4 - Math.random() * 8 });
      } else if (m.id === 'split') {
        if (tick(9)) this.mutFxList().push({ kind: 'bubble', x: x + Math.random() * sw, y: y + sh * (0.4 + Math.random() * 0.5), life: 1, max: 1 });
      } else if (m.id === 'vampire') {
        if (tick(16)) this.mutFxList().push({ kind: 'mote', x: x + sw * (0.3 + Math.random() * 0.6), y: y + sh * 0.9, color: '#9a3ac8', life: 0.9, max: 0.9, vy: -10 });
      } else if (m.id === 'giant' && look.moving) {
        // Pas lourds : à chaque pas, petite secousse et poussière sous ses pieds.
        const stepNo = Math.floor(this.time * 2.6 + enemy.id);
        if (fx.giantStep !== stepNo) {
          fx.giantStep = stepNo;
          if (x < this.width - 10) {
            this.shake = Math.max(this.shake, 1.5);
            this.dust(x + sw * (stepNo % 2 ? 0.3 : 0.7), 3);
          }
        }
      }
    },

    // Étiquette au-dessus de la barre de PV (cx : centre, barY : haut de la barre), et chiffres de soin du régénérant.
    drawMutationTag(ctx, enemy, m, cx, barY, appear) {
      // Dessinée après les chiffres de dégâts (drawMutationFx), sinon ils la cachent au contact.
      (this.mutTags ??= []).push({ text: t(m.name), cx, bottom: barY - 2, color: m.color, alpha: appear });
      if (m.id !== 'regen') return;
      const fx = this.enemyFxFor(enemy.id);
      if (fx.regenHp !== undefined && enemy.hp > fx.regenHp) fx.regenGain = (fx.regenGain ?? 0) + (enemy.hp - fx.regenHp);
      fx.regenHp = enemy.hp;
      if (fx.regenGain > 0 && (fx.regenAt ?? -1) < this.time - 0.8) {
        fx.regenAt = this.time;
        if (enemy.hp < enemy.maxHp) this.addText(`+${formatNumber(Math.max(1, Math.round(fx.regenGain)))}`, cx + 8, barY - 10, '#5fe07a', '#d8ffd8');
        fx.regenGain = 0;
      }
    },

    // Effets propres aux mutations (après les autres effets).
    drawMutationFx(ctx, dt) {
      const list = this.mutFxList();
      this.mutFx = list.filter((e) => (e.life -= dt) > 0);
      for (const e of this.mutFx) {
        const k = 1 - e.life / e.max; // 0 → 1
        ctx.save();
        if (e.kind === 'banner') {
          const fx = this.enemyFx.get(e.id);
          if (!fx || fx.sx === undefined || this.time - (fx.seen ?? 0) > 0.2) { ctx.restore(); continue; }
          const a = Math.min(1, e.life / 0.3, (e.max - e.life) / 0.15 + 0.2);
          drawTag(ctx, t(e.text), fx.sx + fx.sw / 2, fx.sy - 15 - (this.focus ? 0 : Math.round(k * 3)), e.color, { big: true, alpha: a, diamond: false });
        } else if (e.kind === 'word') {
          const a = Math.min(1, e.life / 0.3);
          const pop = this.focus ? 0 : Math.round(k * (e.rise ?? 6));
          drawTag(ctx, t(e.text), e.x, e.y - pop, e.color, { big: e.big, alpha: a, diamond: false });
        } else if (e.kind === 'split') {
          // Éclat blanc, fente lumineuse, puis les deux moitiés qui s'écartent en pâlissant.
          const cx = e.x + e.w / 2;
          const gap = this.focus ? 2 : Math.round(2 + k * 10);
          const a = 1 - Math.max(0, (k - 0.45) / 0.55);
          if (e.img) {
            ctx.globalAlpha = a;
            for (const side of [-1, 1]) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(side < 0 ? e.x - 20 : cx, e.y - 20, e.w / 2 + 20, e.h + 40);
              ctx.clip();
              const tilt = this.focus ? 0 : side * k * 0.25;
              ctx.translate(cx + side * gap, e.y + e.h);
              ctx.rotate(tilt);
              ctx.drawImage(e.img, -e.w / 2, -e.h, e.w, e.h);
              ctx.restore();
            }
          }
          // Fente : trait vertical en zigzag, de la couleur de la mutation puis blanc.
          ctx.globalAlpha = Math.max(0, 1 - k * 1.6);
          ctx.fillStyle = k < 0.25 ? '#ffffff' : e.color;
          for (let yy = 0; yy < e.h; yy += 2) ctx.fillRect(Math.round(cx + ((yy / 2) % 2 ? 1 : -1) * 0.5) - 0.5, Math.round(e.y + yy), 1, 2);
          if (k < 0.2) {
            ctx.globalAlpha = (0.2 - k) / 0.2 * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx, e.y + e.h / 2, 4 + k * 40, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (e.kind === 'drain') {
          // Trait de vol de vie : du chevalier vers le vampire, avec trois gouttes qui filent.
          ctx.globalAlpha = Math.min(1, e.life / 0.25);
          ctx.strokeStyle = '#d0102a';
          ctx.lineWidth = 2; // v9.2.3 : filet de sang plus épais, bien visible
          ctx.setLineDash([3, 2]);
          ctx.lineDashOffset = -this.time * 30;
          ctx.beginPath();
          const mx = (e.x0 + e.x1) / 2;
          const my = Math.min(e.y0, e.y1) - 10;
          ctx.moveTo(e.x0, e.y0);
          ctx.quadraticCurveTo(mx, my, e.x1, e.y1);
          ctx.stroke();
          ctx.setLineDash([]);
          if (!this.focus) {
            ctx.fillStyle = '#ffb0c0';
            for (let i = 0; i < 3; i++) {
              const s = (k * 1.4 + i * 0.22) % 1;
              const px = (1 - s) ** 2 * e.x0 + 2 * (1 - s) * s * mx + s * s * e.x1;
              const py = (1 - s) ** 2 * e.y0 + 2 * (1 - s) * s * my + s * s * e.y1;
              ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
            }
          }
        } else if (e.kind === 'steam') {
          // v9.2.3 : vapeur du frénétique : petites bouffées grises qui montent et grossissent.
          e.y -= 14 * dt; e.x += (e.vx ?? 0) * dt;
          ctx.globalAlpha = 0.5 * (e.life / e.max);
          ctx.fillStyle = '#e8d8d8';
          const r = 1 + Math.round(k * 2);
          ctx.fillRect(Math.round(e.x) - r, Math.round(e.y) - r, r * 2, r * 2);
        } else if (e.kind === 'leaf') {
          // v9.2.3 : feuille du régénérant qui descend en se balançant.
          e.y += 10 * dt; e.x += Math.sin((e.max - e.life) * 6) * 12 * dt + (e.vx ?? 0) * dt;
          ctx.globalAlpha = Math.min(1, e.life / 0.4);
          ctx.fillStyle = '#5fe07a';
          ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 1);
          ctx.fillStyle = '#2f9a4a';
          ctx.fillRect(Math.round(e.x) + 1, Math.round(e.y) + 1, 1, 1);
        } else if (e.kind === 'bubble') {
          // v9.2.3 : bulle verte du scissipare (anneau qui monte puis éclate).
          e.y -= 9 * dt;
          ctx.globalAlpha = 0.8 * Math.min(1, e.life / 0.3);
          ctx.strokeStyle = '#a8ff9a';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 1 + k * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.kind === 'mote') {
          e.y += (e.vy ?? -12) * dt;
          ctx.globalAlpha = e.life / e.max;
          ctx.fillStyle = e.color;
          const px = Math.round(e.x);
          const py = Math.round(e.y);
          if (e.cross) { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); } else ctx.fillRect(px, py, 1, 2);
        }
        ctx.restore();
      }
      for (const tag of this.mutTags ?? []) drawTag(ctx, tag.text, tag.cx, tag.bottom, tag.color, { alpha: tag.alpha });
      this.mutTags = [];
    },
  });
}
