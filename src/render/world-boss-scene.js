// v9.2.9 : scène du World Boss. Comme la vitrine (showcase-scene.js), rien n'est redessiné ici : un SceneRenderer
// (scene.js, le vrai rendu du combat) dessine le monde du boss, le héros, l'équipe, le familier, le boss géant et tous
// les effets ; il reçoit les événements du VRAI moteur de combat (core/combat.js via core/world-boss.js).
// Ce module ajoute seulement ce qui est propre au World Boss : attaques spéciales des phases, aura qui change à
// chaque phase, Éveil (barre vidée), et la barre du boss dans la scène ramenée aux PV « virtuels ».
// « Réduire les animations » : renderer calme (pas de secousses, effets sobres) ; l'interface (ui/world-boss.js)
// joue alors la tentative d'un coup et ne montre qu'une image fixe.
import { SceneRenderer, WORLD_SCALE } from './scene.js';
import { BALANCE } from '../data/balance.js';
import { formatNumber } from '../core/format.js';
import { vfx } from './vfx.js';
import { WORLD_BOSS } from '../core/world-boss.js';

// Couleurs de l'aura selon la phase (0 = avant la première phase).
// Décalage à l'écran du boss géant (unités du monde de la simulation).
const BOSS_OFFSET = 34;

export const PHASE_COLORS = ['#ffb347', '#ff8a3d', '#ff5a3d', '#ff2a4a'];

export class WorldBossScene {
  constructor(canvas, fight, { calm = false } = {}) {
    this.canvas = canvas;
    this.fight = fight;
    this.r = new SceneRenderer(canvas);
    this.r.calm = calm;
    this.seen = 0;
    this.auraAt = 0;
    this.flashEnd = 0;
    this.clock = 0;
    this.noFlashUntil = 0;
  }

  resize(w, h) { this.r.resize(w, h); }

  // Position à l'écran du boss (pixels logiques de la scène), d'après sa dernière image dessinée.
  bossBox() {
    const b = this.fight.boss;
    const fx = b && this.r.enemyFx.get(b.id);
    if (!fx?.sw) return null;
    return { x: fx.sx + fx.sw / 2, y: fx.sy + fx.sh * 0.45, top: fx.sy, w: fx.sw, h: fx.sh, foot: this.r.groundY };
  }

  // Un pas d'affichage : événements du moteur → renderer ; événements du World Boss → effets ; puis dessin.
  frame(dt) {
    const { fight, r } = this;
    const world = fight.world;
    const boss = fight.boss;
    this.clock += dt;
    // Le boss géant déborde vers la gauche de son point d'appui : à l'écran il se tient un peu plus loin (le moteur,
    // lui, garde sa vraie position ; les événements qui le visent sont décalés d'autant).
    const off = boss ? BOSS_OFFSET : 0;
    if (boss) { boss.x += off; boss.prevX = (boss.prevX ?? boss.x) + off; }
    for (const e of world.events) {
      if (off && e.enemyId === boss.id && e.x !== undefined) e.x += off;
      if (off && e.targets) for (const t of e.targets) if (t.id === boss.id) t.x += off;
      r.handleEvent(e, world);
    }
    world.events.length = 0;
    while (this.seen < fight.out.length) this.special(fight.out[this.seen++]);
    this.aura(dt);
    this.limitFlash(boss);
    // Barre du boss dans la scène : PV virtuels de la barre en cours (le moteur, lui, le garde immortel).
    const keep = boss ? [boss.hp, boss.maxHp] : null;
    if (boss) { boss.maxHp = 1000; boss.hp = Math.max(1, 1000 * fight.progress().frac); }
    r.render(fight.state, world, dt);
    if (boss) { [boss.hp, boss.maxHp] = keep; boss.x -= off; boss.prevX -= off; }
  }

  // Toute l'équipe frappe sans arrêt : l'éclair blanc du coup reçu resterait allumé (boss tout blanc). Un éclair
  // bref (2 images) au plus toutes les 0,9 s.
  limitFlash(boss) {
    const fx = boss && this.r.enemyFx.get(boss.id);
    if (!fx) return;
    const t = this.clock; // horloge propre : l'arrêt sur image des critiques ralentit celle du renderer
    if (t < this.flashEnd) return;
    if (t < this.noFlashUntil) { fx.hit = 0; return; }
    if (fx.hit > 0) { this.flashEnd = t + 0.04; this.noFlashUntil = t + 0.9; }
  }

  // Quelques images sans combat (fin de tentative, image fixe) : les effets retombent, le boss respire.
  settle(n = 30) {
    for (let i = 0; i < n; i++) this.frame(1 / 60);
  }

  aura(dt) {
    const box = this.bossBox();
    const phase = this.fight.phase;
    if (!box || phase === 0) return;
    this.auraAt -= dt;
    if (this.auraAt > 0) return;
    this.auraAt = this.r.focus ? 2.5 : 1.1 - phase * 0.2;
    const color = PHASE_COLORS[phase];
    vfx(this.r, phase >= 3 ? 'boss_rage' : 'buff_aura', box.x, box.foot, { tint: color, size: 1.4 + phase * 0.35, alpha: 0.55 });
    if (phase >= 2) this.r.burst(box.x, box.top + box.h * 0.3, color, 4 + phase * 2, 40);
  }

  // Attaques spéciales des phases et Éveil.
  special(ev) {
    const r = this.r;
    const box = this.bossBox() ?? { x: r.width * 0.7, y: r.groundY - 50, top: r.groundY - 100, w: 80, h: 100, foot: r.groundY };
    const heroX = BALANCE.world.heroX * WORLD_SCALE;
    const hurt = (delay) => r.later(delay, () => {
      r.hero.hurt = 0.3;
      vfx(r, 'hit_blunt', heroX + 8, r.groundY - 20, { size: 1.3, flip: true });
      r.addText(formatNumber(Math.round(ev.damage)), heroX - 4, r.groundY - 54, '#ff5a5a', '#ffd0d0', true);
      r.shake = Math.max(r.shake, 5);
    });
    const color = PHASE_COLORS[ev.phase ?? 3];
    if (ev.type === 'awaken') {
      vfx(r, 'boss_explode', box.x, box.y, { size: 2.2 });
      r.later(0.5, () => vfx(r, 'boss_appear', box.x, box.foot + 2, { size: 2 }));
      r.effects.push({ kind: 'beam', x: Math.round(box.x), color: '#ffd23f', life: 1.2, max: 1.2, wide: true });
      r.burst(box.x, box.y, '#ffd23f', 30, 80);
      r.shake = Math.max(r.shake, 6);
      return;
    }
    vfx(r, 'boss_rage', box.x, box.foot, { size: 2.4, tint: color });
    r.burst(box.x, box.top + 10, color, 24, 70);
    if (ev.id === 'quake') {
      // Séisme : le boss frappe le sol, l'onde court jusqu'au héros.
      for (let i = 0; i < 5; i++) {
        const x = box.x - (box.x - heroX) * (i / 4);
        r.later(0.15 + i * 0.09, () => { vfx(r, 'mut_stomp', x, r.groundY, { size: 1.6 }); vfx(r, 'dust_land', x, r.groundY, { size: 1.5 }); });
      }
      hurt(0.6);
    } else if (ev.id === 'meteors') {
      // Pluie de braises : météores sur toute l'équipe.
      for (let i = 0; i < 6; i++) r.later(0.1 + i * 0.12, () => vfx(r, 'sk_meteor', heroX - 40 + i * 22, r.groundY, { size: 1.2, tint: color }));
      hurt(0.7);
    } else {
      // Fureur : colonne de feu infernal sur le héros, le boss devient rouge vif et frappe plus vite.
      r.effects.push({ kind: 'beam', x: heroX, color: '#ff2a4a', life: 1, max: 1, wide: true });
      r.later(0.2, () => vfx(r, 'sk_hellfire', heroX + 6, r.groundY, { size: 1.6 }));
      hurt(0.45);
    }
  }
}

export const worldBossSeconds = () => WORLD_BOSS.seconds;
