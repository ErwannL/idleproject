// v9.0.6 : attaques de classe — arc et flèches, arbalète, boules de feu et météore, éclairs en chaîne, âmes,
// estoc du lancier, fente du berserker, lumière du paladin, pas de l'ombre de l'assassin.
// Étape 6 : sorti de scene.js (plus de 1 300 lignes). La méthode est ajoutée au prototype de SceneRenderer
// (`this` reste la scène) ; les constantes de mise en scène sont transmises par installClassFx.
export function installClassFx(proto, { HERO_X, ATTACK_TIME, CAST_TIME }) {
  const methods = {
    classAttack(event) {
      const G = this.groundY;
      const hx = HERO_X + 10;
      const hy = G - 19;
      const tx = event.x;
      const id = event.enemyId;
      const others = (event.targets ?? []).map((t) => ({ ...t, x: this.wx(t.x) }));
      const crit = event.crit;
      const react = (x, y, color, opts = {}) => this.hitReact(id, x, { crit, boss: event.boss, damage: event.damage, color, y, ...opts });
      const splash = (color, delay = 0) => others.forEach((t, i) => this.later(delay + i * 0.03, () => this.hitReact(t.id, t.x, { color })));
      switch (event.kind) {
        case 'arrow': {
          this.hero.shoot = ATTACK_TIME;
          const fire = crit;
          const time = Math.max(0.1, (tx - hx) / 380);
          this.projectile(fire ? ['fx_arrow_fire1', 'fx_arrow_fire2'] : ['fx_arrow'], hx, hy, tx, G - 12, time, {
            arc: 5, targetId: id, trail: fire ? ['#ffb43a', '#ff6a1a', '#ffe08a'] : ['#e8e0c8'], trailVy: fire ? -14 : 0,
            onHit: (x, y) => {
              react(x, y, fire ? '#ffb43a' : '#e8e0c8');
              // La flèche se plante dans la cible (et tombe si elle meurt).
              const fx = this.enemyFx.get(id);
              if (fx) this.effects.push({ kind: 'stuck', frame: fire ? 'fx_arrow_fire1' : 'fx_arrow', targetId: id, ox: x - fx.sx, oy: y - fx.sy, x, y, life: 0.6, max: 0.6 });
              if (fire) this.burst(x, y, '#ff7a2a', 6, 40);
            },
          });
          if (event.special === 'volley') {
            // Pluie de flèches : une gerbe tirée vers le ciel, puis des flèches qui retombent sur chaque cible.
            for (let i = 0; i < 4; i++) this.projectile(['fx_arrow'], hx, hy, hx + 26 + i * 6, -10, 0.2, { delay: 0.04 * i, rotate: 3, trail: ['#e8e0c8'], trailVy: 0 });
            const spots = [{ id, x: tx }, ...others];
            spots.forEach((t, i) => {
              for (let j = 0; j < 3; j++) {
                const x = t.x - 6 + j * 6;
                this.projectile(['fx_arrow'], x - 14, -20, x, G - 4, 0.28, { delay: 0.32 + i * 0.07 + j * 0.05, rotate: 1, trail: ['#e8e0c8'], trailVy: 0,
                  onHit: () => { this.sprite(['fx_spark'], x, G, 0.15); this.dust(x, 2); if (j === 1) this.hitReact(t.id, t.x, { color: '#e8e0c8' }); } });
              }
            });
          }
          break;
        }
        case 'bolt': {
          this.hero.aim = ATTACK_TIME;
          const time = Math.max(0.06, (tx - hx) / 650);
          this.projectile(['fx_bolt'], hx + 4, G - 21, tx, G - 21, time, {
            targetId: id, trail: ['#c8a070'], trailVy: 0,
            onHit: (x, y) => {
              react(x, y, '#e8d0a8');
              // Le carreau transperce : une ligne file à travers toute la file d'ennemis.
              const far = others.length ? Math.max(...others.map((t) => t.x)) + 16 : x + 20;
              this.effects.push({ kind: 'streak', x0: x, x1: far, y: y, color: '#fff2d8', life: 0.14, max: 0.14 });
              splash('#e8d0a8', 0.02);
            },
          });
          this.shake = Math.max(this.shake, 1);
          break;
        }
        case 'fireball': {
          this.hero.cast = CAST_TIME;
          const time = Math.max(0.14, (tx - hx) / 240);
          this.projectile(['fx_fireball1', 'fx_fireball2'], hx + 2, hy - 6, tx, G - 10, time, {
            arc: 10, targetId: id, trail: ['#ffb43a', '#ff6a1a', '#ff3a1a', '#ffe08a'], trailVy: -16,
            onHit: (x, y) => {
              react(x, y, '#ffb43a');
              this.sprite(['fx_burst'], x + 4, G + 2, 0.35, { tint: '#ff7a2a' });
              this.burst(x + 4, y, '#ff8a3a', 10, 55);
              this.shake = Math.max(this.shake, 1.5);
              splash('#ffb43a', 0.03);
            },
          });
          if (event.special === 'meteor') {
            const mx = others.length ? (tx + Math.max(...others.map((t) => t.x))) / 2 : tx;
            this.projectile(['fx_meteor'], mx - 70, -16, mx, G - 4, 0.5, {
              delay: 0.12, trail: ['#ff6a1a', '#ffb43a', '#5a3a2a'], trailVy: -6,
              onHit: () => {
                this.sprite(['fx_burst'], mx, G + 4, 0.5, { tint: '#ff4a1a' });
                this.sprite(['fx_burst'], mx - 16, G + 2, 0.4, { tint: '#ffb43a' });
                this.sprite(['fx_burst'], mx + 16, G + 2, 0.4, { tint: '#ffb43a' });
                this.burst(mx, G - 6, '#ff6a1a', 18, 80);
                this.dust(mx, 8);
                this.shake = Math.max(this.shake, 4);
                this.hitReact(id, tx, { color: '#ff6a1a' });
                splash('#ff6a1a');
              },
            });
          }
          break;
        }
        case 'lightning': {
          this.hero.cast = CAST_TIME;
          const pts = [{ x: hx + 4, y: hy - 8 }, { x: tx, y: G - 12 }, ...others.map((t) => ({ x: t.x, y: G - 12 }))];
          this.effects.push({ kind: 'zap', pts, life: 0.22, max: 0.22, color: '#e8f8ff' });
          this.effects.push({ kind: 'flash', color: '#bfe8ff', life: 0.08, max: 0.08 });
          react(tx - 4, G - 12, '#9fe0ff', { element: 'thunder' }); // v9.1.9 : étincelles de foudre
          splash('#9fe0ff', 0.04);
          break;
        }
        case 'soul': {
          this.hero.cast = CAST_TIME;
          const time = Math.max(0.18, (tx - hx) / 190);
          this.projectile(['fx_soul1', 'fx_soul2'], hx, hy - 4, tx, G - 12, time, {
            arc: -8, targetId: id, trail: ['#5fe0a0', '#2a8a6a', '#bfffe0'], trailVy: -6,
            onHit: (x, y) => {
              react(x, y, '#5fe0a0');
              this.sprite(['fx_burst'], x + 4, G + 2, 0.3, { tint: '#5fe0a0' });
              // Vol de vie : une petite traînée verte revient vers le héros.
              for (let i = 0; i < 4; i++) this.projectile(['fx_spark'], x, y, HERO_X, G - 20, 0.35, { delay: 0.05 + i * 0.05, arc: 10 });
              splash('#5fe0a0', 0.03);
            },
          });
          break;
        }
        case 'thrust': {
          this.hero.dash = ATTACK_TIME;
          this.hero.dashTo = tx;
          this.dust(HERO_X - 4, 2);
          const far = others.length ? Math.max(...others.map((t) => t.x)) : tx;
          this.effects.push({ kind: 'streak', x0: hx + 16, x1: far + 6, y: G - 18, color: '#cfefff', life: 0.24, max: 0.16 });
          this.later(0.09, () => { react(tx, null, '#cfefff'); splash('#cfefff', 0.02); });
          break;
        }
        case 'cleave': {
          this.hero.dash = ATTACK_TIME;
          this.hero.dashTo = tx;
          this.dust(HERO_X - 4, 4);
          const sx = this.dashReach(tx);
          this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], HERO_X + 16 + sx, G + 3, 0.22, { delay: 0.07, tint: '#ff4a3a' });
          if (crit) this.sprite(['fx_slash_crit'], HERO_X + 18 + sx, G + 4, 0.22, { delay: 0.1, tint: '#ff7a3a' });
          for (const t of others) this.sprite(['fx_slash2', 'fx_slash3'], t.x - 4, G + 1, 0.16, { delay: 0.12, tint: '#ff4a3a' });
          this.later(0.1, () => { react(tx, null, '#ff7a5a'); splash('#ff7a5a'); this.shake = Math.max(this.shake, 1.5); });
          break;
        }
        case 'smite': {
          this.hero.dash = ATTACK_TIME;
          this.hero.dashTo = tx;
          this.dust(HERO_X - 4, 3);
          const sx = this.dashReach(tx);
          this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], HERO_X + 14 + sx, G + 1, 0.2, { delay: 0.07, tint: '#ffe27a' });
          this.later(0.1, () => {
            this.effects.push({ kind: 'beam', x: Math.round(tx), color: '#fff2a8', life: 0.35, max: 0.35, wide: false });
            react(tx, null, '#ffe27a');
            splash('#ffe27a');
          });
          break;
        }
        case 'shadow': {
          // Pas de l'ombre : le héros surgit contre sa cible, laissant des images rémanentes violettes.
          this.hero.dash = ATTACK_TIME;
          this.hero.dashTo = tx;
          this.hero.shadow = ATTACK_TIME;
          const sx = this.dashReach(tx);
          this.sprite(['fx_slash2', 'fx_slash3'], HERO_X + 16 + sx, G + 1, 0.12, { delay: 0.04, tint: '#b07bff' });
          this.sprite(['fx_slash1', 'fx_slash3'], HERO_X + 18 + sx, G - 2, 0.12, { delay: 0.12, tint: crit ? '#ffd23f' : '#d8b8ff' });
          this.later(0.06, () => this.hitReact(id, tx, { crit: false, color: '#c8a0ff' }));
          this.later(0.14, () => react(tx, null, '#c8a0ff'));
          break;
        }
        default:
          this.sprite(['fx_slash1', 'fx_slash2', 'fx_slash3'], HERO_X + 14, G + 1, 0.18, { delay: 0.07 });
          this.later(0.09, () => react(tx, null, '#ffffff'));
      }
    },
  };
  Object.assign(proto, methods);
}
