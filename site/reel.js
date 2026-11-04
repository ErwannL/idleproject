// Bandeau animé : un aperçu du jeu avec les artworks réels (mondes, ennemis, boss, héros, effets).
// Les 11 mondes s'enchaînent ; le niveau et les étoiles du héros principal montent avec la progression.
// Rien n'est enregistré ni envoyé. Mise en pause hors écran et pour « réduire les animations ».
const BASE = 'assets/show/';
const SCENE_MS = 6800;
const MAX_ENEMIES = 7;
const FADE_MS = 700;

// Chaque monde : fonds, ennemis de rang normal, un intermédiaire, un boss, et la lignée de héros.
const SCENES = [
  { name: 'Plaines verdoyantes', bg: 'plains', ground: '#4f7a2d', level: 1, stars: 1, team: ['ally_squire', 'ally_elf_archer', 'ally_priestess'], enemies: ['slime', 'boar', 'wolf', 'goblin', 'bat'], mid: 'mid_boar_titan', boss: 'boss_slime_king' },
  { name: 'Forêt sylvestre', bg: 'forest', ground: '#2f5a2a', level: 8, stars: 2, team: ['ally_elf_archer', 'ally_sylvan_guardian', 'ally_priestess'], enemies: ['mandrake', 'mushroom', 'mini_treant', 'harpy', 'toad'], mid: 'mid_hydra', boss: 'boss_rotting_dryad' },
  { name: 'Monts glacés', bg: 'mountains', ground: '#5a7596', level: 15, stars: 2, team: ['ally_ice_empress', 'ally_squire', 'ally_azure_paladin'], enemies: ['yeti', 'golem', 'griffin_cub', 'wolf', 'bat'], mid: 'mid_mammoth', boss: 'boss_frost_wyrm' },
  { name: 'Cristaux des profondeurs', bg: 'caves', ground: '#3b3556', level: 22, stars: 3, team: ['ally_azure_paladin', 'ally_rose_blade', 'ally_dwarf'], enemies: ['mid_crystal_bat', 'mini_crystal_golem', 'obsidian_beetle', 'goblin', 'slime'], mid: 'mid_giant_spider', boss: 'boss_magma_colossus' },
  { name: 'Désert des pharaons', bg: 'desert', ground: '#a8803d', level: 30, stars: 3, team: ['ally_rose_blade', 'ally_pyromancer', 'ally_squire'], enemies: ['scorpion', 'mummy', 'mini_pharaoh', 'skeleton', 'lich'], mid: 'mid_sand_worm', boss: 'boss_demon_king' },
  { name: 'Abîme des os', bg: 'abyss', ground: '#2a2a33', level: 40, stars: 4, team: ['ally_shadow_lord', 'ally_high_priest', 'ally_ninja'], enemies: ['wraith', 'skeleton', 'lich', 'imp', 'bat'], mid: 'mid_star_devourer', boss: 'boss_bone_lord' },
  { name: 'Terres maudites', bg: 'cursed', ground: '#3a2a3f', level: 50, stars: 4, team: ['ally_witch', 'ally_shadow_lord', 'ally_demon_queen'], enemies: ['bog_zombie', 'ash_wraith', 'imp', 'wraith', 'skeleton'], mid: 'mid_hellhound', boss: 'boss_spectral_queen' },
  { name: 'Marais putrides', bg: 'swamp', ground: '#34472a', level: 60, stars: 5, team: ['ally_ranger', 'ally_witch', 'ally_high_priest'], enemies: ['toad', 'leech_fly', 'bog_zombie', 'mushroom', 'slime'], mid: 'mid_hydra', boss: 'boss_swamp_behemoth' },
  { name: 'Îles du ciel', bg: 'sky', ground: '#7ea6d4', level: 72, stars: 5, team: ['ally_archangel', 'ally_lancer', 'ally_ice_empress'], enemies: ['harpy', 'cloud_spirit', 'sky_automaton', 'griffin_cub', 'bat'], mid: 'mid_thunder_griffin', boss: 'boss_sky_titan' },
  { name: 'Forges volcaniques', bg: 'volcano', ground: '#4a2216', level: 85, stars: 5, team: ['ally_pyromancer', 'ally_demon_queen', 'ally_dwarf'], enemies: ['salamander', 'magma_slime', 'mid_lava_golem', 'mid_hellhound', 'imp'], mid: 'mid_lava_golem', boss: 'boss_magma_colossus' },
  { name: 'Néant', bg: 'void', ground: '#241a3a', level: 99, stars: 5, team: ['ally_demon_queen', 'ally_archangel', 'ally_shadow_lord'], enemies: ['voidling', 'void_eye', 'mini_void_watcher', 'wraith', 'bat'], mid: 'mid_star_devourer', boss: 'boss_void_emperor' },
];

// Effet choisi selon le héros : mêlée, tir, sort de feu, givre, lumière.
const EFFECT_BY_HERO = {
  ally_squire: 'fx_slash1', ally_azure_paladin: 'fx_slash1', ally_rose_blade: 'fx_slash1', ally_ninja: 'fx_slash1', ally_shadow_lord: 'fx_slash1',
  ally_elf_archer: 'fx_bolt', ally_ranger: 'fx_bolt', ally_lancer: 'fx_bolt',
  ally_pyromancer: 'fx_fireball1', ally_demon_queen: 'fx_fireball1', ally_witch: 'fx_soul1',
  ally_ice_empress: 'fx_frost1', ally_priestess: 'fx_burst', ally_high_priest: 'fx_burst', ally_archangel: 'fx_burst', ally_sylvan_guardian: 'fx_burst', ally_dwarf: 'fx_hit',
};

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('reel');
const ctx = canvas.getContext('2d');
const hudWorld = document.getElementById('reel-world');
const hudLevel = document.getElementById('reel-level');
const hudBar = document.getElementById('reel-bar');
const stage = canvas.parentElement;

// Chargement des images une seule fois.
const images = new Map();
function img(name) {
  if (!images.has(name)) {
    const i = new Image();
    i.src = BASE + name + '.png';
    images.set(name, i);
  }
  return images.get(name);
}
const ready = (i) => i.complete && i.naturalWidth > 0;

let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = stage.clientWidth;
  H = stage.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

// Dessine une image pixel art à une hauteur donnée, les pieds sur (x, y).
function drawFeet(i, x, footY, height, flip = false, alpha = 1) {
  if (!ready(i)) return;
  const s = height / i.naturalHeight;
  const w = i.naturalWidth * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (flip) { ctx.translate(x + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + w / 2), 0); }
  ctx.drawImage(i, x, footY - i.naturalHeight * s, w, i.naturalHeight * s);
  ctx.restore();
}

// Décor : couches défilantes, pieds au niveau du sol.
function drawBackground(scene, scroll, alpha) {
  const ground = H * 0.8;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, ground, 0, H);
  g.addColorStop(0, scene.ground);
  g.addColorStop(1, '#0b1222');
  ctx.fillStyle = g;
  ctx.fillRect(0, ground - 2, W, H - ground + 2);
  const layers = [['far', 0.05, 0.78], ['near', 0.12, 0.6], ['front', 0.22, 0.45], ['ground', 0.35, 0.3]];
  for (const [layer, speed, frac] of layers) {
    const i = img(`${scene.bg}_${layer}`);
    if (!ready(i)) continue;
    const h = H * frac;
    const w = i.naturalWidth * (h / i.naturalHeight);
    const offset = -((scroll * speed) % w);
    for (let x = offset; x < W; x += w) ctx.drawImage(i, x, ground - h, w, h);
  }
  ctx.restore();
}

const enemyHeight = (kind) => (kind === 'boss' ? H * 0.5 : kind === 'mid' ? H * 0.32 : H * 0.2);

// État de la scène courante.
let scenes = { index: 0, t: 0, prev: null, prevT: 0 };
let enemies = [];
let effects = [];
let numbers = [];
let coins = [];
let scroll = 0;
let lastT = 0;
let spawnTimer = 0;
let attackTimer = 0;
let bossSpawned = false;
let sceneUsed = 0;
let running = false;

function nextEnemyKind(scene) {
  const roll = Math.random();
  if (roll < 0.1) return 'mid';
  return 'normal';
}

function enemyName(scene, kind) {
  if (kind === 'boss') return scene.boss;
  if (kind === 'mid') return scene.mid;
  return scene.enemies[Math.floor(Math.random() * scene.enemies.length)];
}

function spawnEnemy(scene, kind) {
  const name = enemyName(scene, kind);
  const hp = kind === 'boss' ? 40 : kind === 'mid' ? 12 : 4;
  enemies.push({ name, kind, x: W + 30, hp, maxHp: hp, stopX: W * (kind === 'boss' ? 0.8 : 0.84) + (Math.random() * 20 - 10), dead: 0, hitCooldown: 0.6 + Math.random() * 0.6, flash: 0 });
}

function spawnCoins(x, y, n) {
  for (let k = 0; k < n; k++) coins.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -120 - Math.random() * 120, life: 1.2, sprite: k % 4 === 0 ? 'icon_gem' : 'coin' });
}

function setHud(scene, idx) {
  const lead = scene.team[0];
  hudWorld.textContent = `Monde ${idx + 1} · ${scene.name}`;
  hudLevel.textContent = `Niv. ${scene.level} · ${'★'.repeat(scene.stars)}${'☆'.repeat(5 - scene.stars)}`;
  hudLevel.dataset.hero = lead;
}

function startScene(index) {
  scenes.prev = scenes.index;
  scenes.prevT = 0;
  scenes.index = index;
  scenes.t = 0;
  enemies = [];
  numbers = [];
  effects = [];
  spawnTimer = 0.5;
  attackTimer = 0.4;
  bossSpawned = false;
  sceneUsed = 0;
  setHud(SCENES[index], index);
}

function update(dt) {
  const scene = SCENES[scenes.index];
  scenes.t += dt;
  scenes.prevT += dt;
  scroll += dt * 60;
  hudBar.style.width = `${Math.min(100, (scenes.t / (SCENE_MS / 1000)) * 100)}%`;

  // Apparitions : ennemis normaux, un intermédiaire de temps en temps, le boss vers la fin.
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.filter((e) => e.kind !== 'boss' && !e.dead).length < MAX_ENEMIES) {
    spawnEnemy(scene, nextEnemyKind(scene));
    spawnTimer = 0.7 + Math.random() * 0.6;
  }
  if (!bossSpawned && scenes.t > (SCENE_MS / 1000) * 0.55) {
    spawnEnemy(scene, 'boss');
    bossSpawned = true;
  }

  // Déplacement jusqu'à la ligne de combat.
  for (const e of enemies) {
    if (e.dead) { e.dead += dt; continue; }
    if (e.x > e.stopX) e.x = Math.max(e.stopX, e.x - dt * (e.kind === 'boss' ? 26 : 70));
    e.flash = Math.max(0, e.flash - dt);
    if (e.x <= e.stopX + 1) {
      e.hitCooldown -= dt;
      if (e.hitCooldown <= 0) {
        // Un héros frappe l'ennemi : effet, dégâts, éventuelle mort.
        const hero = scene.team[sceneUsed % scene.team.length];
        sceneUsed += 1;
        const dmg = e.kind === 'boss' ? 1 : e.kind === 'mid' ? 2 : 4;
        e.hp -= dmg;
        e.flash = 0.12;
        e.hitCooldown = e.kind === 'boss' ? 0.9 : 0.55 + Math.random() * 0.5;
        effects.push({ sprite: EFFECT_BY_HERO[hero] ?? 'fx_hit', target: e, life: 0.4, age: 0 });
        numbers.push({ text: `-${dmg * 100}`, x: e.x + (Math.random() * 20 - 10), y: H * 0.45 - enemyHeight(e.kind) * 0.5, life: 0.9, crit: e.kind === 'boss' });
        if (e.hp <= 0) {
          e.dead = 0.001;
          spawnCoins(e.x, H * 0.7, e.kind === 'boss' ? 12 : 3);
        }
      }
    }
  }
  enemies = enemies.filter((e) => !e.dead || e.dead < 0.6);

  for (const f of effects) f.age += dt;
  effects = effects.filter((f) => f.age < f.life);
  for (const n of numbers) { n.life -= dt; n.y -= dt * 40; }
  numbers = numbers.filter((n) => n.life > 0);
  for (const c of coins) { c.life -= dt; c.vy += dt * 380; c.x += c.vx * dt; c.y += c.vy * dt; }
  coins = coins.filter((c) => c.life > 0 && c.y < H);

  // Changement de monde.
  if (scenes.t * 1000 >= SCENE_MS) startScene((scenes.index + 1) % SCENES.length);
}

function draw(dt) {
  ctx.clearRect(0, 0, W, H);
  const scene = SCENES[scenes.index];
  const fadeIn = Math.min(1, scenes.t * 1000 / FADE_MS);
  if (scenes.prevT * 1000 < FADE_MS && scenes.prev !== null) {
    drawBackground(SCENES[scenes.prev], scroll, 1);
  }
  drawBackground(scene, scroll, fadeIn);

  const ground = H * 0.8;
  // Héros : trois personnages qui se balancent, le principal est devant.
  scene.team.forEach((name, k) => {
    const i = img(name);
    const bob = Math.sin((scenes.t * 6) + k) * H * 0.012;
    const x = W * 0.5 + k * W * 0.075;
    const footY = ground + (k === 0 ? 0 : (k === 1 ? -H * 0.02 : H * 0.02));
    drawFeet(i, x, footY + bob * 0, H * (k === 0 ? 0.36 : 0.32), false);
  });

  // Ennemis.
  for (const e of enemies) {
    const i = img(e.name);
    const bob = Math.sin((scenes.t * 5) + e.x * 0.02) * H * 0.01;
    const alpha = e.dead ? Math.max(0, 1 - e.dead / 0.6) : 1;
    const footY = ground + (e.kind === 'boss' ? H * 0.04 : 0) + bob;
    e.yFoot = footY;
    if (e.flash > 0) ctx.filter = 'brightness(2.4)';
    drawFeet(i, e.x, footY, enemyHeight(e.kind), true, alpha);
    ctx.filter = 'none';
    if (!e.dead && e.kind !== 'normal' && ready(i)) {
      // Barre de vie au-dessus des boss et intermédiaires.
      const w = e.kind === 'boss' ? 120 : 70;
      const x = e.x + (enemyHeight(e.kind) * (i.naturalWidth / i.naturalHeight)) / 2 - w / 2;
      const y = footY - enemyHeight(e.kind) - 12;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = e.kind === 'boss' ? '#ff6b6b' : '#ffd166';
      ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 6);
    }
  }

  // Effets, dégâts, butin.
  for (const f of effects) {
    const i = img(f.sprite);
    if (!ready(i)) continue;
    const t = f.age / f.life;
    ctx.globalAlpha = 1 - t;
    const size = H * (0.22 + t * 0.1);
    const x = f.target.x - size * 0.35;
    ctx.drawImage(i, x, H * 0.55 - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
  ctx.font = `800 ${Math.round(H * 0.06)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (const n of numbers) {
    ctx.globalAlpha = Math.max(0, n.life / 0.9);
    ctx.fillStyle = n.crit ? '#ffd166' : '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(n.text, n.x, n.y);
    ctx.fillText(n.text, n.x, n.y);
  }
  ctx.globalAlpha = 1;
  for (const c of coins) {
    const i = img(c.sprite);
    if (!ready(i)) continue;
    const s = H * 0.07;
    ctx.drawImage(i, c.x, c.y, s, s);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  if (!running) return;
  update(dt);
  draw(dt);
  requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  lastT = performance.now();
  requestAnimationFrame(frame);
}
function stop() { running = false; }

// Images prêtes : on lance seulement quand le décor et les héros sont chargés.
function boot() {
  resize();
  startScene(0);
  if (reduceMotion) {
    // Une image fixe, sans animation.
    update(2.5);
    draw(0);
    return;
  }
  const visible = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? start : stop)();
  }, { threshold: 0.1 });
  visible.observe(canvas);
}

window.addEventListener('resize', () => { resize(); if (reduceMotion) draw(0); });
// Premier rendu dès que le premier héros est chargé.
const firstHero = img(SCENES[0].team[0]);
if (firstHero.complete) boot(); else firstHero.addEventListener('load', boot);
