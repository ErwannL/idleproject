// Options : sauvegarde, fenêtre (version bureau), test hors ligne, réinitialisation.
import { BALANCE } from '../../data/balance.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml } from '../common.js';

// Musique lo-fi / aventure et effets sonores (générés en direct, aucun fichier audio).
function soundOptions(ui) {
  const s = ui.sound?.settings;
  if (!s) return '';
  const slider = (kind, label) => `<label class="volume-row"><span>${label}</span>
    <input type="range" min="0" max="100" step="5" value="${Math.round(s[kind] * 100)}" data-action="volume" data-kind="${kind}"></label>`;
  return `<div class="card">
      <div class="section-title">Son</div>
      <label class="toggle"><input type="checkbox" data-action="mute" ${s.muted ? 'checked' : ''}> Couper le son</label>
      ${slider('master', 'Général')}${slider('music', 'Musique')}${slider('sfx', 'Effets')}
    </div>`;
}

function windowOptions(ui) {
  if (!ui.desktop) {
    return `<div class="card"><div class="section-title">Fenêtre</div>
      <div class="muted">« Toujours au premier plan » est disponible dans la version bureau (Idle RPG.exe).</div></div>`;
  }
  return `<div class="card">
      <div class="section-title">Fenêtre</div>
      <label class="toggle"><input type="checkbox" data-action="on-top" ${ui.desktop.alwaysOnTop ? 'checked' : ''}>
        Garder la fenêtre au premier plan</label>
      <div class="options-row">
        <button class="btn small" data-action="window-size" data-preset="strip" title="Une simple barre, comme dans la barre des tâches">Barre</button>
        <button class="btn small" data-action="window-size" data-preset="mini">Mini</button>
        <button class="btn small" data-action="window-size" data-preset="standard">Standard</button>
        <button class="btn small" data-action="window-size" data-preset="wide">Large</button>
      </div>
      <div class="muted">Version ${escapeHtml(ui.desktop.version)} · position et taille mémorisées.</div>
    </div>`;
}

export default {
  id: 'options',
  title: 'Paramètres',
  icon: 'icon_gear',
  render(ui, state) {
    const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
    return `<div class="card">
        <div class="section-title">Sauvegarde</div>
        <div class="row-between"><span>Dernière sauvegarde : il y a ${formatDuration(ago)}</span>
          <button class="btn small" data-action="save">Sauvegarder</button></div>
        <div class="muted">Automatique toutes les ${BALANCE.autosaveSeconds} s, à chaque action et à la fermeture.</div>
      </div>
      ${soundOptions(ui)}
      ${windowOptions(ui)}
      <div class="card">
        <div class="section-title">Test des gains hors ligne</div>
        <div class="muted">Applique le vrai calcul hors ligne comme si le jeu avait été fermé.</div>
        <div class="options-row">
          <button class="btn small" data-action="simulate" data-seconds="3600">1 h</button>
          <button class="btn small" data-action="simulate" data-seconds="28800">8 h</button>
          <button class="btn small" data-action="simulate" data-seconds="86400">24 h</button>
        </div>
      </div>
      <div class="card">
        <div class="section-title">Partie</div>
        <button class="btn btn-danger small" data-action="reset">Réinitialiser la partie</button>
      </div>
      <div class="muted">Gains hors ligne : ${BALANCE.offline.farmMultiplier * 100} % du rythme actif, ${BALANCE.offline.capHours} h max.</div>`;
  },
};
