// Options : sauvegarde, fenêtre (version bureau), test hors ligne, réinitialisation.
import { BALANCE } from '../../data/balance.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml } from '../common.js';
import { getLang } from '../../i18n/i18n.js';
import { GAME_VERSION } from '../../version.js';
import { activeCheats } from '../../core/cheats.js';

// Codes actifs : chacun avec son temps restant (ils se cumulent).
function activeCodes(state) {
  const list = activeCheats(state);
  if (!list.length) return '';
  return `<div class="muted">Actifs : ${list.map((e) => `${escapeHtml(e.code)} ${formatDuration((e.until - Date.now()) / 1000)}`).join(' · ')}</div>`;
}

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
      <div class="muted">Position et taille mémorisées.</div>
    </div>`;
}

// Dépôt GitHub privé : sans identification, GitHub répond « 404 » à tout le monde. Deux solutions :
// rendre le dépôt public, ou coller ici un jeton GitHub en lecture seule (gardé uniquement sur ce PC).
function privateRepoHelp(u) {
  let has = false;
  try { has = Boolean(localStorage.getItem('idle-rpg.github-token')); } catch { /* indisponible */ }
  const show = has || (u.status === 'error' && /404/.test(u.error ?? ''));
  if (!show) return '';
  return `<details class="update-notes" ${has ? '' : 'open'}><summary>Dépôt privé : comment activer les mises à jour</summary>
      <div class="muted">Le dépôt GitHub du jeu est privé : sans identification, GitHub répond « 404 ». Deux solutions :
        <b>1.</b> rendre le dépôt public (GitHub → Settings → Danger Zone → Change visibility) ;
        <b>2.</b> créer un jeton « fine-grained » en <b>lecture seule</b> limité à ce dépôt (GitHub → Settings → Developer settings →
        Personal access tokens → Fine-grained, droit « Contents : Read-only ») et le coller ici. Il reste uniquement sur ce PC.</div>
      <div class="row"><input id="github-token" class="grow" type="password" maxlength="255" placeholder="${has ? 'Jeton enregistré (laisser vide pour le supprimer)' : 'github_pat_…'}" autocomplete="off">
        <button class="btn small" data-action="github-token">${has ? 'Remplacer' : 'Enregistrer'}</button></div>
    </details>`;
}

// Version lancée + dernière version publiée sur GitHub (github.com/ErwannL/idleproject).
function versionOptions(ui) {
  const current = ui.desktop?.version ?? GAME_VERSION;
  const u = ui.updateInfo ?? {};
  const rel = u.release;
  let status = '<span class="muted">Pas encore vérifié.</span>';
  if (u.busy) status = '<span class="muted">Vérification…</span>';
  else if (u.status === 'uptodate') status = `<span class="tag-open">À jour</span> <span class="muted">dernière version : ${escapeHtml(rel.version)}</span>`;
  else if (u.status === 'error') status = `<span class="tag-locked">Hors ligne</span> <span class="muted">GitHub injoignable${u.error ? ` (${escapeHtml(u.error)})` : ''}.</span>`;
  else if (u.status === 'available') status = `<span class="tag-new">Nouvelle version ${escapeHtml(rel.version)}</span>`;
  const install = u.status === 'available'
    ? (ui.desktop ? `<button class="btn btn-gold small" data-action="install-update" ${u.installing || !rel.setup ? 'disabled' : ''}>
        ${u.installing ? 'Téléchargement…' : `Mettre à jour vers ${escapeHtml(rel.version)}`}</button>`
      : `<button class="btn btn-gold small" data-action="open-releases">Télécharger la ${escapeHtml(rel.version)}</button>`)
    : '';
  const notes = u.status === 'available' && rel.notes
    ? `<details class="update-notes"><summary>Nouveautés</summary><pre>${escapeHtml(rel.notes)}</pre></details>` : '';
  return `<div class="card">
      <div class="section-title">Version et mises à jour</div>
      <div class="row-between"><span>Version lancée : <b class="num">${escapeHtml(current)}</b> ${ui.desktop ? '(bureau)' : '(navigateur)'}</span>
        <button class="btn small" data-action="check-update" ${u.busy ? 'disabled' : ''}>Vérifier</button></div>
      <div class="row-between">${status}${install}</div>
      ${u.error && u.status !== 'error' ? `<div class="bad">${escapeHtml(u.error)}</div>` : ''}
      ${notes}
      <div class="options-row"><button class="btn small" data-action="open-releases">Voir les versions sur GitHub</button></div>
      ${privateRepoHelp(u)}
    </div>`;
}

export default {
  id: 'options',
  title: 'Paramètres',
  icon: 'icon_gear',
  render(ui, state) {
    const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
    return `${versionOptions(ui)}<div class="card">
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
        <label class="toggle"><input type="checkbox" data-action="cinematics" ${state.ui.cinematics !== false ? 'checked' : ''}> Cinématiques (lancement du jeu, nouveau monde)</label>
        <label class="toggle"><input type="checkbox" data-action="focus" ${state.ui.focus ? 'checked' : ''}> <b>Mode concentration</b> : moins d'effets visuels et de messages (le jeu continue normalement)</label>
      </div>
      <div class="card">
        <div class="section-title">Raccourcis clavier</div>
        <div class="row-between"><span class="muted">1…0 onglets · Espace avance auto · V vitesse · Q W E R T boosts · G tout récupérer…</span>
          <button class="btn small" data-action="show-shortcuts">Tout voir (K)</button></div>
      </div>
      <div class="card">
        <div class="section-title">Code secret</div>
        <div class="row"><input id="cheat-code" class="grow" type="text" maxlength="24" placeholder="Entrer un code…" autocomplete="off">
          <button class="btn small" data-action="cheat">Valider</button></div>
        ${activeCodes(state)}
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
