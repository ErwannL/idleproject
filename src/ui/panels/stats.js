// Objectifs > Statistiques (v9.1.7) : temps de jeu sous tous les angles, filtrable par monde et par cycle (×2, ×3…).
// Source : state.times (core/times.js). Filtre dans ui.view.statsZone ('all' ou index du monde) et ui.view.statsCycle.
import { ZONES } from '../../data/zones.js';
import { TIME_MODES, average, cyclesPlayed, zoneTime } from '../../core/times.js';
import { escapeHtml, formatNumber } from '../common.js';

const MODE_LABELS = { campaign: 'Campagne', dungeon: 'Donjons', tower: 'Tour', challenge: 'Défi de la semaine' };

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d} j ${h} h`;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m) return `${m} min ${String(s % 60).padStart(2, '0')}`;
  return `${s} s`;
}

const line = (label, value, note = '') => `<div class="stat-line"><span>${label}</span><b>${value}</b>${note ? `<small class="muted">${note}</small>` : ''}</div>`;
const pct = (part, total) => (total > 0 ? `${Math.round((part / total) * 100)} %` : '');

// v9.2.9 : nom complet en bulle quand il est coupé par « … » (« 4. Scorching De… » sur téléphone).
function bars(rows, total) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="time-bars">${rows.map((r) => `<div class="time-bar${r.active ? ' active' : ''}"${r.action ? ` data-action="stats-zone" data-value="${r.action}"` : ''}>
    <span class="tb-label" title="${escapeHtml(r.label)}">${r.label}</span><span class="tb-track"><i style="width:${(r.value / max) * 100}%"></i></span>
    <span class="tb-val">${formatDuration(r.value)}</span><small class="muted">${pct(r.value, total)}</small></div>`).join('')}</div>`;
}

function runsBlock(title, runs, best, current, count) {
  if (!count && !runs.length) return '';
  const last = runs.at(-1);
  return `<div class="card"><div class="section-title">${title}</div>
    ${line('Nombre', formatNumber(count))}
    ${line('En cours depuis', formatDuration(current))}
    ${best ? line('La plus rapide', formatDuration(best)) : ''}
    ${runs.length ? line('Moyenne', formatDuration(average(runs)), `sur les ${runs.length} dernières`) : ''}
    ${last ? line('La dernière', formatDuration(last)) : ''}
    ${runs.length > 1 ? `<div class="runs-spark" title="Durée des dernières">${runs.slice(-20).map((r) => `<i style="height:${Math.max(6, (r / Math.max(...runs.slice(-20))) * 100)}%" title="${formatDuration(r)}"></i>`).join('')}</div>` : ''}</div>`;
}

export default {
  id: 'stats',
  title: 'Statistiques',
  icon: 'icon_book',
  render(ui, state) {
    const t = state.times;
    const zone = ui.view.statsZone ?? 'all';
    const campaign = t.modes.campaign;
    const active = TIME_MODES.reduce((s, m) => s + t.modes[m], 0);
    const select = `<div class="row stats-filter"><label>Monde <select data-action="stats-zone-select" aria-label="Filtrer par monde">
      <option value="all"${zone === 'all' ? ' selected' : ''}>Tous les mondes</option>
      ${ZONES.map((z, i) => `<option value="${i}"${String(zone) === String(i) ? ' selected' : ''}>${i + 1}. ${escapeHtml(z.name)}</option>`).join('')}</select></label></div>`;

    if (zone !== 'all') {
      const z = Number(zone);
      const spent = zoneTime(t, z);
      const first = t.firstZone[z];
      const cycles = cyclesPlayed(t, z);
      const reach = first === undefined ? 'Pas encore atteint' : first < 0 ? 'Avant la 9.1.7' : first < 1 ? 'Dès le début' : `après ${formatDuration(first)} de jeu`;
      return `${select}<div class="card"><div class="section-title">${z + 1}. ${escapeHtml(ZONES[z].name)}</div>
        ${line('Temps passé', formatDuration(spent), pct(spent, campaign) ? `${pct(spent, campaign)} de la campagne` : '')}
        ${line('Atteint pour la première fois', reach)}
        ${cycles.length ? line('Cycles joués', cycles.map((c) => (c === 1 ? 'normal' : `×${c}`)).join(', ')) : ''}</div>
        ${cycles.length ? `<div class="card"><div class="section-title">Temps par cycle</div>${bars(cycles.map((c) => ({ label: c === 1 ? 'Normal' : `×${c}`, value: zoneTime(t, z, c) })), spent)}</div>` : ''}`;
    }

    const zones = ZONES.map((zd, i) => ({ label: `${i + 1}. ${escapeHtml(zd.name)}`, value: zoneTime(t, i), action: String(i) })).filter((r) => r.value > 0);
    const cycles = cyclesPlayed(t);
    const reached = ZONES.map((zd, i) => [i, t.firstZone[i]]).filter(([, v]) => v !== undefined);
    return `${select}
      <div class="card"><div class="section-title">Temps de jeu</div>
        ${line('Temps de jeu actif', formatDuration(active))}
        ${line('Hors jeu (récompenses au retour)', formatDuration(t.offline))}
        ${line('Séance en cours', formatDuration(t.session))}
        ${line('Plus longue séance', formatDuration(t.longestSession))}
        ${line('Lancements du jeu', formatNumber(t.sessions))}
        ${t.sessions ? line('Séance moyenne', formatDuration(active / t.sessions)) : ''}</div>
      <div class="card"><div class="section-title">Par activité</div>${bars(TIME_MODES.map((m) => ({ label: MODE_LABELS[m], value: t.modes[m] })), active)}</div>
      ${runsBlock('Renaissances', t.rebirthRuns, t.bestRebirth, t.run, state.records.rebirths)}
      ${runsBlock('Transcendances', t.transcendRuns, t.bestTranscend, t.transcendRun, state.transcend?.count ?? 0)}
      ${zones.length ? `<div class="card"><div class="section-title">Par monde <small class="muted">(touchez un monde pour le détail)</small></div>${bars(zones, campaign)}</div>` : ''}
      ${cycles.length > 1 ? `<div class="card"><div class="section-title">Par cycle de difficulté</div>${bars(cycles.map((c) => ({ label: c === 1 ? 'Normal' : `×${c}`, value: ZONES.reduce((s, zd, i) => s + zoneTime(t, i, c), 0) })), campaign)}</div>` : ''}
      ${reached.length ? `<div class="card"><div class="section-title">Premier passage dans chaque monde</div>
        ${reached.map(([i, v]) => line(`${i + 1}. ${escapeHtml(ZONES[i].name)}`, v < 0 ? 'avant la 9.1.7' : formatDuration(v))).join('')}</div>` : ''}`;
  },
};
