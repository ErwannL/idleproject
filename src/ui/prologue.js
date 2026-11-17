// v9.7.1 (lot 1) : prologue jouable « La défaite, puis la réincarnation » — première connexion seulement, ≈ 115 s,
// joué dans le moteur de combat avec les vrais sprites. Cinq scènes :
//   1. La marche (0–20 s)       : le héros, puissant et bien équipé, traverse un champ de ruines au crépuscule ; deux
//                                  vagues faibles ; un bouton de compétence brille (le geste de base, sans bulle).
//   2. Le Colosse (20–50 s)     : le sol tremble, le Colosse entre ; dégâts dérisoires ; rocher, puis poing ; la vie
//                                  du héros chute par paliers.
//   3. Les renforts (50–75 s)   : la Prêtresse et la Pyromancienne accourent ; un appui déclenche leur compétence ; la
//                                  barre du Colosse descend jusqu'à la moitié.
//   4. La rage (75–95 s)        : transformation, un seul rayon balaie l'écran, les compagnonnes tombent, l'équipement
//                                  se brise pièce par pièce, dernier coup, écran blanc.
//   5. La réincarnation (95 s–) : espace hors du monde, une entité parle (4 répliques), un seul choix (bénédiction de
//                                  départ et, si tu veux, le nom du héros), lumière, réveil dans les Plaines.
// Rien n'est écrit dans la sauvegarde avant le réveil : onDone({ blessing, name }) s'en charge (main.js).
// « Passer » reste cliquable au-dessus de tout ; passer mène directement au choix de la scène 5.
// Le script (prologueState) est pur : l'affichage est calculé à partir du temps t.
import { SceneRenderer } from '../render/scene.js';
import { WorldBossScene } from '../render/world-boss-scene.js';
import { WorldBossFight } from '../core/world-boss.js';
import { createCombat, step } from '../core/combat.js';
import { makeItem } from '../core/loot.js';
import { Rng } from '../core/rng.js';
import { ZONES } from '../data/zones.js';
import { BLESSINGS } from '../core/blessing.js';
import { escapeHtml } from './common.js';

export const PROLOGUE_HINT = 'prologue';
export const PROLOGUE_SECONDS = 115;
const SCENES = { march: 0, colossus: 20, allies: 50, rage: 75, rebirth: 95 };
export const PROLOGUE_SCENES = SCENES;

// Répliques à l'écran : [début (s), texte]. Un appui sur la scène saute à la suivante (dans les scènes 1 à 4).
export const PROLOGUE_LINES = [
  [1, 'Les ruines d\'Ascendrya. Tu marches, au sommet de ta force.'],
  [7, 'Des monstres ! Touche le bouton qui brille : ta compétence.'],
  [20, 'Le sol tremble…'],
  [24, 'Le Colosse des Anciens. Frappe-le de toutes tes forces.'],
  [33, 'Tes coups l\'effleurent à peine.'],
  [42, 'Chaque coup du géant te fait plier.'],
  [50, 'La Prêtresse et la Pyromancienne accourent !'],
  [56, 'Touche leurs boutons : elles combattent avec toi.'],
  [68, 'Ensemble, vous faites enfin plier le géant.'],
  [75, 'Le Colosse entre en rage.'],
  [81, 'Son regard brûlant balaie tout.'],
  [87, 'Ton équipement se brise…'],
];
// Scène 5 : l'entité (4 répliques courtes).
export const REBIRTH_LINES = [
  'Tu es mort, héros.',
  'Le Colosse a gagné. Les ruines sont à lui.',
  'Je t\'offre une seconde vie.',
  'Tu repartiras sans rien. Mais tu garderas le souvenir.',
];
const ALLIES_IN = 50, ALLY_FALL = [84, 86.5], GEAR_BREAK = [86, 88, 90], LAST_HIT = 92, WHITE = [92.5, 95];
const ROCKS = [29, 39, 62], PUNCH = [35, 45], BEAM = 80;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * clamp(k);

// Vie du héros (%) par paliers : chaque coup du Colosse en retire un gros morceau ; les soins de la Prêtresse remontent.
function heroHpAt(t) {
  if (t < SCENES.colossus) return 100;
  const drops = [[29.7, 82], [35.6, 63], [39.7, 44], [45.6, 28]];
  let hp = 100;
  for (const [at, v] of drops) if (t >= at) hp = v;
  if (t >= ALLIES_IN + 3) hp = lerp(28, 74, (t - ALLIES_IN - 3) / 8);
  if (t >= 62.7) hp = Math.min(hp, 60);
  if (t >= BEAM + 1.5) hp = lerp(60, 22, (t - BEAM - 1.5) / 8);
  if (t >= LAST_HIT) hp = 0;
  return hp;
}
function bossHpAt(t) {
  if (t < SCENES.colossus) return 100;
  if (t < ALLIES_IN) return lerp(100, 97, (t - SCENES.colossus) / 30);
  if (t < SCENES.rage) return lerp(97, 50, (t - ALLIES_IN - 2) / 21);
  return 50;
}

export function prologueState(t) {
  const scene = t >= SCENES.rebirth ? 'rebirth' : t >= SCENES.rage ? 'rage' : t >= SCENES.allies ? 'allies' : t >= SCENES.colossus ? 'colossus' : 'march';
  return {
    t, scene,
    dialog: PROLOGUE_LINES.filter(([at]) => at <= t).length - 1,
    heroHp: heroHpAt(t), bossHp: bossHpAt(t),
    allies: t >= ALLIES_IN ? clamp((t - ALLIES_IN) / 1.5) : 0,
    allyDown: ALLY_FALL.map((f) => t >= f), // Prêtresse, Pyromancienne
    gearLeft: 3 - GEAR_BREAK.filter((g) => t >= g).length, // arme, casque, armure
    skillPrompt: (t >= 7 && t < 19) || (t >= 24 && t < 48),
    allyPrompt: t >= 56 && t < 74,
    white: t >= WHITE[0] ? clamp((t - WHITE[0]) / (WHITE[1] - WHITE[0])) : 0,
    shake: (t >= 20 && t < 23) || (t >= 75 && t < 77),
    done: t >= PROLOGUE_SECONDS,
  };
}

// Héros du prologue : puissant (niveau élevé), armure complète épique et légendaire, compétences apprises.
function heroState(game) {
  const s = typeof structuredClone === 'function' ? structuredClone(game) : JSON.parse(JSON.stringify(game));
  s.level = 60;
  s.upgrades = { ...(s.upgrades ?? {}), damage: 120, vitality: 120, armor: 40 };
  s.skills = { ...(s.skills ?? {}), quick: 3, whirl: 3 };
  s.companions = { ...(s.companions ?? {}), owned: {}, equipped: [] };
  s.inventory = [];
  const gear = [['weapon', 'greatsword', 'legendary'], ['helmet', 'iron_helm', 'epic'], ['armor', 'chainmail', 'legendary']];
  s.equipment = { ...(s.equipment ?? {}) };
  for (const [slot, base, rar] of gear) { try { s.equipment[slot] = makeItem(s, base, rar, 60); s.nextItemId = (s.nextItemId ?? 1) + 1; } catch { /* objet inconnu : on garde l'actuel */ } }
  Object.assign(s, { dungeon: null, tower: null, challenge: null, worldRun: null, skillAuto: false, autoAdvance: false });
  s.ui = { ...(s.ui ?? {}), focus: false, shake: true };
  const ruins = ZONES.findIndex((z) => z.id === 'cursed');
  s.stage = s.maxStage = Math.max(1, ruins) * 20 + 2; // une étape des Terres maudites (ruines), sans boss
  return s;
}

export function playPrologue({ reduced = false, state: game = null, onDone = () => {} } = {}) {
  if (typeof document === 'undefined') { onDone({}); return null; }
  const el = document.createElement('div');
  el.id = 'prologue';
  el.className = `prologue2${reduced ? ' reduced' : ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Prologue');
  el.innerHTML = `<canvas class="px pro-canvas" aria-hidden="true"></canvas>
    <div class="pro-hud"><div class="pro-who"><b>Héros</b> <span class="num">Niv. 60</span><i class="pro-hp"><i></i></i></div>
      <div class="pro-cboss hidden"><b>Colosse des Anciens</b><i class="pro-bhp"><i></i></i></div></div>
    <div class="pro-dialog" aria-live="polite"><p></p></div>
    <div class="pro-actions">
      <button class="pro-act pro-skill hidden" type="button" data-act="skill">⚔ Frappe</button>
      <button class="pro-act pro-heal hidden" type="button" data-act="priestess">✚ Soin</button>
      <button class="pro-act pro-fire hidden" type="button" data-act="pyromancer">🔥 Flammes</button>
    </div>
    <div class="pro-white"></div>
    <div class="pro-rebirth hidden"><div class="pro-stars"></div><div class="pro-circle"></div><div class="pro-entity"></div>
      <p class="pro-voice"></p><div class="pro-choice hidden"></div></div>
    <button class="btn small pro-skip" type="button">Passer ⏭</button>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  const canvas = q('.pro-canvas');
  const rng = new Rng(7);
  let t = 0, last = performance.now(), raf = 0, finished = false, shownDialog = -1;
  let world = null, state = null, r = null, wb = null, fight = null, pressed = 0;
  const fired = new Set();
  const once = (key, fn) => { if (!fired.has(key)) { fired.add(key); fn(); } };

  // Cadre : en portrait (téléphone), la scène est rendue comme sur PC puis réduite (même règle que le World Boss).
  const fit = () => {
    const w = el.clientWidth, h = el.clientHeight;
    const scene = wb?.r ?? r;
    if (!scene) return;
    if (w < h) {
      const vw = 900, vh = Math.min(840, Math.round((h * 0.5 * vw) / w));
      scene.resize(vw, vh);
      const k = w / vw;
      canvas.style.transform = `scale(${k})`;
      canvas.style.transformOrigin = '0 0';
      canvas.style.top = `${Math.round(Math.max(110, (h - vh * k) / 2 - 40))}px`;
      canvas.style.left = '0';
    } else {
      scene.resize(w, h);
      canvas.style.transform = '';
      canvas.style.top = '0';
      canvas.style.left = '0';
    }
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(el);

  // Scène 1 : combat ordinaire (deux vagues faibles), héros immortel.
  try {
    state = heroState(game ?? {});
    world = createCombat(state);
    r = new SceneRenderer(canvas);
    r.calm = reduced;
    fit();
  } catch (e) { console.warn('prologue', e); finishAll({}); return null; }

  // Scènes 2 à 4 : le Colosse (moteur du World Boss, mais attaques et paliers écrits par ce script).
  function startColossus() {
    const s = heroState(game ?? {});
    fight = new WorldBossFight(s, { seed: 3, maxHp: 1e15 });
    fight.nextAbility = Infinity; // attaques propres : seulement celles du script
    fight.run.zone = ZONES.findIndex((z) => z.id === 'cursed');
    wb = new WorldBossScene(canvas, fight, { calm: reduced });
    fit();
  }
  const push = (ev) => fight?.out.push({ damage: 0, ...ev });

  function act(kind) {
    pressed += 1;
    if (kind === 'skill') {
      const tgt = wb ? fight.state : state;
      tgt.skillAuto = true; // une seule salve : remis à false au pas suivant
      const w = wb ? fight.world : world;
      for (const k of Object.keys(w.skillTimers ?? {})) w.skillTimers[k] = 0;
      el.classList.add('pro-pressed');
      setTimeout(() => el.classList.remove('pro-pressed'), 300);
    } else if (wb) {
      fight.world.events.push({ type: 'companionSkill', companionId: kind, skill: 0, skillType: kind === 'priestess' ? 'heal' : 'burst', time: fight.world.time });
    }
  }
  el.querySelectorAll('.pro-act').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); act(b.dataset.act); b.classList.add('used'); setTimeout(() => b.classList.remove('used'), 2500); }));

  function script(s) {
    // Entrée des renforts (scène 3), chute des compagnonnes et bris d'équipement (scène 4) : sur l'état du combat.
    if (!fight) return;
    const fs = fight.state;
    if (s.allies > 0) once('allies', () => {
      for (const id of ['priestess', 'pyromancer']) fs.companions.owned[id] = { stars: 3, level: 30 };
      fs.companions.equipped = ['priestess', 'pyromancer'];
      fight.team = fs.companions.equipped.slice();
    });
    s.allyDown.forEach((down, i) => down && once(`fall${i}`, () => {
      const id = ['priestess', 'pyromancer'][i];
      fs.companions.equipped = fs.companions.equipped.filter((x) => x !== id);
      wb.r.shake = Math.max(wb.r.shake, 5);
      wb.r.burst(80 - i * 26, wb.r.groundY - 14, '#ffffff', 14, 60);
    }));
    ['weapon', 'helmet', 'armor'].forEach((slot, i) => GEAR_BREAK[i] <= s.t && once(`gear${i}`, () => {
      fs.equipment[slot] = null;
      wb.r.burst(84, wb.r.groundY - 24, '#c9d4e8', 16, 70);
      wb.r.shake = Math.max(wb.r.shake, 4);
    }));
    for (const at of ROCKS) if (s.t >= at) once(`rock${at}`, () => push({ type: 'ability', id: 'boulder', name: 'Jet de pierre' }));
    for (const at of PUNCH) if (s.t >= at) once(`punch${at}`, () => { wb.play('attack'); wb.heroHurt({ damage: 0 }, 0.45, 7); });
    if (s.t >= SCENES.rage) once('rage', () => { fight.phase = 3; push({ type: 'phase', id: 'fury', phase: 3 }); });
    if (s.t >= BEAM) once('beam', () => push({ type: 'ability', id: 'eyebeam', name: 'Regard brûlant' }));
    if (s.t >= BEAM + 6) once('beam2', () => push({ type: 'ability', id: 'eyebeam', name: 'Regard brûlant' }));
    if (s.t >= LAST_HIT - 0.6) once('last', () => { wb.play('attack3'); wb.heroHurt({ damage: 0 }, 0.4, 10); });
    // Paliers de vie : le moteur ne décide rien (héros jamais mort, Colosse immortel), le script fixe la barre.
    const hero = fight.world.hero;
    const max = fight.world.heroStats?.maxHp ?? hero.hp;
    hero.dead = false;
    hero.hp = Math.max(1, (max * s.heroHp) / 100);
  }

  function frameCombat(dt, s) {
    if (s.scene === 'march') {
      state.skillAuto = false;
      step(state, world, dt, rng);
      const max = world.heroStats?.maxHp ?? world.hero.hp;
      world.hero.dead = false; world.hero.hp = max;
      r.render(state, world, dt);
      if (state.skillAuto) state.skillAuto = false;
    } else {
      if (!wb) startColossus();
      script(s);
      fight.state.skillAuto = false;
      fight.tick();
      wb.frame(dt);
    }
  }

  function render(s) {
    q('.pro-hp > i').style.width = `${s.heroHp}%`;
    q('.pro-cboss').classList.toggle('hidden', s.scene === 'march' || s.scene === 'rebirth');
    q('.pro-bhp > i').style.width = `${s.bossHp}%`;
    q('.pro-skill').classList.toggle('hidden', !s.skillPrompt);
    q('.pro-heal').classList.toggle('hidden', !s.allyPrompt);
    q('.pro-fire').classList.toggle('hidden', !s.allyPrompt);
    if (s.shake && !reduced) { const sc = wb?.r ?? r; sc.shake = Math.max(sc.shake ?? 0, 4); } // secousse du moteur (le canvas garde son échelle)
    el.classList.toggle('rage', s.scene === 'rage');
    q('.pro-white').style.opacity = String(s.white);
    if (s.dialog !== shownDialog && s.dialog >= 0) {
      shownDialog = s.dialog;
      const p = q('.pro-dialog p');
      p.textContent = PROLOGUE_LINES[s.dialog][1];
      q('.pro-dialog').classList.remove('pop'); void q('.pro-dialog').offsetWidth; q('.pro-dialog').classList.add('pop');
    }
  }

  // Scène 5 : espace hors du monde, 4 répliques, puis un seul choix (bénédiction, nom facultatif).
  function rebirth() {
    if (fired.has('rebirth')) return;
    fired.add('rebirth');
    cancelAnimationFrame(raf);
    ro?.disconnect();
    el.classList.add('in-rebirth');
    const box = q('.pro-rebirth');
    box.classList.remove('hidden');
    q('.pro-dialog').classList.add('hidden');
    q('.pro-actions').classList.add('hidden');
    let i = 0;
    const voice = q('.pro-voice');
    const next = () => {
      if (i < REBIRTH_LINES.length) {
        voice.textContent = REBIRTH_LINES[i++];
        voice.classList.remove('pop'); void voice.offsetWidth; voice.classList.add('pop');
        timer = setTimeout(next, reduced ? 1800 : 3600);
        return;
      }
      showChoice();
    };
    let timer = setTimeout(next, 700);
    box.addEventListener('click', (e) => { if (e.target.closest('.pro-choice')) return; clearTimeout(timer); next(); });
  }
  function showChoice() {
    const c = q('.pro-choice');
    if (!c.classList.contains('hidden')) return;
    q('.pro-voice').textContent = 'Choisis ce que tu emportes dans ta nouvelle vie.';
    c.innerHTML = `<div class="pro-bless">${Object.entries(BLESSINGS).map(([id, b]) => `<button class="pro-b" type="button" data-b="${id}"><b>${escapeHtml(b.label)}</b><small>${escapeHtml(b.text)}</small></button>`).join('')}</div>
      <label class="pro-name">Ton nom (facultatif) <input type="text" maxlength="16" autocomplete="off" spellcheck="false"></label>`;
    c.classList.remove('hidden');
    c.querySelectorAll('.pro-b').forEach((b) => b.addEventListener('click', () => {
      const name = c.querySelector('input').value.trim().replace(/[<>]/g, '').slice(0, 16);
      el.classList.add('light');
      setTimeout(() => finishAll({ blessing: b.dataset.b, name }), reduced ? 200 : 1400);
    }));
    c.querySelector('.pro-b')?.focus({ preventScroll: true });
  }

  function finishAll(choice) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
    onDone(choice);
  }

  // « Passer » : va directement au choix de la réincarnation (une seule fois), puis termine.
  q('.pro-skip').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!fired.has('rebirth')) { rebirth(); showChoice(); } else if (q('.pro-choice').classList.contains('hidden')) showChoice(); else finishAll({});
  });
  // Un appui sur la scène : réplique suivante.
  el.addEventListener('click', (e) => {
    if (fired.has('rebirth') || e.target.closest('button, input, label')) return;
    const nxt = PROLOGUE_LINES.find(([at]) => at > t + 0.05);
    if (nxt && nxt[0] - t < 8) t = nxt[0];
  });

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    const s = prologueState(t);
    // Sans action du joueur, la compétence part seule (jamais bloquant).
    if (s.skillPrompt && t > 12 && pressed === 0) once('autoSkill', () => act('skill'));
    if (s.scene === 'rebirth') { rebirth(); return; }
    try { frameCombat(dt, s); } catch (err) { console.warn('prologue', err); rebirth(); return; }
    render(s);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { finish: () => finishAll({}), el, skipTo: (x) => { t = x; } };
}
