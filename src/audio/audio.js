// Moteur audio 100 % procédural (Web Audio API) : musique lo-fi générative par monde et effets synthétisés.
// Aucun fichier externe. Sans Web Audio (Node, tests), toutes les méthodes deviennent des no-op.
// Rien n'est créé ni joué avant unlock() (premier geste utilisateur).
import { Rng } from '../core/rng.js';

export const SFX_NAMES = [
  'hit', 'crit', 'enemyHit', 'kill', 'coin', 'loot', 'levelUp', 'bossSpawn', 'bossDefeated',
  'skill', 'summon', 'click', 'claim', 'step', 'wing', 'boost', 'upgrade', 'error', 'bossHit',
  'bubble', // v9.2.0 (monde marin)
  'chestBell', // v10.4 : cloche du coffre de butin (objet Légendaire)
];

const RARITY_LEVEL = { common: 0, rare: 1, epic: 2, legendary: 3 };
const LOOKAHEAD = 0.25; // secondes programmées à l'avance
const TICK_MS = 50; // période de l'ordonnanceur
const FADE_OUT = 1.1;
const FADE_IN = 2.2;
const MUSIC_BASE = 0.6;
const SFX_BASE = 0.9;
const MIN = 0.0001;

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Courbe perceptive : 0.5 sonne à peu près « deux fois moins fort ».
const curve = (v) => v * v;

function audioContextClass() {
  const g = globalThis;
  return g.AudioContext || g.webkitAudioContext || null;
}

export function rarityLevel(rarity) {
  if (typeof rarity === 'number') return clamp(Math.round(rarity), 0, 3);
  return RARITY_LEVEL[rarity] ?? 0;
}

// --- Harmonie -------------------------------------------------------------------------------

const CHORDS = {
  maj7: [0, 4, 7, 11], maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17], dom9: [0, 4, 7, 10, 14], dom7b9: [0, 4, 7, 10, 13],
  m7b5: [0, 3, 6, 10], sus: [0, 5, 7, 10, 14], mMaj9: [0, 3, 7, 11, 14],
};

const SCALES = {
  majPenta: [0, 2, 4, 7, 9], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], hijaz: [0, 1, 4, 5, 7, 8, 10], minPenta: [0, 3, 5, 7, 10],
  harmMinor: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
};

// Une ambiance par monde : tonalité, tempo, progressions (1 accord par mesure), timbres.
const WORLDS = [
  { // 0 plaines lumineuses : majeur, chaleureux, flûte et kalimba
    key: 53, tempo: 84, scale: 'majPenta', swing: 0.2, cutoff: 3600, crackle: 0.8, pad: 'rhodes',
    leads: ['flute', 'kalimba'], drums: 'lofi', density: 0.42, padGain: 1,
    progs: [
      [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, 'dom9']],
      [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
      [[0, 'maj7'], [5, 'maj9'], [9, 'm7'], [7, 'sus']],
    ],
  },
  { // 1 forêt sombre : dorien, feutré, flûte boisée
    key: 50, tempo: 74, scale: 'dorian', swing: 0.22, cutoff: 2000, crackle: 1, pad: 'both',
    leads: ['flute', 'pluck'], drums: 'sparse', density: 0.32, padGain: 0.9,
    progs: [
      [[0, 'm9'], [5, 'dom9'], [0, 'm9'], [10, 'maj7']],
      [[0, 'm11'], [8, 'maj7'], [3, 'maj9'], [7, 'm7']],
    ],
  },
  { // 2 grottes de cristal : lydien, cloches de verre, écho long
    key: 52, tempo: 78, scale: 'lydian', swing: 0.16, cutoff: 4200, crackle: 0.6, pad: 'both',
    leads: ['bell', 'kalimba'], drums: 'lofi', density: 0.36, padGain: 0.85,
    progs: [
      [[0, 'maj9'], [2, 'add9'], [9, 'm9'], [7, 'maj7']],
      [[0, 'maj7'], [2, 'dom9'], [4, 'm7'], [2, 'add9']],
    ],
  },
  { // 3 désert : couleur hijaz, cordes pincées, shaker
    key: 57, tempo: 82, scale: 'hijaz', swing: 0.14, cutoff: 3000, crackle: 0.9, pad: 'rhodes',
    leads: ['pluck', 'flute'], drums: 'desert', density: 0.4, padGain: 0.9,
    progs: [
      [[0, 'sus'], [1, 'maj7'], [0, 'sus'], [10, 'm7']],
      [[0, 'm9'], [1, 'maj7'], [8, 'maj7'], [7, 'dom7b9']],
    ],
  },
  { // 4 montagnes gelées : mineur aérien, cloches froides, nappe large
    key: 47, tempo: 72, scale: 'minPenta', swing: 0.18, cutoff: 3200, crackle: 0.7, pad: 'pad',
    leads: ['bell', 'flute'], drums: 'sparse', density: 0.3, padGain: 1,
    progs: [
      [[0, 'm9'], [8, 'maj9'], [3, 'maj9'], [10, 'add9']],
      [[0, 'm11'], [5, 'm9'], [8, 'maj7'], [7, 'sus']],
    ],
  },
  { // 5 terres maudites : mineur harmonique, chiptune voilé, sombre
    key: 48, tempo: 76, scale: 'harmMinor', swing: 0.2, cutoff: 1800, crackle: 1.2, pad: 'both',
    leads: ['chip', 'pluck'], drums: 'lofi', density: 0.34, padGain: 0.9,
    progs: [
      [[0, 'm9'], [8, 'maj7'], [5, 'm9'], [7, 'dom7b9']],
      [[0, 'mMaj9'], [5, 'm7'], [1, 'maj7'], [7, 'dom7b9']],
    ],
  },
];

// Variantes de mode : gardent la tonalité du monde mais changent le caractère.
const MODES = {
  boss: {
    tempo: 90, scale: 'phrygian', swing: 0.08, cutoff: 3800, crackle: 0.4, pad: 'pad', leads: ['chip'],
    drums: 'boss', density: 0, arp: true, padGain: 0.8, bass: 'drive',
    progs: [
      [[0, 'm7'], [8, 'maj7'], [10, 'dom9'], [0, 'm7']],
      [[0, 'm9'], [1, 'maj7'], [10, 'm7'], [7, 'dom7b9']],
    ],
  },
  // Monde 11 : méga boss berserk — rapide, harmonique mineure, percussions lourdes, arpèges.
  berserk: {
    tempo: 118, scale: 'harmMinor', swing: 0, cutoff: 4600, crackle: 0.2, pad: 'pad', leads: ['chip'],
    drums: 'boss', density: 0, arp: true, padGain: 0.9, bass: 'drive',
    progs: [
      [[0, 'm7'], [8, 'maj7'], [7, 'dom7b9'], [0, 'm7']],
      [[0, 'm9'], [5, 'm7'], [7, 'dom7b9'], [8, 'maj7']],
    ],
  },
  dungeon: {
    tempo: 70, scale: 'phrygian', swing: 0.2, cutoff: 1600, crackle: 1.1, pad: 'pad', leads: ['kalimba', 'bell'],
    drums: 'dungeon', density: 0.2, padGain: 1, bass: 'hold',
    progs: [
      [[0, 'm9'], [1, 'maj7'], [0, 'm9'], [10, 'm7']],
      [[0, 'm11'], [8, 'maj7'], [1, 'maj7'], [0, 'm9']],
    ],
  },
};

function resolveScene(world, mode) {
  const base = WORLDS[world] ?? WORLDS[0];
  const over = MODES[mode] ?? {};
  // Boss : légèrement plus aigu pour la tension ; donjon : plus grave.
  const key = base.key + (mode === 'dungeon' ? -2 : 0);
  return { bass: 'walk', arp: false, ...base, ...over, key };
}

// --- Moteur (partagé entre temps réel et rendu hors ligne) ---------------------------------

function buildEngine(ctx, { seed = 1, crackle = true } = {}) {
  const rng = new Rng(seed);
  const rnd = () => rng.next();
  const sfxRng = new Rng(seed * 7919 + 13);
  const srnd = () => sfxRng.next();

  // Nœuds utilitaires
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  // t fourni : point d'ancrage pour les rampes de fréquence qui suivent
  const filter = (type, freq, q = 0.7, t = null) => {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (t !== null) f.frequency.setValueAtTime(freq, t);
    return f;
  };
  const osc = (type, freq, t) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); return o;
  };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes.at(-1); };

  // Bruit blanc partagé (2 s)
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const noise = (t, dur) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.start(t, rnd() * 1.5); s.stop(t + dur + 0.02); return s;
  };

  // Enveloppe percussive : attaque linéaire puis décroissance exponentielle.
  const perc = (param, t, peak, attack, decay) => {
    param.setValueAtTime(MIN, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(MIN, t + attack + decay);
  };
  // Voix simple : oscillateur + enveloppe vers dest. Renvoie l'oscillateur (pour glissandos).
  const tone = (type, freq, t, peak, attack, decay, dest, detune = 0) => {
    const o = osc(type, freq, t); o.detune.value = detune;
    const g = gain(0); perc(g.gain, t, peak, attack, decay);
    chain(o, g, dest); o.start(t); o.stop(t + attack + decay + 0.05);
    return o;
  };
  const noiseHit = (t, dur, peak, type, freq, q, dest, attack = 0.002) => {
    const f = filter(type, freq, q, t); const g = gain(0); perc(g.gain, t, peak, attack, dur);
    chain(noise(t, dur + attack), f, g, dest); return f;
  };

  // --- Bus de mixage ---
  // Limiteur doux final : transparent sous 0.6, plafonne vers ~0.9.
  const clip = ctx.createWaveShaper();
  { const n = 2048; const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1; const a = Math.abs(x);
      c[i] = Math.sign(x) * (a <= 0.6 ? a : 0.6 + 0.38 * Math.tanh((a - 0.6) / 0.38));
    }
    clip.curve = c; }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  const master = gain(1);
  chain(master, comp, clip, ctx.destination);

  const musicVol = gain(MUSIC_BASE);
  const sfxVol = gain(SFX_BASE);
  musicVol.connect(master); sfxVol.connect(master);

  // Musique : scène (fondus) -> passe-bas lo-fi -> léger pleurage de bande -> volume musique
  const sceneGain = gain(0);
  const lofi = filter('lowpass', 3000, 0.5);
  const wobble = ctx.createDelay(0.05); wobble.delayTime.value = 0.012;
  { const lfo = osc('sine', 0.45, 0); const depth = gain(0.0014); chain(lfo, depth, wobble.delayTime); lfo.start();
    const flutter = osc('sine', 5.3, 0); const fd = gain(0.00012); chain(flutter, fd, wobble.delayTime); flutter.start(); }
  chain(sceneGain, lofi, wobble, musicVol);

  // Réverbération générée (bruit stéréo à décroissance exponentielle)
  const reverb = ctx.createConvolver();
  { const len = Math.floor(ctx.sampleRate * 2.4); const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.exp((-3.2 * i) / len) * (i < 200 ? i / 200 : 1);
    }
    reverb.buffer = ir; }
  const revIn = gain(0.35); const revLp = filter('lowpass', 4500);
  chain(revIn, reverb, revLp, sceneGain);

  // Pistes musicales
  const padBus = gain(1); const padDuck = gain(1); const padTrem = gain(1);
  { const lfo = osc('sine', 3.6, 0); const d = gain(0.06); chain(lfo, d, padTrem.gain); lfo.start(); }
  chain(padBus, padDuck, padTrem, sceneGain); padTrem.connect(revIn);
  const padFilter = filter('lowpass', 1100, 0.6); padFilter.connect(padBus);
  const bassBus = gain(1); chain(bassBus, filter('lowpass', 520, 0.6), sceneGain);
  const drumBus = gain(0.9); drumBus.connect(sceneGain);
  const leadBus = gain(1); leadBus.connect(sceneGain); leadBus.connect(revIn);
  // Écho du lead (croche pointée), réinjection filtrée
  const echo = ctx.createDelay(2); const echoFb = gain(0.32); const echoLp = filter('lowpass', 2400);
  const echoSend = gain(0.28);
  chain(leadBus, echoSend, echo, echoLp, echoFb, echo); echoLp.connect(sceneGain);

  // Crépitement vinyle : boucle de 4 s (souffle + clics aléatoires), indépendante des fondus de scène
  const crackleGain = gain(0);
  { const len = ctx.sampleRate * 4; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * 0.012;
    const clicks = 26 + Math.floor(rnd() * 10);
    for (let k = 0; k < clicks; k++) {
      const p = Math.floor(rnd() * (len - 64)); const a = (0.15 + rnd() * 0.6) * (rnd() < 0.5 ? -1 : 1);
      for (let j = 0; j < 24; j++) d[p + j] += a * Math.exp(-j / 3);
    }
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    chain(s, filter('highpass', 700), filter('lowpass', 6500), crackleGain, musicVol); s.start(); }

  // Effets : bus avec petit écho pour les carillons
  const sfxBus = gain(1); sfxBus.connect(sfxVol);
  const sfxEcho = ctx.createDelay(1); sfxEcho.delayTime.value = 0.19;
  const sfxEchoFb = gain(0.3); const sfxEchoIn = gain(1); const sfxEchoLp = filter('lowpass', 3500);
  chain(sfxEchoIn, sfxEcho, sfxEchoLp, sfxEchoFb, sfxEcho); sfxEchoLp.connect(sfxBus);

  // --- Instruments ---------------------------------------------------------------------------

  function rhodes(m, t, dur, vel) {
    const f = midiHz(m); const g = gain(0);
    g.gain.setValueAtTime(MIN, t);
    g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.006);
    g.gain.setTargetAtTime(0.018 * vel, t + 0.01, 0.4);
    g.gain.setTargetAtTime(MIN, t + dur, 0.12);
    g.connect(padBus);
    const o = osc('sine', f, t); o.connect(g); o.start(t); o.stop(t + dur + 0.7);
    tone('sine', f * 2, t, 0.014 * vel, 0.004, 0.35, padBus);
    tone('sine', f * 7.02, t, 0.004 * vel, 0.002, 0.07, padBus);
  }

  function pad(m, t, dur, vel) {
    const f = midiHz(m); const g = gain(0);
    g.gain.setValueAtTime(MIN, t);
    g.gain.linearRampToValueAtTime(0.014 * vel, t + 0.45);
    g.gain.setValueAtTime(0.014 * vel, t + dur);
    g.gain.exponentialRampToValueAtTime(MIN, t + dur + 0.9);
    g.connect(padFilter);
    for (const det of [-8, 7]) {
      const o = osc('sawtooth', f, t); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 1);
    }
  }

  function bass(m, t, dur, vel) {
    const f = midiHz(m); const g = gain(0);
    g.gain.setValueAtTime(MIN, t);
    g.gain.linearRampToValueAtTime(0.2 * vel, t + 0.012);
    g.gain.setTargetAtTime(0.13 * vel, t + 0.02, 0.25);
    g.gain.setTargetAtTime(MIN, t + dur, 0.04);
    g.connect(bassBus);
    const o1 = osc('sine', f, t); const o2 = osc('triangle', f, t); const g2 = gain(0.25);
    o1.connect(g); chain(o2, g2, g);
    for (const o of [o1, o2]) { o.start(t); o.stop(t + dur + 0.3); }
  }

  const LEADS = {
    flute(m, t, dur, vel) {
      const f = midiHz(m); const g = gain(0); const len = Math.max(0.12, dur);
      g.gain.setValueAtTime(MIN, t);
      g.gain.linearRampToValueAtTime(0.055 * vel, t + 0.05);
      g.gain.setTargetAtTime(0.04 * vel, t + 0.06, 0.3);
      g.gain.setTargetAtTime(MIN, t + len, 0.07);
      g.connect(leadBus);
      const o = osc('sine', f, t); const o2 = osc('triangle', f * 2, t); const g2 = gain(0.12);
      // vibrato retardé
      const lfo = osc('sine', 5.2, t); const vd = gain(0);
      vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
      chain(lfo, vd, o.frequency); vd.connect(o2.frequency);
      o.connect(g); chain(o2, g2, g);
      for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + 0.4); }
      noiseHit(t, 0.08, 0.012 * vel, 'bandpass', f * 2, 2, leadBus, 0.01); // souffle
    },
    kalimba(m, t, dur, vel) {
      const f = midiHz(m);
      tone('sine', f, t, 0.075 * vel, 0.003, 1.1, leadBus);
      tone('sine', f * 5.95, t, 0.012 * vel, 0.001, 0.06, leadBus);
      tone('triangle', f * 2, t, 0.01 * vel, 0.002, 0.2, leadBus);
    },
    bell(m, t, dur, vel) {
      const f = midiHz(m);
      tone('sine', f, t, 0.04 * vel, 0.002, 1.6, leadBus);
      tone('sine', f * 2.756, t, 0.012 * vel, 0.001, 0.6, leadBus);
      tone('sine', f * 5.404, t, 0.005 * vel, 0.001, 0.22, leadBus);
    },
    chip(m, t, dur, vel) {
      const f = midiHz(m); const len = Math.max(0.08, dur);
      const lp = filter('lowpass', 2400, 0.5); const g = gain(0);
      g.gain.setValueAtTime(MIN, t);
      g.gain.linearRampToValueAtTime(0.022 * vel, t + 0.005);
      g.gain.setTargetAtTime(0.012 * vel, t + 0.01, 0.08);
      g.gain.setTargetAtTime(MIN, t + len, 0.03);
      const o = osc('square', f, t); chain(o, lp, g, leadBus); o.start(t); o.stop(t + len + 0.2);
    },
    pluck(m, t, dur, vel) {
      const f = midiHz(m); const lp = filter('lowpass', f * 6, 1.2, t);
      lp.frequency.setTargetAtTime(f * 1.4, t, 0.08);
      const g = gain(0); perc(g.gain, t, 0.06 * vel, 0.003, 0.7);
      const o = osc('sawtooth', f, t); const o2 = osc('triangle', f * 1.003, t);
      o.connect(lp); o2.connect(lp); chain(lp, g, leadBus);
      for (const x of [o, o2]) { x.start(t); x.stop(t + 0.8); }
    },
  };

  // Batterie lo-fi douce
  function kick(t, vel) {
    const o = osc('sine', 115, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    const g = gain(0); perc(g.gain, t, 0.42 * vel, 0.003, 0.32);
    chain(o, g, drumBus); o.start(t); o.stop(t + 0.4);
    noiseHit(t, 0.012, 0.05 * vel, 'lowpass', 2500, 0.7, drumBus);
    // léger « pompage » des accords
    padDuck.gain.cancelScheduledValues(t);
    padDuck.gain.setValueAtTime(0.72, t);
    padDuck.gain.setTargetAtTime(1, t + 0.02, 0.12);
  }
  function snare(t, vel) {
    noiseHit(t, 0.17, 0.13 * vel, 'bandpass', 1700, 0.7, drumBus, 0.003);
    const o = tone('triangle', 200, t, 0.06 * vel, 0.002, 0.08, drumBus);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  }
  const hat = (t, vel, open) => noiseHit(t, open ? 0.22 : 0.035, 0.045 * vel, 'highpass', 7500, 0.5, drumBus);
  const shaker = (t, vel) => noiseHit(t, 0.05, 0.03 * vel, 'bandpass', 5200, 1.4, drumBus, 0.012);
  const rim = (t, vel) => { tone('triangle', 820, t, 0.05 * vel, 0.001, 0.03, drumBus); noiseHit(t, 0.02, 0.03 * vel, 'bandpass', 2500, 2, drumBus); };
  function tom(t, vel, f) {
    const o = tone('sine', f, t, 0.24 * vel, 0.003, 0.28, drumBus); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.25);
  }

  // Motifs par pas (16 doubles-croches) : [pas, vélocité, probabilité]
  const PATTERNS = {
    lofi: {
      kick: [[0, 1, 1], [7, 0.55, 0.45], [10, 0.85, 0.9]], snare: [[4, 1, 1], [12, 1, 1], [15, 0.25, 0.25]],
      hat: 'eighths',
    },
    sparse: { kick: [[0, 1, 1], [10, 0.6, 0.6]], rim: [[12, 0.8, 1], [4, 0.4, 0.3]], hat: 'offbeat' },
    desert: {
      kick: [[0, 1, 1], [6, 0.5, 0.5], [10, 0.8, 1]], snare: [[12, 0.9, 1]], rim: [[4, 0.6, 0.8]], hat: 'shaker',
    },
    dungeon: { kick: [[0, 0.9, 1], [11, 0.5, 0.5]], rim: [[12, 0.6, 0.8]], hat: 'none' },
    boss: {
      kick: [[0, 1, 1], [3, 0.6, 0.7], [8, 1, 1], [10, 0.75, 0.8]], snare: [[4, 1, 1], [12, 1, 1], [14, 0.3, 0.4]],
      hat: 'sixteenths',
    },
  };

  // --- Séquenceur génératif -------------------------------------------------------------------

  const seq = {
    S: null, world: 0, mode: 'normal', step: 0, bar: 0, nextTime: 0, running: false, pending: null,
    section: null, introBars: 0, lastDeg: null, enabled: true,
  };

  function chordNotes(S, ch) {
    const root = S.key + ch[0];
    let base = root; while (base < 50) base += 12; while (base > 61) base -= 12;
    const notes = CHORDS[ch[1]].map((iv) => base + iv);
    return notes.map((n) => (n > 77 ? n - 12 : n));
  }
  const chordPcs = (S, ch) => new Set(CHORDS[ch[1]].map((iv) => (S.key + ch[0] + iv) % 12));

  function degToMidi(S, deg) {
    const sc = SCALES[S.scale]; const n = sc.length;
    return S.key + 12 * Math.floor(deg / n) + sc[((deg % n) + n) % n];
  }

  // Phrase de 2 mesures : marche majoritairement conjointe, notes d'accord sur les temps forts.
  function genPhrase(S, chords) {
    const n = SCALES[S.scale].length; const lo = n; const hi = 2 * n + 2;
    let deg = seq.lastDeg ?? n + Math.floor(n / 2);
    const ev = [];
    for (let s = 0; s < 32; s += 2) {
      const strong = s % 8 === 0;
      const p = strong ? S.density + 0.22 : S.density * (s % 4 === 0 ? 1 : 0.55);
      if (rnd() > p) continue;
      const r = rnd();
      deg += r < 0.34 ? 1 : r < 0.68 ? -1 : r < 0.8 ? 2 : r < 0.92 ? -2 : (rnd() < 0.5 ? 3 : -3);
      if (deg < lo) deg = lo + (lo - deg); if (deg > hi) deg = hi - (deg - hi);
      if (strong) {
        const pcs = chordPcs(S, chords[s >> 4]);
        for (const d of [0, 1, -1, 2, -2]) if (pcs.has(degToMidi(S, deg + d) % 12)) { deg += d; break; }
      }
      ev.push({ step: s + (!strong && rnd() < 0.15 ? 1 : 0), deg });
    }
    for (let i = 0; i < ev.length; i++) ev[i].len = Math.min(6, (ev[i + 1]?.step ?? 32) - ev[i].step);
    seq.lastDeg = deg;
    return ev;
  }
  const mutate = (ph) => ph.filter(() => rnd() > 0.12).map((e) => (rnd() < 0.2 ? { ...e, deg: e.deg + (rnd() < 0.5 ? 1 : -1) } : e));

  function newSection() {
    const S = seq.S;
    const prog = S.progs[Math.floor(rnd() * S.progs.length)];
    const r = rnd();
    const type = S.drums === 'boss' ? 'full' : r < 0.66 ? 'full' : r < 0.82 ? 'calm' : 'nolead';
    const lead = S.leads[Math.floor(rnd() * S.leads.length)];
    const ch = (b) => prog[b % prog.length];
    let phrases = null;
    if (S.density > 0 && type !== 'nolead') {
      const A = genPhrase(S, [ch(0), ch(1)]); const B = genPhrase(S, [ch(2), ch(3)]);
      const C = genPhrase(S, [ch(6), ch(7)]);
      phrases = [A, B, mutate(A), C];
    }
    seq.section = { prog, type, lead, phrases };
  }

  function applyScene(world, mode) {
    seq.world = world; seq.mode = mode;
    const S = resolveScene(world, mode); seq.S = S;
    seq.step = 0; seq.bar = 0; seq.introBars = 2; seq.lastDeg = null;
    const t = Math.max(ctx.currentTime, seq.nextTime);
    lofi.frequency.setTargetAtTime(S.cutoff, t, 0.3);
    padFilter.frequency.setTargetAtTime(S.cutoff * 0.35, t, 0.3);
    echo.delayTime.setValueAtTime((60 / S.tempo) * 0.75, t);
    padBus.gain.setValueAtTime(S.padGain, t);
    updateCrackle(t);
  }

  function scheduleStep(t, stepDur) {
    const S = seq.S; const s = seq.step; const bar = seq.bar;
    if (s === 0) {
      if (bar % 8 === 0) newSection();
      const sec = seq.section; const ch = sec.prog[bar % sec.prog.length];
      const next = sec.prog[(bar + 1) % sec.prog.length];
      const barDur = stepDur * 16; const notes = chordNotes(S, ch);
      if (S.pad === 'rhodes' || S.pad === 'both') {
        notes.forEach((m, i) => rhodes(m, t + i * 0.012, barDur * 0.62, 0.9));
        if (rnd() < 0.6) notes.slice(1).forEach((m) => rhodes(m, t + stepDur * 10 + stepDur * S.swing, barDur * 0.3, 0.55));
      }
      if (S.pad === 'pad' || S.pad === 'both') notes.forEach((m) => pad(m, t, barDur, S.pad === 'both' ? 0.6 : 1));
      // Basse ronde
      let root = S.key + ch[0]; while (root >= 48) root -= 12; while (root < 36) root += 12;
      if (S.bass === 'hold') bass(root, t, barDur * 0.95, 0.9);
      else if (S.bass === 'drive') {
        for (let k = 0; k < 8; k++) bass(root + (k === 6 ? 12 : 0), t + k * stepDur * 2, stepDur * 1.6, k % 2 ? 0.6 : 0.9);
      } else {
        bass(root, t, stepDur * 6, 1);
        if (rnd() < 0.7) bass(root + (rnd() < 0.5 ? 7 : 12), t + stepDur * 7 + stepDur * S.swing, stepDur * 2.5, 0.7);
        let nr = S.key + next[0]; while (nr >= 48) nr -= 12; while (nr < 36) nr += 12;
        if (rnd() < 0.45) bass(nr + (rnd() < 0.5 ? -1 : 1), t + stepDur * 14, stepDur * 1.8, 0.6);
        else bass(root, t + stepDur * 10, stepDur * 3, 0.75);
      }
    }
    const sec = seq.section; const swingOff = s % 2 ? stepDur * S.swing : 0; const ts = t + swingOff;
    const drums = PATTERNS[S.drums];
    const intro = seq.introBars > 0; const calm = sec.type === 'calm';
    if (!intro && !calm) {
      for (const [st, v, p] of drums.kick ?? []) if (st === s && rnd() < p) kick(ts, v);
      for (const [st, v, p] of drums.snare ?? []) if (st === s && rnd() < p) snare(ts, v);
      for (const [st, v, p] of drums.rim ?? []) if (st === s && rnd() < p) rim(ts, v);
      // Fill de toms en fin de cycle de 4 mesures (boss)
      if (S.drums === 'boss' && bar % 4 === 3 && s >= 12) tom(ts, 0.8, [196, 164, 138, 110][s - 12]);
    }
    if (!intro || seq.introBars === 1) {
      const hv = (s % 4 === 0 ? 0.8 : 0.5) * (0.85 + rnd() * 0.3);
      if (drums.hat === 'eighths' && s % 2 === 0) hat(ts, hv, s === 14 && rnd() < 0.2);
      else if (drums.hat === 'eighths' && rnd() < 0.12) hat(ts, 0.3);
      else if (drums.hat === 'offbeat' && s % 4 === 2) shaker(ts, hv);
      else if (drums.hat === 'shaker' && (s % 2 === 0 || rnd() < 0.5)) shaker(ts, hv * (s % 2 ? 0.6 : 1));
      else if (drums.hat === 'sixteenths') hat(ts, s % 2 ? 0.35 : hv);
    }
    // Arpège tendu (boss) en croches
    if (S.arp && !intro && s % 2 === 0) {
      const notes = chordNotes(S, sec.prog[bar % sec.prog.length]);
      const order = [0, 2, 1, 3, 2, 1, 3, 2];
      LEADS.chip(notes[order[(s / 2) % 8] % notes.length] + 12, ts, stepDur * 1.5, s % 4 ? 0.6 : 0.9);
    }
    // Mélodie
    if (sec.phrases && !intro) {
      const ph = sec.phrases[(bar % 8) >> 1]; const local = (bar % 2) * 16 + s;
      for (const e of ph) if (e.step === local) LEADS[sec.lead](degToMidi(S, e.deg), ts, e.len * stepDur, 0.75 + rnd() * 0.25);
    }
    // Avance
    seq.step++;
    if (seq.step >= 16) { seq.step = 0; seq.bar++; if (seq.introBars > 0) seq.introBars--; }
  }

  // Programme toutes les doubles-croches jusqu'à `until` (temps du contexte), sans dérive :
  // l'horloge est cumulée sur les durées de pas, pas sur le minuteur.
  function scheduleMusic(until) {
    if (!seq.running) return;
    const now = ctx.currentTime;
    if (seq.nextTime < now - 0.05) seq.nextTime = now + 0.05; // minuteur en retard : on resynchronise
    let guard = 0;
    while (seq.nextTime < until && guard++ < 128) {
      if (seq.pending && seq.nextTime >= seq.pending.at) {
        const p = seq.pending; seq.pending = null; applyScene(p.world, p.mode);
      }
      const stepDur = 60 / seq.S.tempo / 4;
      if (seq.enabled) scheduleStep(seq.nextTime, stepDur);
      else { seq.step = (seq.step + 1) % 16; if (seq.step === 0) seq.bar++; }
      seq.nextTime += stepDur;
    }
  }

  function startMusic(world, mode, at) {
    seq.running = true; seq.nextTime = at + 0.05; applyScene(world, mode);
    sceneGain.gain.cancelScheduledValues(at);
    sceneGain.gain.setValueAtTime(MIN, at);
    sceneGain.gain.linearRampToValueAtTime(1, at + FADE_IN);
  }

  // Fondu sortant, bascule de scène à la fin du fondu (au pas suivant), fondu entrant.
  function changeScene(world, mode, now) {
    if (!seq.running) return startMusic(world, mode, now);
    const fast = mode === 'boss' ? 0.5 : 1;
    const at = now + FADE_OUT * fast;
    const g = sceneGain.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    g.linearRampToValueAtTime(MIN, at);
    g.linearRampToValueAtTime(1, at + FADE_IN * fast);
    seq.pending = { world, mode, at };
  }

  // Crépitement : dosé par scène, activable
  let crackleOn = crackle;
  function updateCrackle(t = ctx.currentTime) {
    const amt = crackleOn && seq.S ? 0.22 * seq.S.crackle : 0;
    crackleGain.gain.setTargetAtTime(amt, t, 0.4);
  }

  // --- Effets sonores --------------------------------------------------------------------------

  const vary = (amt = 0.06) => 1 + (srnd() * 2 - 1) * amt;
  // Sortie courante des effets (redirigée le temps d'un appel pour opts.volume)
  let out = sfxBus;

  // Arpège cristallin (cloches) commun à loot/summon/claim/levelUp
  function chime(t, midis, gap, peak, decay = 0.9, echoSend = 0) {
    midis.forEach((m, i) => {
      const f = midiHz(m); const at = t + i * gap; const dest = echoSend ? gain(1) : out;
      if (echoSend) { dest.connect(out); const s = gain(echoSend); chain(dest, s, sfxEchoIn); }
      tone('sine', f, at, peak, 0.002, decay, dest);
      tone('sine', f * 2.756, at, peak * 0.25, 0.001, decay * 0.35, dest);
      tone('triangle', f * 2, at, peak * 0.15, 0.002, decay * 0.2, dest);
    });
  }
  // Scintillement : poussière aiguë aléatoire
  function sparkle(t, count, span, lo, hi, peak) {
    for (let i = 0; i < count; i++) {
      const at = t + srnd() * span; const f = lo + srnd() * (hi - lo);
      tone('sine', f, at, peak * (0.5 + srnd() * 0.5), 0.002, 0.12 + srnd() * 0.15, out);
    }
  }
  function swish(t, dur, from, to, peak, q = 1.2) {
    const f = noiseHit(t, dur, peak, 'bandpass', from, q, out, dur * 0.35);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
  }

  const SFX = {
    hit(t) {
      const p = vary(0.08);
      swish(t, 0.07, 3200 * p, 900 * p, 0.16, 0.9);
      const o = tone('sine', 190 * p, t + 0.01, 0.22, 0.002, 0.09, out); o.frequency.exponentialRampToValueAtTime(80, t + 0.1);
      tone('triangle', 1250 * p, t + 0.01, 0.025, 0.001, 0.05, out);
      return 0.12;
    },
    crit(t) {
      const p = vary(0.05);
      swish(t, 0.08, 4200 * p, 1000, 0.2, 0.8);
      const o = tone('sine', 160 * p, t + 0.012, 0.32, 0.002, 0.16, out); o.frequency.exponentialRampToValueAtTime(55, t + 0.17);
      noiseHit(t + 0.012, 0.06, 0.12, 'lowpass', 1800, 0.7, out);
      for (const r of [1, 1.47, 2.13, 2.9]) tone('sine', 2100 * p * r, t + 0.02, 0.028, 0.001, 0.32, out);
      return 0.38;
    },
    // v9.3.9 (2.3) : coup sur un boss — plus grave et plus lourd (grosse caisse + craquement).
    bossHit(t) {
      const p = vary(0.05);
      swish(t, 0.08, 2400 * p, 600, 0.16, 0.8);
      const o = tone('sine', 110 * p, t + 0.01, 0.38, 0.002, 0.2, out); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
      noiseHit(t + 0.01, 0.1, 0.16, 'lowpass', 900, 0.7, out);
      return 0.26;
    },
    enemyHit(t) {
      const p = vary(0.07);
      const o = tone('sine', 140 * p, t, 0.28, 0.003, 0.14, out); o.frequency.exponentialRampToValueAtTime(55, t + 0.14);
      noiseHit(t, 0.09, 0.12, 'lowpass', 750 * p, 0.8, out);
      const lp = filter('lowpass', 700); const g = gain(0); perc(g.gain, t, 0.05, 0.004, 0.1);
      const sq = osc('square', 115 * p, t); sq.frequency.exponentialRampToValueAtTime(80, t + 0.1);
      chain(sq, lp, g, out); sq.start(t); sq.stop(t + 0.15);
      return 0.16;
    },
    kill(t) {
      const p = vary(0.08);
      const f = noiseHit(t, 0.22, 0.13, 'lowpass', 2600 * p, 0.7, out, 0.01); f.frequency.exponentialRampToValueAtTime(300, t + 0.22);
      const o = tone('triangle', 420 * p, t, 0.08, 0.004, 0.18, out); o.frequency.exponentialRampToValueAtTime(130, t + 0.18);
      tone('sine', 1320 * p, t + 0.12, 0.035, 0.002, 0.1, out);
      tone('sine', 1760 * p, t + 0.17, 0.03, 0.002, 0.12, out);
      return 0.3;
    },
    coin(t, o) {
      const p = vary(0.025); const v = o.spam;
      tone('triangle', 1976 * p, t, 0.05 * v, 0.001, 0.035, out);
      tone('sine', 2637 * p, t + 0.035, 0.06 * v, 0.001, 0.09, out);
      return 0.13;
    },
    loot(t, o) {
      const lvl = rarityLevel(o.rarity); const base = [72, 74, 76, 77][Math.floor(srnd() * 4)];
      if (lvl === 0) { chime(t, [base, base + 7], 0.06, 0.05, 0.35); return 0.45; }
      if (lvl === 1) { chime(t, [base, base + 4, base + 7], 0.055, 0.06, 0.5); sparkle(t + 0.1, 3, 0.2, 3000, 5000, 0.015); return 0.7; }
      if (lvl === 2) {
        chime(t, [base - 5, base, base + 4, base + 7, base + 11], 0.055, 0.06, 0.8, 0.25);
        sparkle(t + 0.15, 7, 0.4, 3000, 6500, 0.016); return 1.1;
      }
      // Légendaire : gong grave, cascade de carillons, accord tenu scintillant
      const g = tone('sine', midiHz(base - 36), t, 0.16, 0.01, 1.6, out); g.frequency.exponentialRampToValueAtTime(midiHz(base - 37), t + 1.6);
      tone('sine', midiHz(base - 36) * 2.4, t, 0.04, 0.01, 0.8, out);
      chime(t + 0.05, [base - 12, base - 5, base, base + 4, base + 7, base + 12, base + 16], 0.07, 0.065, 1.2, 0.35);
      chime(t + 0.6, [base, base + 4, base + 7, base + 11], 0.012, 0.045, 1.8, 0.3);
      sparkle(t + 0.3, 14, 1.2, 3500, 8000, 0.016);
      return 2.4;
    },
    // v10.4 (plan 10.4, partie 5) : cloche du coffre quand un objet Légendaire y tombe : coup de cloche (partiels
    // inharmoniques), carillon qui monte, poussière d'étincelles.
    chestBell(t, o = {}) {
      // v10.8 (3) : cloche plus grave pour Astral (une quinte) et Ascendant (une octave).
      const f = midiHz(o.rarity === 'ascendant' ? 67 : o.rarity === 'astral' ? 72 : 79);
      for (const [r, pk, d] of [[1, 0.17, 2.2], [2.0, 0.08, 1.6], [2.76, 0.07, 1.2], [5.4, 0.035, 0.7], [8.9, 0.02, 0.4]]) tone('sine', f * r, t, pk, 0.002, d, out);
      chime(t + 0.3, [91, 95, 98], 0.09, 0.04, 1.2, 0.3);
      sparkle(t + 0.2, 8, 0.8, 3500, 7500, 0.014);
      return 2.4;
    },
    levelUp(t) {
      const n = [72, 76, 79, 84, 88];
      n.forEach((m, i) => {
        const lp = filter('lowpass', 3000); const g = gain(0); perc(g.gain, t + i * 0.075, 0.035, 0.004, 0.16);
        const o = osc('square', midiHz(m), t); chain(o, lp, g, out); o.start(t + i * 0.075); o.stop(t + i * 0.075 + 0.2);
      });
      chime(t + 0.38, [84, 88, 91, 96], 0.01, 0.05, 1, 0.25);
      sparkle(t + 0.4, 6, 0.5, 3000, 6000, 0.014);
      return 1.4;
    },
    bossSpawn(t) {
      // grondement
      const f = noiseHit(t, 1.6, 0.35, 'lowpass', 140, 1.5, out, 0.6); f.frequency.linearRampToValueAtTime(80, t + 2);
      const s = tone('sine', 48, t, 0.3, 0.4, 1.4, out); s.frequency.linearRampToValueAtTime(40, t + 1.8);
      // cor : quinte de dents-de-scie, filtre qui s'ouvre
      const lp = filter('lowpass', 250, 1.5, t); lp.frequency.linearRampToValueAtTime(1300, t + 0.9); lp.frequency.linearRampToValueAtTime(400, t + 1.8);
      const g = gain(0); g.gain.setValueAtTime(MIN, t + 0.2); g.gain.linearRampToValueAtTime(0.08, t + 0.6);
      g.gain.setValueAtTime(0.08, t + 1.3); g.gain.exponentialRampToValueAtTime(MIN, t + 2);
      chain(lp, g, out);
      for (const [f0, det] of [[110, -6], [110, 6], [165, 0], [55, 0]]) {
        const o = osc('sawtooth', f0, t + 0.2); o.detune.value = det; o.frequency.setValueAtTime(f0 * 0.97, t + 0.2);
        o.frequency.linearRampToValueAtTime(f0, t + 0.45); o.connect(lp); o.start(t + 0.2); o.stop(t + 2.05);
      }
      // coup de taïko
      const k = tone('sine', 90, t, 0.35, 0.003, 0.5, out); k.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      return 2.1;
    },
    bossDefeated(t) {
      const notes = [[67, 0, 0.1], [67, 0.11, 0.1], [67, 0.22, 0.1], [72, 0.34, 0.7]];
      const brass = (m, at, len, peak) => {
        const lp = filter('lowpass', 600, 1, at); lp.frequency.linearRampToValueAtTime(2600, at + 0.05); lp.frequency.setTargetAtTime(1200, at + 0.06, 0.2);
        const g = gain(0); g.gain.setValueAtTime(MIN, at); g.gain.linearRampToValueAtTime(peak, at + 0.02);
        g.gain.setValueAtTime(peak * 0.8, at + len); g.gain.exponentialRampToValueAtTime(MIN, at + len + 0.25);
        chain(lp, g, out);
        for (const d of [-5, 5]) { const o = osc('sawtooth', midiHz(m), at); o.detune.value = d; o.connect(lp); o.start(at); o.stop(at + len + 0.3); }
      };
      for (const [m, at, len] of notes) brass(m, t + at, len, 0.045);
      for (const m of [64, 60]) brass(m, t + 0.34, 0.7, 0.03);
      noiseHit(t + 0.34, 1.1, 0.05, 'highpass', 6000, 0.5, out, 0.005); // cymbale
      chime(t + 0.36, [84, 88, 91], 0.04, 0.035, 1.2, 0.3);
      return 1.6;
    },
    skill(t) {
      const p = vary(0.08);
      swish(t, 0.32, 400 * p, 3200 * p, 0.14, 2);
      const o = tone('sine', 600 * p, t + 0.04, 0.035, 0.05, 0.3, out); o.frequency.exponentialRampToValueAtTime(1900 * p, t + 0.3);
      sparkle(t + 0.15, 4, 0.2, 2500, 5000, 0.014);
      return 0.45;
    },
    summon(t, o) {
      const lvl = rarityLevel(o.rarity); const dur = 0.5 + lvl * 0.25;
      const g = gain(0); g.gain.setValueAtTime(MIN, t); g.gain.linearRampToValueAtTime(0.04, t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(MIN, t + dur + 0.1); g.connect(out);
      for (const d of [-7, 7]) {
        const s = osc('triangle', 220, t); s.detune.value = d; s.frequency.exponentialRampToValueAtTime(880 + lvl * 220, t + dur);
        s.connect(g); s.start(t); s.stop(t + dur + 0.15);
      }
      swish(t, dur, 300, 2500 + lvl * 1500, 0.06, 1.5);
      const steps = 4 + lvl * 2; const scale = [0, 4, 7, 11, 12, 16, 19, 23, 24, 28];
      for (let i = 0; i < steps; i++) chime(t + (i / steps) * dur, [72 + scale[i]], 0, 0.025 + lvl * 0.004, 0.3);
      if (lvl >= 2) chime(t + dur, [84, 88, 91, lvl === 3 ? 96 : 95], lvl === 3 ? 0.03 : 0.015, 0.045, 1.4, 0.3);
      if (lvl === 3) sparkle(t + dur, 12, 1, 4000, 8000, 0.016);
      return dur + (lvl >= 2 ? 1.4 : 0.35);
    },
    click(t) {
      tone('sine', 1350 * vary(0.03), t, 0.05, 0.001, 0.025, out);
      noiseHit(t, 0.01, 0.02, 'highpass', 4000, 0.7, out);
      return 0.04;
    },
    claim(t) {
      chime(t, [81, 88], 0.09, 0.06, 0.6, 0.2);
      tone('triangle', midiHz(69), t + 0.09, 0.03, 0.003, 0.3, out);
      sparkle(t + 0.12, 5, 0.3, 3000, 6000, 0.014);
      return 0.8;
    },
    step(t) {
      noiseHit(t, 0.035, 0.05, 'lowpass', 500 + srnd() * 500, 0.8, out, 0.004);
      return 0.05;
    },
    // v9.2.0 (monde marin) : bulle — sinus bref qui monte (« bloup »), parfois doublé.
    bubble(t) {
      const n = srnd() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const at = t + i * (0.05 + srnd() * 0.06);
        const o = osc('sine', 260 + srnd() * 320, at); const g = gain(0);
        o.frequency.exponentialRampToValueAtTime(900 + srnd() * 700, at + 0.07);
        g.gain.setValueAtTime(MIN, at); g.gain.linearRampToValueAtTime(0.05, at + 0.008); g.gain.exponentialRampToValueAtTime(MIN, at + 0.09);
        chain(o, g, out); o.start(at); o.stop(at + 0.12);
      }
      return 0.2;
    },
    wing(t) {
      const p = vary(0.1);
      for (const [d, v] of [[0, 0.06], [0.07, 0.035]]) {
        const f = noiseHit(t + d, 0.11, v, 'bandpass', 1300 * p, 1.1, out, 0.03);
        f.frequency.exponentialRampToValueAtTime(450 * p, t + d + 0.14);
      }
      return 0.2;
    },
    boost(t) {
      const lp = filter('lowpass', 400, 4, t); lp.frequency.exponentialRampToValueAtTime(3500, t + 0.35);
      const g = gain(0); perc(g.gain, t, 0.04, 0.05, 0.4);
      const o = osc('sawtooth', 200, t); o.frequency.exponentialRampToValueAtTime(820, t + 0.35);
      chain(o, lp, g, out); o.start(t); o.stop(t + 0.5);
      swish(t, 0.3, 500, 4000, 0.08, 1.5);
      chime(t + 0.3, [84, 91], 0.05, 0.05, 0.5, 0.2);
      return 0.85;
    },
    upgrade(t) {
      const p = vary(0.05);
      for (const [r, v, d] of [[1, 0.08, 0.5], [2.76, 0.04, 0.3], [5.4, 0.025, 0.15], [8.93, 0.012, 0.08]]) {
        tone('sine', 620 * p * r, t, v, 0.001, d, out);
      }
      noiseHit(t, 0.03, 0.12, 'bandpass', 3000, 0.8, out);
      const o = tone('sine', 150, t, 0.14, 0.002, 0.1, out); o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
      sparkle(t + 0.03, 3, 0.15, 3000, 6000, 0.012); // étincelles
      return 0.6;
    },
    error(t) {
      for (const [f, at] of [[233, 0], [185, 0.1]]) {
        const lp = filter('lowpass', 900); const g = gain(0); perc(g.gain, t + at, 0.05, 0.004, 0.12);
        const o = osc('square', f, t + at); chain(o, lp, g, out); o.start(t + at); o.stop(t + at + 0.15);
      }
      return 0.25;
    },
  };

  // Anti-spam : écart minimal et polyphonie max par effet ; plafond global.
  const LIMITS = {
    coin: [0.05, 3], step: [0.09, 2], click: [0.03, 2], hit: [0.035, 4], bossHit: [0.06, 2], enemyHit: [0.05, 3], kill: [0.04, 3],
    loot: [0.08, 3], chestBell: [0.4, 2], wing: [0.1, 2], levelUp: [0.3, 1], bossSpawn: [1, 1], bossDefeated: [1, 1], summon: [0.08, 3],
  };
  const active = new Map(); const recentCoins = [];
  let totalVoices = [];

  function playSfx(name, t, opts = {}) {
    const fn = SFX[name]; if (!fn) return false;
    const [gap, max] = LIMITS[name] ?? [0.02, 4];
    const list = (active.get(name) ?? []).filter((e) => e.end > t);
    totalVoices = totalVoices.filter((e) => e > t);
    if (list.length >= max || totalVoices.length >= 24) return false;
    if (list.length && t - list.at(-1).start < gap) return false;
    const o = { rarity: opts.rarity, spam: 1 };
    if (name === 'coin') {
      // pièces en rafale : de plus en plus discrètes
      while (recentCoins.length && recentCoins[0] < t - 0.6) recentCoins.shift();
      recentCoins.push(t); o.spam = 1 / (1 + (recentCoins.length - 1) * 0.35);
    }
    const vol = clamp(Number(opts.volume ?? 1) || 0, 0, 1);
    if (vol <= 0) return false;
    if (vol < 1) { out = gain(vol); out.connect(sfxBus); }
    let dur = 0.3;
    try { dur = fn(t, o); } finally { out = sfxBus; }
    list.push({ start: t, end: t + dur }); active.set(name, list); totalVoices.push(t + dur);
    return true;
  }

  return {
    ctx, master, musicVol, sfxVol, seq, scheduleMusic, startMusic, changeScene, playSfx,
    setCrackle(on) { crackleOn = !!on; updateCrackle(); },
    setMusicEnabled(on) { seq.enabled = !!on; },
    // v9.2.0 (monde marin) : sous l'eau, la musique passe derrière un passe-bas (son étouffé), en fondu.
    setUnderwater(on) { lofi.frequency.setTargetAtTime(on ? 650 : 3000, ctx.currentTime, 0.6); },
    // v10.16 (A4) : boss sous 20 % de PV : percussions et basse plus présentes (k de 0 à 1), en fondu.
    setIntensity(k) {
      const v = Math.max(0, Math.min(1, k));
      drumBus.gain.setTargetAtTime(0.9 * (1 + 0.45 * v), ctx.currentTime, 0.4);
      bassBus.gain.setTargetAtTime(1 + 0.35 * v, ctx.currentTime, 0.4);
    },
  };
}

// --- API publique ---------------------------------------------------------------------------

const NOOP_SCENE = { world: 0, mode: 'normal' };

function normScene(scene = {}) {
  const world = clamp(Math.floor(Number(scene.world) || 0), 0, WORLDS.length - 1);
  const mode = scene.mode in MODES ? scene.mode : 'normal';
  return { world, mode };
}

export function createAudio({ seed = (Date.now() & 0xffff) + 1, crackle = true } = {}) {
  const AC = audioContextClass();
  const volumes = { master: 0.8, music: 0.6, sfx: 0.8 };
  let muted = false; let hidden = false; let crackleOn = crackle; let underwater = false; // v9.2.0 : passe-bas sous l'eau
  let scene = { ...NOOP_SCENE };
  let engine = null; let timer = null; let suspendTimer = null;

  const tick = () => { if (engine) engine.scheduleMusic(engine.ctx.currentTime + LOOKAHEAD); };
  const startTimer = () => { if (!timer && engine) { tick(); timer = setInterval(tick, TICK_MS); } };
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  function applyVolumes(ramp = 0.08) {
    if (!engine) return;
    const t = engine.ctx.currentTime;
    const set = (node, v) => node.gain.setTargetAtTime(v, t, ramp / 3);
    set(engine.master, muted || hidden ? 0 : curve(volumes.master));
    set(engine.musicVol, MUSIC_BASE * curve(volumes.music));
    set(engine.sfxVol, SFX_BASE * curve(volumes.sfx));
    engine.setMusicEnabled(volumes.music > 0);
  }

  // Tourne seulement si déverrouillé, non muet et fenêtre visible (économie CPU).
  function refreshRunState() {
    if (!engine) return;
    const ctx = engine.ctx;
    clearTimeout(suspendTimer); suspendTimer = null;
    applyVolumes();
    if (!muted && !hidden) {
      try { ctx.resume?.()?.catch?.(() => {}); } catch { /* ignoré */ }
      startTimer();
    } else {
      stopTimer();
      suspendTimer = setTimeout(() => { try { ctx.suspend?.()?.catch?.(() => {}); } catch { /* ignoré */ } }, 120);
    }
  }

  const api = {
    get supported() { return !!AC; },
    get unlocked() { return !!engine; },
    get volumes() { return { ...volumes }; },
    get muted() { return muted; },
    get scene() { return { ...scene }; },
    get crackle() { return crackleOn; },

    unlock() {
      if (!AC) return;
      if (engine) { if (!muted && !hidden) refreshRunState(); return; }
      try {
        const ctx = new AC();
        engine = buildEngine(ctx, { seed, crackle: crackleOn });
        applyVolumes(0.01);
        engine.startMusic(scene.world, scene.mode, ctx.currentTime);
        if (underwater) engine.setUnderwater(true);
        refreshRunState();
      } catch {
        engine = null; // Web Audio indisponible ou refusé : on reste silencieux
      }
    },

    play(name, opts = {}) {
      if (!engine || muted || hidden || volumes.sfx <= 0 || typeof name !== 'string') return;
      try {
        const ctx = engine.ctx; const t = ctx.currentTime + 0.005;
        engine.playSfx(name, t, opts ?? {});
      } catch { /* un effet raté ne doit jamais casser le jeu */ }
    },

    setScene(next) {
      const s = normScene(next);
      if (s.world === scene.world && s.mode === scene.mode) return;
      scene = s;
      if (!engine) return;
      try { engine.changeScene(s.world, s.mode, engine.ctx.currentTime); } catch { /* ignoré */ }
    },

    setVolume(kind, value) {
      if (!(kind in volumes)) return;
      const v = Number(value); if (!Number.isFinite(v)) return;
      volumes[kind] = clamp(v, 0, 1);
      applyVolumes();
    },

    setMuted(on) { muted = !!on; refreshRunState(); },
    setCrackle(on) { crackleOn = !!on; engine?.setCrackle(crackleOn); },
    setUnderwater(on) { underwater = !!on; try { engine?.setUnderwater(underwater); } catch { /* ignoré */ } }, // v9.2.0
    setIntensity(k) { try { engine?.setIntensity?.(k); } catch { /* ignoré */ } }, // v10.16 (A4)
    suspend() { hidden = true; refreshRunState(); },
    resume() { hidden = false; refreshRunState(); },
  };
  return api;
}

// Rendu hors ligne (tests, aperçu) : renvoie un AudioBuffer, ou null sans Web Audio.
// sfx : [{ name, at, opts }] ; la musique de la scène démarre à 0.
export async function renderOffline({
  seconds = 8, world = 0, mode = 'normal', sfx = [], seed = 1, sampleRate = 44100, crackle = true,
  music = 1, sfxVolume = 1,
} = {}) {
  const g = globalThis;
  const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
  if (!OAC) return null;
  const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const engine = buildEngine(ctx, { seed, crackle });
  engine.musicVol.gain.value = MUSIC_BASE * curve(music);
  engine.sfxVol.gain.value = SFX_BASE * curve(sfxVolume);
  engine.master.gain.value = curve(0.8);
  engine.setMusicEnabled(music > 0);
  const s = normScene({ world, mode });
  engine.startMusic(s.world, s.mode, 0);
  engine.scheduleMusic(seconds);
  for (const e of sfx) engine.playSfx(e.name, e.at ?? 0, e.opts ?? {});
  return ctx.startRendering();
}
