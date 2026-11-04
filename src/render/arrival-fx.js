// v9.2.2 : effets d'arrivée des ennemis (sol qui se fend, portail), dessinés derrière l'ennemi.
// Les étapes viennent de arrivalPose() (arrival.js). « Réduire les animations » : rien (l'ennemi sort seulement
// du sol ou apparaît en fondu), voir scene.drawEnemies.
//   - sortie du sol : fissures qui partent du point de sortie et s'enfoncent dans la terre, mottes de la surface
//     qui tremblent, trou qui s'ouvre avec deux bourrelets de terre, gerbe de mottes à la rupture, mottes pendant
//     l'émergence, poussière qui retombe à la sortie ;
//   - portail : fente verticale qui s'ouvre en ovale, intérieur sombre, trois bras de spirale qui tournent,
//     anneau lumineux, étincelles aspirées, éclair à la fermeture.

const SOIL = ['#5a4128', '#7a5a38', '#9a7a52'];
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export function drawArrivalFx(scene, ctx, enemy, fx, arrival, pose, k, w, h) {
  if (scene.focus) return;
  if (arrival.mode === 'burrow') burrowFx(scene, ctx, enemy, fx, pose, k, w, h);
  else if (arrival.mode === 'portal') portalFx(scene, ctx, enemy, fx, pose, k, w, h);
}

function burrowFx(scene, ctx, enemy, fx, pose, k, w, h) {
  const G = scene.groundY;
  const bx = Math.round(fx.bx);
  const c = pose.crack;
  if (c <= 0) return;
  const hw = Math.max(9, Math.round(w * 0.6));
  const seed = enemy.id * 13.7;
  const quake = k < 0.7 ? (scene.frameNo >> 1) & 1 : 0; // le sol tremble jusqu'à la sortie
  ctx.globalAlpha = Math.min(1, c * 1.4);
  // Fissures : trois branches de chaque côté, en zigzag, qui s'enfoncent dans la terre.
  for (const side of [-1, 1]) {
    for (let b = 0; b < 3; b++) {
      const len = Math.round(hw * c * (1 - b * 0.22));
      let yy = G + 1 + b;
      for (let i = 0; i < len; i++) {
        const r = hash(seed + side * 17 + b * 31 + i);
        if (r < 0.3) yy = Math.min(G + 7, yy + 1);
        else if (r > 0.8) yy = Math.max(G + 1, yy - 1);
        ctx.fillStyle = '#160e08';
        ctx.fillRect(bx + side * i, yy, 1, b === 0 || i < len * 0.4 ? 2 : 1);
        if (i % 2 === 0) { ctx.fillStyle = '#e0c48e'; ctx.fillRect(bx + side * i, yy - 1, 1, 1); } // arête claire
      }
    }
  }
  // Mottes de la surface qui sautillent sur la zone fendue.
  for (let i = 0; i < 6; i++) {
    const ox = Math.round((hash(seed + i * 5) - 0.5) * hw * 1.6 * c);
    const up = (quake + i) & 1;
    ctx.fillStyle = SOIL[i % 3];
    ctx.fillRect(bx + ox, G - 1 - up, 2 + (i & 1), 2);
  }
  // Trou et bourrelets de terre de part et d'autre.
  const open = Math.min(1, pose.emerge * 1.6 + c * 0.35) * (k < 0.85 ? 1 : c);
  const hole = Math.max(2, Math.round(hw * 0.75 * open));
  ctx.fillStyle = '#0e0905';
  ctx.fillRect(bx - hole, G - 1, hole * 2, 3);
  ctx.fillRect(bx - hole + 2, G + 2, hole * 2 - 4, 2);
  const mh = Math.round(4 * open);
  for (const side of [-1, 1]) {
    for (let j = 0; j < mh; j++) {
      ctx.fillStyle = SOIL[j % 3];
      const mw = (mh - j) * 2;
      ctx.fillRect(side < 0 ? bx - hole - mw + 1 : bx + hole - 1, G - j - quake, mw, 1);
    }
  }
  ctx.globalAlpha = 1;
  const big = enemy.boss ? 1.6 : 1;
  // Rupture du sol : gerbe de mottes et secousse.
  if (!fx.broke && k >= 0.18) {
    fx.broke = true;
    scene.shake = Math.max(scene.shake, enemy.boss ? 3 : 1.5);
    for (let i = 0; i < 16 * big; i++) {
      scene.effects.push({ kind: 'particle', x: bx + (Math.random() - 0.5) * hole * 2, y: G - 2, vx: (Math.random() - 0.5) * 90, vy: -70 - Math.random() * 70,
        color: SOIL[i % 3], life: 0.8, max: 0.8, size: 2 + (i % 2) * 2 });
    }
  }
  // Pendant l'émergence : mottes qui sautent encore.
  if (pose.emerge > 0 && pose.emerge < 1 && (scene.frameNo + enemy.id) % 2 === 0) {
    scene.effects.push({ kind: 'particle', x: bx + (Math.random() - 0.5) * hole * 2, y: G - 2, vx: (Math.random() - 0.5) * 60, vy: -50 - Math.random() * 50,
      color: SOIL[Math.floor(Math.random() * 3)], life: 0.6, max: 0.6, size: 2 + (Math.random() < 0.3 ? 1 : 0) });
  }
  // Sortie : la poussière soulevée retombe sur l'ennemi et autour.
  if (!fx.dusted && k >= 0.7) {
    fx.dusted = true;
    scene.dust(bx - hole, 5 * big);
    scene.dust(bx + hole, 5 * big);
    for (let i = 0; i < 14 * big; i++) {
      scene.effects.push({ kind: 'particle', x: bx + (Math.random() - 0.5) * w, y: G - h * (0.5 + Math.random() * 0.6), vx: (Math.random() - 0.5) * 12, vy: -10 - Math.random() * 20,
        color: i % 2 ? '#d8c8a0' : '#b8a27a', life: 0.9, max: 0.9, size: 1 });
    }
  }
}

function portalFx(scene, ctx, enemy, fx, pose, k, w, h) {
  const p = pose.portal;
  const px = Math.round(fx.px);
  const G = scene.groundY;
  const cy = Math.round(G - h / 2 - 2);
  if (p <= 0.02) {
    if (!fx.closed && k > 0.9) {
      fx.closed = true;
      scene.burst(px, cy, '#e6c2ff', 10, 40); // éclair de fermeture
    }
    return;
  }
  const rh = Math.max(2, (h / 2 + 8) * p);
  const rw = Math.max(1, Math.min(22, h * 0.3 + 5) * p * p); // fente d'abord, ovale ensuite
  const t = scene.time;
  // Intérieur sombre.
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#14062a';
  for (let yy = -Math.floor(rh); yy <= rh; yy++) {
    const half = Math.round(rw * Math.sqrt(Math.max(0, 1 - (yy / rh) ** 2)));
    if (half > 0) ctx.fillRect(px - half, cy + yy, half * 2, 1);
  }
  // Bras de spirale qui tournent (de l'anneau vers le centre).
  ctx.globalAlpha = 0.95;
  for (let j = 0; j < 3; j++) {
    for (let s = 0; s <= 14; s++) {
      const r = 1 - s / 15;
      const a = -t * 7 + j * 2.094 + r * 4.2;
      ctx.fillStyle = s < 5 ? '#ffd0ff' : j === 1 ? '#7a3cff' : '#b46aff';
      const sz = s < 5 ? 2 : 1;
      ctx.fillRect(Math.round(px + Math.cos(a) * rw * r) - (sz >> 1), Math.round(cy + Math.sin(a) * rh * r) - (sz >> 1), sz, sz);
    }
  }
  // Anneau lumineux (pointillés qui défilent).
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + t * 3;
    ctx.fillStyle = i % 3 ? '#e6c2ff' : '#8a4cff';
    ctx.fillRect(Math.round(px + Math.cos(a) * rw) - 1, Math.round(cy + Math.sin(a) * rh) - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
  // Étincelles aspirées par le portail.
  if ((scene.frameNo + enemy.id) % 2 === 0) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.6;
    scene.effects.push({ kind: 'puff', x: px + Math.cos(a) * rw * r, y: cy + Math.sin(a) * rh * r, vx: -Math.cos(a) * rw * 2.4, vy: -Math.sin(a) * rh * 2.4,
      color: Math.random() < 0.5 ? '#d8a8ff' : '#ffffff', life: 0.4, max: 0.4 });
  }
}
