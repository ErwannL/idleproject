// Petits outils partagés par les panneaux de l'interface.
import { HD_REAL } from '../data/hd-real.js';
import { HD_PX } from '../data/hd-px.js'; // v9.2.4
import { AFFIXES, SLOTS } from '../data/items.js';
import { EFFECT_LABELS } from '../data/powers.js';
import { forecastSteps, nextBossStage } from '../core/guide.js';
import { stageLabel } from '../core/combat.js';
import { setById } from '../core/sets.js';
import { simSpeed } from '../core/cheats.js';
import { formatDecimal, formatNumber } from '../core/format.js';
import { isUpgrade } from '../core/inventory.js';
import { rewardText } from '../core/rewards.js';
import { itemBase, rarityById } from '../core/loot.js';
import { itemIconUrl, spriteUrl } from '../render/pixel.js';

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const icon = (name, scale = 2, options = {}) => spriteUrl(name, scale, options);
export const img = (name, cls = '', alt = '') => `<img class="px ${cls}" src="${icon(name)}" alt="${alt}">`;
// v9.1.3 : les icônes de monnaie portent leur nom (lu par les lecteurs d'écran, affiché au survol).
export const coin = () => img('coin', '', 'or');
export const gem = () => img('icon_gem', '', 'gemmes');
export const fragment = () => img('icon_fragment', '', 'fragments');
export const shard = () => img('icon_shard', '', 'éclats');
// v9.1.3 (doc2 §4) : étoiles de Transcendance en icône (plus de symbole texte) ; icône décorative à côté d'un texte.
export const starsIcon = () => img('icon_stars', 'glyph');
export const glyph = (name) => img(name, 'glyph');

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
// v9.1.0 : sous un bouton grisé faute de monnaie, ce qui manque (« Il manque 12 éclats ») ; mis à jour par
// refreshCosts (ui.js) sans redessiner le panneau.
export const CURRENCY_WORDS = { gold: ['or', 'or'], gems: ['gemme', 'gemmes'], fragments: ['fragment', 'fragments'], shards: ['éclat', 'éclats'],
  stars: ['Étoile', 'Étoiles'] };
export function missingText(cost, have, currency) {
  const n = Math.ceil(cost - have);
  if (!(n > 0)) return '';
  const [one, many] = CURRENCY_WORDS[currency] ?? ['', ''];
  return `Il manque ${formatNumber(n)} ${n > 1 ? many : one}`;
}

export function costButton({ action, cost, have, label = '', currency = 'gold', attrs = '', cls = 'btn-gold', max = false, locked = false }) {
  const iconHtml = { gold: coin(), gems: gem(), fragments: fragment(), shards: shard(), stars: starsIcon() }[currency];
  if (max) return `<button class="btn ${cls}" disabled>Max</button>`;
  // v9.1.3 (A2) : la monnaie est nommée (bulle et nom accessible), pas seulement « 1 200 » à côté d'une icône.
  const [one, many] = CURRENCY_WORDS[currency] ?? ['', ''];
  const named = `${formatNumber(cost)} ${cost > 1 ? many : one}`;
  return `<span class="cost-wrap"><button class="btn ${cls} num" data-action="${action}" data-cost="${cost}" data-currency="${currency}" ${attrs}
    title="Coût : ${named}" aria-label="${escapeHtml(`${label.trim() ? `${label.trim()} : ` : ''}${named}`)}"
    ${locked ? 'data-locked="1"' : ''} ${locked || have < cost ? 'disabled' : ''}>${label}${iconHtml} ${formatNumber(cost)}</button><small class="cost-missing">${locked ? '' : missingText(cost, have, currency)}</small></span>`;
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
// v9.2.4 : les illustrations générées (assets/hd/px, src/data/hd-px.js) remplacent celles faites à la main.
// Une illustration réaliste (assets/hd/real, importée par tools/art/import_real.py) remplace la version pixel HD.
function hdArtId(unit) {
  if (!unit?.id) return null;
  if (unit.skin) return unit.skin;
  if (unit.kind === 'ally') return `ally_${unit.id}`;
  if (unit.palette || unit.title || unit.role) return `hero_${unit.id}`;
  return `pet_${unit.id}`;
}
export function hdArtUrl(unit, thumb = false) {
  const id = hdArtId(unit);
  if (!id) return null;
  if (HD_REAL.has(id)) return `assets/hd/real/${id}.png`;
  // v9.2.4 : illustration pixel générée (≥ 1024 px) ; `thumb` = taille d'origine pour les vignettes.
  if (HD_PX.has(id)) return thumb ? `assets/hd/px/thumb/${id}.webp` : `assets/hd/px/${id}.webp`;
  return `assets/hd/${id}.png`;
}
// v9.2.4 : vignettes (apparences, fiche compagnon) → taille réduite.
const HD_THUMB_CLS = /\b(look-hd|pet-art)\b/;
export function hdArt(unit, cls = '') {
  const id = hdArtId(unit);
  const url = hdArtUrl(unit, HD_THUMB_CLS.test(cls));
  return url ? `<img class="hd-art ${cls}${HD_REAL.has(id) ? ' real' : HD_PX.has(id) ? ' px-hd' : ''}" src="${url}" alt="" loading="lazy" onerror="this.remove()">` : '';
}

// v9.1.0 : bloc repliable unique (au clavier : bouton avec aria-expanded). L'état vit dans ui.view (open / closed)
// pour survivre au redessin du panneau. `body` peut être une fonction : elle n'est calculée que bloc ouvert.
export function fold(ui, id, title, body, { open = false, extra = '', cls = '' } = {}) {
  const v = ui.view;
  const isOpen = v.open?.has(id) ? true : v.closed?.has(id) ? false : open;
  const content = isOpen ? (typeof body === 'function' ? body() : body) : '';
  return `<div class="fold${isOpen ? ' open' : ''}${cls ? ` ${cls}` : ''}">
    <button class="fold-head" data-action="toggle-section" data-value="${id}" data-expanded="${isOpen}" aria-expanded="${isOpen}">
      <span class="fold-arrow" aria-hidden="true">${isOpen ? '▾' : '▸'}</span><span class="fold-title">${title}</span>${extra ? `<span class="fold-extra">${extra}</span>` : ''}</button>
    ${isOpen ? `<div class="fold-body">${content}</div>` : ''}</div>`;
}

// Segment (au plus un par écran) : [[id, libellé, icône?]], action et valeur active.
export function segment(items, action, active, attrs = '') {
  return `<div class="seg" role="tablist" ${attrs}>${items.map(([id, label, ic]) => `<button class="seg-btn${id === active ? ' active' : ''}" role="tab"
    aria-selected="${id === active}" data-action="${action}" data-value="${id}">${ic ? img(ic) : ''}<span>${label}</span></button>`).join('')}</div>`;
}

// v9.1.3 (A7) : récompense en icônes (icône + nombre). Le texte complet (rewardText) reste dans title et aria-label.
const REWARD_ICONS = { gold: 'coin', gems: 'icon_gem', keys: 'icon_key', fragments: 'icon_fragment', shards: 'icon_shard' };
export function rewardIcons(reward, cls = '') {
  const parts = Object.entries(reward ?? {}).filter(([k, v]) => v > 0 && REWARD_ICONS[k])
    .map(([k, v]) => `<span class="rw"><img class="px" src="${icon(REWARD_ICONS[k])}" alt="">${formatNumber(Math.floor(v))}</span>`);
  if (!parts.length) return '';
  const text = rewardText(reward, formatNumber);
  return `<span class="rw-icons ${cls}" title="${escapeHtml(text)}" role="img" aria-label="${escapeHtml(text)}">${parts.join('')}</span>`;
}
