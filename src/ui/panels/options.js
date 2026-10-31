// Paramètres (v9.1.0 : 4 onglets) : Général (langue, sauvegarde, export / import, compte, version, tutoriel,
// zone de danger), Interface, Son, Fenêtre (version bureau).
import { BALANCE } from '../../data/balance.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml, formatNumber } from '../common.js';
import { getLang } from '../../i18n/i18n.js';
import { THEMES, themeSwatches } from '../themes.js';
import { GAME_VERSION } from '../../version.js';
import { BUILT_IN_TOKEN } from '../../core/update-token.js';
import { activeCheats } from '../../core/cheats.js';
import { BUILD } from '../../core/build-info.js';
import { shortcutsSummary } from '../shortcuts.js';

// Codes actifs (v8.7) : sans durée ; nombre de saisies par code, retrait de N saisies, d'un code ou de tout.
function activeCodes(state, ui) {
  const cheatLabel = (code) => ui.cheatCodes?.cheatLabel(code) ?? code;
  const rows = activeCheats(state).map((e) => `<div class="cheat-row"><b>${escapeHtml(e.code)}</b>
      <span class="muted grow">${escapeHtml(cheatLabel(e.code))} · ×${formatNumber(e.count)} saisie${e.count > 1 ? 's' : ''}</span>
      <button class="btn small" data-action="cheat-remove" data-value="${escapeHtml(e.code)}" title="Retire le nombre de saisies indiqué dans « × fois »">Retirer</button>
      <button class="btn small btn-danger" data-action="cheat-remove" data-value="${escapeHtml(e.code)}" data-times="all">Tout ce code</button></div>`);
  if (state.cheats?.skipBattle) rows.unshift('<div class="cheat-row"><b>SKIPBATTLE</b><span class="muted grow">Combats passés (retaper le code pour arrêter)</span></div>');
  if (!rows.length) return '';
  return `<div class="cheat-list"><div class="section-title">Codes actifs (sans limite de durée)</div>${rows.join('')}
    ${activeCheats(state).length ? '<button class="btn small btn-danger" data-action="cheat-reset">Tout annuler</button>' : ''}</div>`;
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

// Codes de triche : uniquement dans la version dev (BUILD.cheats).
function cheatCard(state, ui) {
  if (!BUILD.cheats) return '';
  return `<div class="card">
        <div class="section-title">Code secret</div>
        <div class="row"><input id="cheat-code" class="grow" type="text" maxlength="24" placeholder="Entrer un code…" autocomplete="off" value="${escapeHtml(ui.view.cheatCode ?? '')}">
          <span>×</span><input id="cheat-times" type="text" inputmode="numeric" maxlength="13" value="${escapeHtml(ui.view.cheatTimes ?? '1')}"
            title="Nombre de fois (jusqu'à 1 000 000 000)" aria-label="Nombre de fois" style="width:110px">
          <button class="btn small" data-action="cheat" title="Entrée pour valider · bouton maintenu = validations en continu">Valider</button></div>
        ${activeCodes(state, ui)}

      </div>`;
}

// Compte et sauvegarde en ligne (v9.1.1) : un compte invité « joueurXXXXXX » est créé au premier lancement et
// la progression est sauvegardée sur le serveur. Pour changer de nom ou retrouver la partie ailleurs, le joueur
// crée son compte joueur (nom d'utilisateur + mot de passe).
function cloudOptions(ui) {
  if (!BUILD.cloud) return '';
  const c = ui.cloud ?? {};
  const busy = c.busy ? 'disabled' : '';
  const msg = c.message ? `<div role="status" style="${c.error ? 'color:#ff9aa8' : 'color:#7fe08f'}">${escapeHtml(c.message)}</div>` : '';
  const loginForm = `<div class="row"><input id="cloud-pseudo" class="grow" type="text" value="${escapeHtml(c.draft?.['cloud-pseudo'] ?? '')}" maxlength="20" placeholder="Nom d'utilisateur" autocomplete="username" aria-label="Nom d'utilisateur">
        <input id="cloud-password" class="grow" type="password" maxlength="200" placeholder="Mot de passe" autocomplete="current-password" aria-label="Mot de passe"></div>
      <div class="options-row"><button class="btn small" data-action="cloud-login" ${busy}>Se connecter</button></div>`;
  const listed = `<label class="toggle"><input type="checkbox" data-action="cloud-listed" ${c.listed !== false ? 'checked' : ''}> Apparaître dans le classement public (nom, niveau, étape, boss)</label>`;
  if (c.loggedIn && c.guest) {
    return `<div class="card">
      <div class="section-title">Compte et sauvegarde en ligne</div>
      <div>Votre nom : <b>${escapeHtml(c.pseudo)}</b>. Votre progression est sauvegardée sur le serveur automatiquement.</div>
      <div class="muted">Pour choisir votre nom et retrouver votre partie sur un autre appareil, créez votre compte joueur. Votre progression le suit.</div>
      <div><b>Créer mon compte joueur</b></div>
      <div class="row"><input id="cloud-claim-pseudo" class="grow" type="text" value="${escapeHtml(c.draft?.['cloud-claim-pseudo'] ?? '')}" maxlength="20" placeholder="Nom d'utilisateur (3 à 20 caractères)" autocomplete="username" aria-label="Nom d'utilisateur"></div>
      <div class="row"><input id="cloud-claim-password" class="grow" type="password" maxlength="200" placeholder="Mot de passe (8 caractères min.)" autocomplete="new-password" aria-label="Mot de passe"></div>
      <div class="row"><input id="cloud-claim-confirm" class="grow" type="password" maxlength="200" placeholder="Confirmer le mot de passe" autocomplete="new-password" aria-label="Confirmer le mot de passe"></div>
      <div class="options-row">
        <button class="btn small btn-primary" data-action="cloud-claim" ${busy}>Créer mon compte joueur</button>
        <button class="btn small" data-action="cloud-sync" ${busy}>Synchroniser maintenant</button>
      </div>
      ${listed}
      ${msg}
      <details class="update-notes"><summary>J'ai déjà un compte joueur</summary>
        <div class="muted">La progression de votre compte remplacera celle de cet appareil (une copie est gardée).</div>
        ${loginForm}
      </details>
    </div>`;
  }
  if (c.loggedIn) {
    return `<div class="card">
      <div class="section-title">Compte et sauvegarde en ligne</div>
      <div>Connecté en tant que <b>${escapeHtml(c.pseudo)}</b>. La partie est sauvegardée sur le serveur automatiquement (toutes les minutes et à la fermeture).</div>
      <div class="options-row">
        <button class="btn small" data-action="cloud-sync" ${busy}>Synchroniser maintenant</button>
        <button class="btn small" data-action="cloud-logout">Se déconnecter</button>
      </div>
      ${listed}
      ${msg}
      <details class="update-notes"><summary>Changer de nom</summary>
        <div class="row"><input id="cloud-rename-pseudo" class="grow" type="text" value="${escapeHtml(c.draft?.['cloud-rename-pseudo'] ?? '')}" maxlength="20" placeholder="Nouveau nom (3 à 20 caractères)" autocomplete="username" aria-label="Nouveau nom">
          <input id="cloud-rename-password" class="grow" type="password" maxlength="200" placeholder="Mot de passe du compte" autocomplete="current-password" aria-label="Mot de passe du compte"></div>
        <div class="options-row"><button class="btn small" data-action="cloud-rename" ${busy}>Changer de nom</button></div>
      </details>
      <details class="update-notes"><summary>Supprimer mon compte</summary>
        <div class="muted">Efface le compte et la progression sur le serveur. Votre partie reste sur cet appareil.</div>
        <div class="row"><input id="cloud-delete-password" class="grow" type="password" maxlength="200" placeholder="Mot de passe du compte" autocomplete="current-password">
          <button class="btn small btn-danger" data-action="cloud-delete">Supprimer</button></div>
      </details>
    </div>`;
  }
  return `<div class="card">
      <div class="section-title">Compte et sauvegarde en ligne</div>
      <div class="muted">${c.optedOut ? 'Déconnecté : la partie est sauvegardée seulement sur cet appareil.' : c.error ? 'Pas de sauvegarde en ligne pour le moment : la partie est sauvegardée sur cet appareil.' : 'Connexion au serveur en cours… La partie est sauvegardée sur cet appareil en attendant.'}</div>
      ${loginForm.replace('</button></div>', `</button>
        <button class="btn small btn-primary" data-action="cloud-register" ${busy}>Créer un compte joueur</button></div>`)}
      <div class="muted">Pas encore de compte ? Choisissez un nom d'utilisateur et un mot de passe (8 caractères min.), puis « Créer un compte joueur ».</div>
      ${c.optedOut ? `<div class="options-row"><button class="btn small" data-action="cloud-resume" ${busy}>Sauvegarder en ligne sans compte</button></div>` : ''}
      ${msg}
    </div>`;
}

function windowOptions(ui) {
  if (!ui.desktop) return '';
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

// Dépôt GitHub privé (version dev) : jeton en lecture seule collé ici, gardé uniquement sur ce PC.
// v9.1.0 : retiré de la version joueur (il parlait de Settings et de Danger Zone à un joueur).
function privateRepoHelp(u) {
  if (!BUILD.cheats) return '';
  let has = false;
  try { has = Boolean(localStorage.getItem('idle-rpg.github-token')); } catch { /* indisponible */ }
  if (BUILT_IN_TOKEN && !has && u.status !== 'error') return '';
  const show = has || (u.status === 'error' && /404/.test(u.error ?? ''));
  if (!show) return '';
  return `<details class="update-notes" ${has ? '' : 'open'}><summary>Dépôt privé : jeton GitHub (version dev)</summary>
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

// v9.1.0 : Paramètres en 4 onglets (au plus un segment visible). Son et Fenêtre n'apparaissent que s'ils
// ont un contenu (moteur de son prêt ; version bureau).
export function optionTabs(ui) {
  return [['general', 'Général'], ['interface', 'Interface'], ...(soundOptions(ui) ? [['sound', 'Son']] : []), ...(ui.desktop ? [['window', 'Fenêtre']] : [])];
}

function generalTab(ui, state) {
  const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
  const code = ui.view.exportCode;
  return `<div class="card">
        <div class="section-title">Langue · Language</div>
        <div class="chip-row" data-no-i18n>
          <button class="btn chip-btn${getLang() === 'fr' ? ' active' : ''}" data-action="lang" data-value="fr">🇫🇷 Français</button>
          <button class="btn chip-btn${getLang() === 'en' ? ' active' : ''}" data-action="lang" data-value="en">🇬🇧 English</button>
        </div>
      </div>
      <div class="card">
        <div class="section-title">Sauvegarde</div>
        <div class="row-between"><span>Dernière sauvegarde : il y a ${formatDuration(ago)}</span>
          <button class="btn small" data-action="save">Sauvegarder</button></div>
        <div class="muted">Automatique toutes les ${BALANCE.autosaveSeconds} s, à chaque action et à la fermeture. Jeu fermé, le héros gagne
          encore ${BALANCE.offline.farmMultiplier * 100} % de son rythme, ${BALANCE.offline.capHours} h au plus.</div>
        <div class="options-row">
          <button class="btn small" data-action="export-save" data-value="file">Exporter (fichier)</button>
          <button class="btn small" data-action="export-save" data-value="code">Copier le code</button>
          <button class="btn small" data-action="import-open">Importer…</button>
        </div>
        ${code ? `<textarea class="save-code" readonly rows="3" aria-label="Code de sauvegarde">${escapeHtml(code)}</textarea>` : ''}
        ${ui.view.importOpen ? `<div class="import-box">
          <div class="muted">Collez un code de sauvegarde, ou choisissez un fichier .json exporté. La partie actuelle est d'abord copiée
            à part, puis le jeu redémarre sur la partie importée.</div>
          <textarea id="import-text" rows="3" placeholder="Code ou contenu du fichier…" aria-label="Sauvegarde à importer"></textarea>
          <div class="options-row"><input id="import-file" type="file" accept=".json,application/json" aria-label="Fichier de sauvegarde">
            <button class="btn btn-gold small" data-action="import-save">Importer</button>
            <button class="btn small" data-action="import-open">Annuler</button></div>
        </div>` : ''}
      </div>
      ${cloudOptions(ui)}
      ${versionOptions(ui)}
      <div class="card">
        <div class="section-title">Tutoriel</div>
        <div class="row-between"><span class="muted">Revoir la présentation du jeu.</span>
          <button class="btn small" data-action="tour-full">Revoir le tutoriel</button></div>
      </div>
      ${cheatCard(state, ui)}
      ${devOfflineCard()}
      <div class="card danger-zone">
        <div class="section-title">Zone de danger</div>
        <div class="row-between"><span class="muted">Efface toute la progression de cet appareil. Exportez votre partie avant.</span>
          <button class="btn btn-danger small" data-action="reset">Réinitialiser la partie…</button></div>
      </div>`;
}

// Test des gains hors ligne : version dev seulement (il applique les vrais gains, sans limite).
function devOfflineCard() {
  if (!BUILD.cheats) return '';
  return `<div class="card">
        <div class="section-title">Test des gains hors ligne (dev)</div>
        <div class="options-row">
          <button class="btn small" data-action="simulate" data-seconds="3600">1 h</button>
          <button class="btn small" data-action="simulate" data-seconds="28800">8 h</button>
          <button class="btn small" data-action="simulate" data-seconds="86400">24 h</button>
        </div>
      </div>`;
}

function interfaceTab(ui, state) {
  return `<div class="card">
        <div class="section-title">Thème</div>
        <div class="muted">Style des menus (les couleurs des raretés ne changent pas). Chevalier est le style sobre.</div>
        <div class="theme-grid">${THEMES.map((t) => `<button class="btn theme-btn${(state.ui.theme ?? 'knight') === t.id ? ' active' : ''}" data-action="theme" data-value="${t.id}">
          <span class="theme-swatches">${themeSwatches(t.id).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
          <b>${escapeHtml(t.name)}</b><span class="muted">${escapeHtml(t.text)}</span></button>`).join('')}</div>
      </div>
      ${ui.interfaceExtra?.(state) ?? ''}
      <div class="card">
        <div class="section-title">Notifications</div>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="boss" ${state.ui.notify?.boss !== false ? 'checked' : ''}> Bannières d'arrivée des boss</label>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="events" ${state.ui.notify?.events !== false ? 'checked' : ''}> Messages des événements (coffres, marchands…)</label>
        <label class="toggle"><input type="checkbox" data-action="cinematics" ${state.ui.cinematics !== false ? 'checked' : ''}> Cinématiques (lancement du jeu, nouveau monde)</label>
      </div>
      <div class="card">
        <div class="section-title">Raccourcis clavier</div>
        <div class="row-between"><span class="muted">${shortcutsSummary()}</span>
          <button class="btn small" data-action="show-shortcuts">Tout voir (K)</button></div>
      </div>
      <div class="card">
        <div class="section-title">Journal de la session</div>
        <div class="row-between"><span class="muted">Étapes, boss, or, objets ramassés, recyclés et fusionnés depuis le lancement du jeu.</span>
          <button class="btn small" data-action="show-journal">📜 Ouvrir (J)</button></div>
      </div>`;
}

export default {
  id: 'options',
  title: 'Paramètres',
  icon: 'icon_gear',
  render(ui, state) {
    const tabs = optionTabs(ui);
    const tab = tabs.some(([id]) => id === ui.view.optTab) ? ui.view.optTab : 'general';
    const seg = `<div class="seg" role="tablist">${tabs.map(([id, label]) => `<button class="seg-btn${id === tab ? ' active' : ''}" role="tab"
      aria-selected="${id === tab}" data-action="opt-tab" data-value="${id}">${label}</button>`).join('')}</div>`;
    const body = tab === 'interface' ? interfaceTab(ui, state) : tab === 'sound' ? soundOptions(ui) : tab === 'window' ? windowOptions(ui) : generalTab(ui, state);
    return seg + body;
  },
};
