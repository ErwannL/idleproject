// Liaison entre le jeu et le moteur audio : réglages mémorisés, effets selon les événements
// du combat, ambiance musicale selon le monde (boss, donjon) et pas du chevalier.
import { BOSSES } from '../data/enemies.js';
import { createAudio } from './audio.js';

const KEY = 'idle-rpg.audio';
const DEFAULTS = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function createGameAudio() {
  const audio = createAudio();
  const settings = loadSettings();
  for (const k of ['master', 'music', 'sfx']) audio.setVolume(k, settings[k]);
  audio.setMuted(settings.muted);
  let scene = '';
  let stepTimer = 0;

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* stockage indisponible */ }
  };

  return {
    settings,
    unlock: () => audio.unlock(),
    play: (name, opts) => audio.play(name, opts),
    setVolume(kind, v) {
      settings[kind] = v;
      audio.setVolume(kind, v);
      save();
    },
    setMuted(on) {
      settings.muted = on;
      audio.setMuted(on);
      save();
    },
    suspend: () => audio.suspend(),
    resume: () => audio.resume(),

    // Effets sonores selon les événements de la simulation.
    handleEvent(event) {
      switch (event.type) {
        case 'heroAttack': audio.play(event.crit ? 'crit' : 'hit'); break;
        case 'phantomHit': audio.play('hit', { volume: 0.4 }); break;
        case 'heroHit': audio.play('enemyHit', { volume: 0.7 }); break;
        case 'kill': audio.play('kill'); audio.play('coin'); break;
        case 'drop': audio.play('loot', { rarity: event.item.rarity }); break;
        case 'gems': audio.play('claim', { volume: 0.6 }); break;
        case 'levelUp': audio.play('levelUp'); break;
        case 'bossSpawn': audio.play('bossSpawn', { volume: (BOSSES[event.kind]?.tier ?? 'mega') === 'mega' ? 1 : 0.7 }); break;
        case 'bossDefeated': audio.play('bossDefeated'); break;
        case 'skill': case 'companionSkill': audio.play('skill'); break;
        case 'rushStart': audio.play('boost'); break;
        default: break;
      }
    },

    // Ambiance (monde, boss, donjon) et bruits de pas pendant la marche.
    update(state, world, zoneIndex, dt) {
      const berserk = world.enemies.some((e) => e.berserk);
      const mode = state.dungeon ? 'dungeon' : berserk ? 'berserk' : world.enemies.some((e) => e.boss) ? 'boss' : 'normal';
      // Mondes 7 à 11 : ambiance la plus proche parmi les 6 thèmes musicaux.
      const theme = [0, 1, 2, 3, 4, 5, 1, 0, 5, 2, 5][zoneIndex] ?? 0;
      const key = `${theme}|${mode}`;
      if (key !== scene) {
        scene = key;
        audio.setScene({ world: theme, mode });
      }
      if (world.hero.walking && !world.hero.dead) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          stepTimer = 0.36;
          audio.play('step', { volume: 0.35 });
        }
      }
    },
  };
}
