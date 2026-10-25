// Options : sauvegarde, fenêtre (version bureau), test hors ligne, réinitialisation.
import { BALANCE } from '../../data/balance.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml } from '../common.js';
import { getLang } from '../../i18n/i18n.js';

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
      <div class="card">
        <div class="section-title">Langue · Language</div>
        <div class="chip-row" data-no-i18n>
          <button class="btn chip-btn${getLang() === 'fr' ? ' active' : ''}" data-action="lang" data-value="fr">🇫🇷 Français</button>
          <button class="btn chip-btn${getLang() === 'en' ? ' active' : ''}" data-action="lang" data-value="en">🇬🇧 English</button>
        </div>
      </div>
      ${soundOptions(ui)}
      <div class="card">
        <div class="section-title">Notifications et confort</div>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="loot" ${state.ui.notify?.loot !== false ? 'checked' : ''}> Pop-up « nouveaux objets dans l'inventaire »</label>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="boss" ${state.ui.notify?.boss !== false ? 'checked' : ''}> Bannières d'arrivée des boss</label>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="events" ${state.ui.notify?.events !== false ? 'checked' : ''}> Messages des événements (coffres, marchands…)</label>
        <label class="toggle"><input type="checkbox" data-action="focus" ${state.ui.focus ? 'checked' : ''}> <b>Mode concentration</b> : moins d'effets visuels et de messages (le jeu continue normalement)</label>
      </div>
      <div class="card">
        <div class="section-title">Code secret</div>
        <div class="row"><input id="cheat-code" class="grow" type="text" maxlength="24" placeholder="Entrer un code…" autocomplete="off">
          <button class="btn small" data-action="cheat">Valider</button></div>
      </div>
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
