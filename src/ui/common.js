// Petits outils partagés par les panneaux de l'interface.
import { HD_REAL } from '../data/hd-real.js';
import { AFFIXES, SLOTS } from '../data/items.js';
import { EFFECT_LABELS } from '../data/powers.js';
import { forecastSteps, nextBossStage } from '../core/guide.js';
import { stageLabel } from '../core/combat.js';
import { setById } from '../core/sets.js';
import { simSpeed } from '../core/cheats.js';
import { formatDecimal, formatNumber } from '../core/format.js';
import { isUpgrade } from '../core/inventory.js';
import { itemBase, rarityById } from '../core/loot.js';
import { itemIconUrl, spriteUrl } from '../render/pixel.js';

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const icon = (name, scale = 2, options = {}) => spriteUrl(name, scale, options);
export const img = (name, cls = '', alt = '') => `<img class="px ${cls}" src="${icon(name)}" alt="${alt}">`;
export const coin = () => img('coin');
export const gem = () => img('icon_gem');
export const fragment = () => img('icon_fragment');
export const shard = () => img('icon_shard');
export const essence = () => img('icon_essence');

// « +10 % dégâts · +5 % or » — valeurs arrondies pour l'affichage.
export const effectText = (effects) => Object.entries(effects)
  .filter(([k, v]) => EFFECT_LABELS[k] && v !== 0)
  .map(([k, v]) => EFFECT_LABELS[k](Math.round(v * 10) / 10))
  .join(' · ') || '—';

export const affixText = (affix) => AFFIXES[affix.type].label(affix.value);

export const rarityLabel = (id) => rarityById(id).label;

export function itemFrame(item, { selected = false, showUp = false, equipped = false, state = null, tag = 'button', action = 'select-item', current } = {}) {
  const up = showUp && state && isUpgrade(state, item, undefined, current);
  const attrs = tag === 'button' ? `data-action="${action}" data-id="${item.id}"` : '';
  const signature = itemBase(item.baseId).signature;
  return `<${tag} class="item-frame r-${item.rarity}${selected ? ' selected' : ''}${signature ? ' signature' : ''}" ${attrs}
    title="${escapeHtml(item.name)}${item.upgrades ? ` +${item.upgrades}` : ''} · ${rarityLabel(item.rarity)} · niv. ${item.level}">
    <img class="px" src="${itemIconUrl(item)}" alt="${escapeHtml(item.name)}">
    ${item.upgrades ? `<span class="plus-lv">+${item.upgrades}</span>` : ''}
    ${item.set && setById(item.set) ? `<img class="px set-ico" src="${icon(`set_${item.set}`, 1)}" alt="" title="Ensemble : ${escapeHtml(setById(item.set).name)}">` : ''}
    ${up ? '<span class="up" title="Meilleur que l\'équipement porté">▲</span>' : ''}
    ${equipped ? '<span class="eq">É</span>' : ''}
    ${item.locked ? `<img class="px lock" src="${icon('icon_lock', 1)}" alt="Verrouillé">` : ''}</${tag}>`;
}

// `locked` : bouton désactivé pour une autre raison que le coût (ne sera pas réactivé par l'actualisation).
export function costButton({ action, cost, have, label = '', currency = 'gold', attrs = '', cls = 'btn-gold', max = false, locked = false }) {
  const iconHtml = { gold: coin(), gems: gem(), fragments: fragment(), shards: shard(), essence: essence(), tickets: img('icon_ticket'), stars: '<span class="star-cur">✧</span>' }[currency];
  if (max) return `<button class="btn ${cls}" disabled>Max</button>`;
  return `<button class="btn ${cls} num" data-action="${action}" data-cost="${cost}" data-currency="${currency}" ${attrs}
    ${locked ? 'data-locked="1"' : ''} ${locked || have < cost ? 'disabled' : ''}>${label}${iconHtml} ${formatNumber(cost)}</button>`;
}

export function progressBar(ratio, text = '', cls = '') {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return `<div class="mini-bar ${cls}"><div style="width:${pct}%"></div>${text ? `<span>${text}</span>` : ''}</div>`;
}

export function stars(n, max = 5) {
  return `<span class="stars" title="${n} étoile${n > 1 ? 's' : ''}">${'★'.repeat(n)}<span class="off">${'★'.repeat(Math.max(0, max - n))}</span></span>`;
}

export const slotLabel = (slot) => SLOTS[slot] ?? 'Tous';
export { formatDecimal, formatNumber };

// v8.4 : prévision du prochain boss (combat simulé), mise en cache.
// v8.5 (anti-gel) : calculée en arrière-plan par tranches de quelques millisecondes (avant : ~80 ms d'un
// bloc toutes les 8 s, panneau Améliorer ou Carte ouvert), gardée 20 s, et en pause à ×10 et plus.
let forecastCache = { key: '', at: 0, value: null };
let forecastJob = null;
const FORECAST_SLICE_MS = 6;
function runForecastJob() {
  const job = forecastJob;
  if (!job) return;
  const t0 = performance.now();
  for (;;) {
    const r = job.gen.next();
    if (r.done) {
      forecastCache = { key: job.key, at: Date.now(), value: r.value };
      forecastJob = null;
      job.onReady?.();
      return;
    }
    if (performance.now() - t0 > FORECAST_SLICE_MS) break;
  }
  setTimeout(runForecastJob, 16);
}

export function bossForecast(state, onReady = null) {
  if (simSpeed(state) >= 10) return { paused: true };
  const key = `${state.stage}|${JSON.stringify(state.upgrades)}|${Object.values(state.equipment).map((i) => i?.id).join()}|${state.level}|${state.companions.equipped.join()}|${Object.keys(state.talents).length}`;
  const now = Date.now();
  const fresh = forecastCache.key === key && now - forecastCache.at < 20000;
  // v9.1.0 : le rappel de fin de calcul est gardé sur le calcul en cours (avant, un calcul lancé sans rappel
  // ignorait celui d'un appel suivant : « (mise à jour…) » restait affiché).
  if (!fresh) {
    if (forecastJob?.key !== key) {
      forecastJob = { key, gen: forecastSteps(state), onReady };
      setTimeout(runForecastJob, 0);
    } else if (onReady) forecastJob.onReady = onReady;
  }
  if (forecastCache.key === key) return forecastCache.value;
  // Ancien résultat : seulement s'il concerne le même boss (sinon on affichait l'ancienne étape).
  return forecastCache.value?.stage === nextBossStage(state) ? { ...forecastCache.value, stale: true } : { pending: true };
}

export function forecastHtml(f) {
  if (!f) return '';
  if (f.paused) return '<div class="forecast muted">⚔ Prévision du prochain boss en pause à grande vitesse (×10 et plus).</div>';
  if (f.pending) return '<div class="forecast muted">⚔ Prévision du prochain boss : calcul en cours…</div>';
  // Résultat périmé (équipement ou améliorations changés) : on le montre grisé, avec « mise à jour… ».
  const cls = f.stale ? ' stale' : '';
  const note = f.stale ? ' <small class="muted">(mise à jour…)</small>' : '';
  return f.win
    ? `<div class="forecast good${cls}">⚔ Prochain boss (étape ${stageLabel(f.stage)}) : <b>battable</b> en ~${f.seconds} s.${note}</div>`
    : `<div class="forecast bad${cls}">⚔ Prochain boss (étape ${stageLabel(f.stage)}) : pas encore — il lui resterait <b>${f.bossHpPct} %</b> de PV.
        Améliorez Dégâts / PV, l'équipement ou l'équipe.${note}</div>`;
}

// Illustrations détaillées (assets/hd, 256×256) : version « affiche » de chaque héros, apparence, compagnon et
// familier, montrée derrière le sprite du jeu (bannière d'invocation, apparences, fiche compagnon).
// Une illustration réaliste (assets/hd/real, importée par tools/art/import_real.py) remplace la version pixel HD.
function hdArtId(unit) {
  if (!unit?.id) return null;
  if (unit.skin) return unit.skin;
  if (unit.kind === 'ally') return `ally_${unit.id}`;
  if (unit.palette || unit.title || unit.role) return `hero_${unit.id}`;
  return `pet_${unit.id}`;
}
export function hdArtUrl(unit) {
  const id = hdArtId(unit);
  if (!id) return null;
  return HD_REAL.has(id) ? `assets/hd/real/${id}.png` : `assets/hd/${id}.png`;
}
export function hdArt(unit, cls = '') {
  const id = hdArtId(unit);
  const url = hdArtUrl(unit);
  return url ? `<img class="hd-art ${cls}${HD_REAL.has(id) ? ' real' : ''}" src="${url}" alt="" loading="lazy" onerror="this.remove()">` : '';
}
