// Paramètres (v9.1.0 : 4 onglets) : Général (langue, sauvegarde, export / import, compte, version, tutoriel,
// zone de danger), Interface, Son, Fenêtre (version bureau).
import { BALANCE } from '../../data/balance.js';
import { formatDuration } from '../../core/format.js';
import { escapeHtml, fold, formatNumber, img } from '../common.js';
import { isPhone } from '../prefs.js';
import { mBtn, mBtnGold, mChip, mModes, mStat } from '../mobile-kit.js'; // v10.12
import { isMPhone, kitify, mpBtns, mpChips, mpField, mpFold, mpFrame, mpSec, mpSwitch } from './profile-m.js';
import { availableLangs, getLang } from '../../i18n/i18n.js';
import { THEMES, themeSwatches } from '../themes.js';
import { ownsTheme } from '../../core/cosmetics.js'; // v9.2.8
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
      <div class="muted">Pour choisir ton nom et retrouver ta partie sur un autre appareil, crée ton compte joueur. Ta progression le suit.</div>
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
        <div class="muted">La progression de ton compte remplacera celle de cet appareil (une copie est gardée).</div>
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
      <div class="muted">Pas encore de compte ? Choisis un nom d'utilisateur et un mot de passe (8 caractères min.), puis « Créer un compte joueur ».</div>
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
        <button class="btn small" data-action="window-size" data-preset="widget" title="320 × 180 : la scène et une ligne (or, niveau, vague)">Widget</button>
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

export const playsOnSite = (ui) => !ui.desktop && !globalThis.Capacitor?.isNativePlatform?.() && globalThis.location?.pathname.startsWith('/play');

// Version lancée + dernière version publiée sur GitHub (github.com/ErwannL/idleproject).
function versionOptions(ui) {
  const current = ui.desktop?.version ?? GAME_VERSION;
  // Jeu du site (/play/) : servi par le serveur, toujours à jour ; pas de vérification GitHub (dépôt privé : 404).
  if (playsOnSite(ui)) {
    return `<div class="card">
      <div class="section-title">Version et mises à jour</div>
      <div>Version : <b class="num">${escapeHtml(current)}</b> (site). Le jeu du site est toujours à la dernière version.</div>
    </div>`;
  }
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
      <div class="row-between"><span><b class="gold-text">Ascendrya</b> · version lancée : <b class="num">${escapeHtml(current)}</b> ${ui.desktop ? '(bureau)' : '(navigateur)'}</span>
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
// v10.12 : un <select> sur PC, une rangée de puces sur téléphone (même action, même effet).
const selectOr = (ui, action, items, current) => (isMPhone(ui) ? mpChips(action, items, current)
  : `<select data-action="${action}">${items.map(([v, l]) => `<option value="${v}"${current === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`);

export function optionTabs(ui) {
  return [['general', 'Général'], ['interface', 'Interface'], ...(soundOptions(ui) ? [['sound', 'Son']] : []), ...(ui.desktop ? [['window', 'Fenêtre']] : [])];
}

function generalTab(ui, state) {
  const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
  const code = ui.view.exportCode;
  return `<div class="card">
        <div class="section-title">Langue · Language</div>
        <div class="chip-row" data-no-i18n>
          ${availableLangs().map((l) => `<button class="btn chip-btn${getLang() === l.code ? ' active' : ''}" data-action="lang" data-value="${l.code}">${l.flag} ${l.label}</button>`).join('')}
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
          <div class="muted">Colle un code de sauvegarde, ou choisis un fichier .json exporté. La partie actuelle est d'abord copiée
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
          <button class="btn small" data-action="tour-full">Revoir le tutoriel</button>
          <button class="btn small" data-action="replay-prologue">Revoir le prologue</button></div>
      </div>
      ${cheatCard(state, ui)}
      ${devOfflineCard()}
      <div class="card danger-zone">
        <div class="section-title">Zone de danger</div>
        <div class="row-between"><span class="muted">Efface toute la progression de cet appareil. Exporte ta partie avant.</span>
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

// v9.1.3 (doc1 « Paramètres ») : Interface allégée — thème et notifications repliés, touches clavier masquées sur
// téléphone (aucun clavier).
function interfaceTab(ui, state) {
  const phone = isPhone();
  const theme = THEMES.find((t) => t.id === (state.ui.theme ?? 'knight'));
  return `${fold(ui, 'opt-theme', 'Thème', () => `<div class="muted">Style des menus (les couleurs des raretés ne changent pas). Chevalier est le style sobre.</div>
        <div class="theme-grid">${THEMES.map((t) => { const mine = ownsTheme(state, t.id); // v9.2.8 : thèmes de boutique verrouillés tant qu'ils ne sont pas possédés
          return `<button class="btn theme-btn${(state.ui.theme ?? 'knight') === t.id ? ' active' : ''}${mine ? '' : ' locked'}" data-action="${mine ? 'theme' : 'theme-preview'}" data-value="${t.id}">
          <span class="theme-swatches">${themeSwatches(t.id).map((c) => `<i style="background:${c}"></i>`).join('')}</span>
          <b>${escapeHtml(t.name)}</b><span class="muted">${escapeHtml(t.text)}</span>${mine ? '' : `<span class="muted">${img('icon_lock')} Boutique › Thèmes · Aperçu</span>`}</button>`; }).join('')}</div>`, { extra: escapeHtml(theme?.name ?? '') })}
      <label class="toggle card"><input type="checkbox" data-action="simple-mode" ${state.ui.simple === true ? 'checked' : ''}> <b>Mode simple</b> <span class="muted">cache les détails et les systèmes avancés tant que tu n'en as pas besoin</span></label>
      <div class="card row-between"><span><b>Aide au combat</b> <span class="muted">${{ full: 'tout se joue seul', mixed: 'tes actions comptent plus, le reste part seul', manual: 'rien ne part sans toi' }[state.ui.combatAssist ?? 'mixed']}</span></span>
        ${selectOr(ui, 'combat-assist', [['full', 'Complet'], ['mixed', 'Mixte'], ['manual', 'Manuel']], state.ui.combatAssist ?? 'mixed')}</div>
      <div class="card row-between"><b>Taille des personnages</b>
        ${selectOr(ui, 'char-size', [['auto', 'Auto'], ['small', 'Petit'], ['medium', 'Moyen'], ['large', 'Grand']], state.ui.charSize ?? 'auto')}</div>
      ${ui.interfaceExtra?.(state) ?? ''}
      ${fold(ui, 'opt-notify', 'Notifications', () => `
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="boss" ${state.ui.notify?.boss !== false ? 'checked' : ''}> Bannières d'arrivée des boss</label>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="events" ${state.ui.notify?.events !== false ? 'checked' : ''}> Messages des événements (coffres, marchands…)</label>
        <button class="btn" data-action="sleep-mode">🔥 Veillée au Camp (écran sombre, le jeu continue)</button>
        <div class="row-between"><span>Veillée automatique (5 min sans toucher)</span>${selectOr(ui, 'vigil-auto', [['never', 'Jamais'], ['phone', 'Téléphone seulement'], ['always', 'Toujours']], state.ui.vigil ?? 'phone')}</div>
        <label class="toggle"><input type="checkbox" data-action="notify" data-key="phone" ${state.ui.notify?.phone !== false ? 'checked' : ''}> Notifications du téléphone (2 par jour au plus)</label>
        <label class="toggle"><input type="checkbox" data-action="cinematics" ${state.ui.cinematics !== false ? 'checked' : ''}> Cinématiques (lancement du jeu, nouveau monde)</label>
        <label class="toggle"><input type="checkbox" data-action="screen-shake" ${state.ui.shake !== false ? 'checked' : ''}> Tremblement de l'écran (compétences de zone, coups de boss)</label>
        <label class="toggle"><input type="checkbox" data-action="auto-equip" ${state.ui.autoEquip === true ? 'checked' : ''}> Équiper automatiquement les meilleurs objets (au retour de session)</label>
        <label class="toggle"><input type="checkbox" data-action="skill-names" ${state.ui.skillNames !== false ? 'checked' : ''}> Noms des sorts au-dessus du héros et des compagnons</label>
        <label class="toggle"><input type="checkbox" data-action="gain-feed" ${state.ui.feed !== false ? 'checked' : ''}> Fil des gains à gauche de la scène</label>
        <label class="toggle"><input type="checkbox" data-action="big-auras" ${state.ui.bigAuras === true ? 'checked' : ''}> Grandes auras des compagnons 5★ (sinon un simple liseré)</label>
        <label class="toggle"><input type="checkbox" data-action="metrics-opt-in" ${state.ui.metricsOptIn === true ? 'checked' : ''}> Mesures anonymes (version, monde, niveau, temps de jeu — aucun identifiant)</label>`)}
      ${phone ? '' : `<div class="card">
        <div class="section-title">Raccourcis clavier</div>
        <div class="row-between"><span class="muted">${shortcutsSummary()}</span>
          <button class="btn small" data-action="show-shortcuts">Tout voir (K)</button></div>
      </div>`}
      <div class="card">
        <div class="row-between"><span><b>Journal de la session</b> <span class="muted">étapes, boss, or et objets depuis le lancement.</span></span>
          <button class="btn small" data-action="show-journal">📜 Ouvrir${phone ? '' : ' (J)'}</button></div>
      </div>`;
}

// ---------- v10.12 : Paramètres sur téléphone, entièrement en kit (cartes .m-card, puces, interrupteurs .m-switch, boutons .m-btn) ----------
// Mêmes réglages, mêmes data-action que le PC ; les explications longues sont repliées (mpFold).
function cloudPhone(ui) {
  if (!BUILD.cloud) return '';
  const c = ui.cloud ?? {};
  const busy = c.busy;
  const msg = c.message ? `<div class="mp-msg${c.error ? ' bad' : ''}" role="status">${escapeHtml(c.message)}</div>` : '';
  const input = (id, type, ph, extra = '', val = '') => `<input id="${id}" class="mp-in" type="${type}" ${val ? `value="${escapeHtml(val)}"` : ''} maxlength="${type === 'password' ? 200 : 20}" placeholder="${ph}" ${extra} aria-label="${ph}">`;
  const loginForm = `${input('cloud-pseudo', 'text', 'Nom d\'utilisateur', 'autocomplete="username"', c.draft?.['cloud-pseudo'] ?? '')}${input('cloud-password', 'password', 'Mot de passe', 'autocomplete="current-password"')}`;
  const listed = mpSwitch('Classement public', 'cloud-listed', c.listed !== false, { sub: 'Nom, niveau, étape, boss' });
  let body;
  if (c.loggedIn && c.guest) {
    body = `<div class="m-card"><div class="mp-between"><span>Nom</span><b>${escapeHtml(c.pseudo)}</b></div>
        <div class="mp-form">${input('cloud-claim-pseudo', 'text', 'Choisis ton nom (3 à 20)', 'autocomplete="username"', c.draft?.['cloud-claim-pseudo'] ?? '')}
          ${input('cloud-claim-password', 'password', 'Mot de passe (8 min.)', 'autocomplete="new-password"')}${input('cloud-claim-confirm', 'password', 'Confirmer le mot de passe', 'autocomplete="new-password"')}</div>
        ${mpBtns([mBtn('Créer mon compte', { action: 'cloud-claim', disabled: busy, cls: 'ready' }), mBtn('Synchroniser', { action: 'cloud-sync', disabled: busy })])}${msg}</div>
      ${listed}
      <details class="m-card mp-det"><summary>J'ai déjà un compte</summary><div class="mp-form">${loginForm}</div>${mBtn('Se connecter', { action: 'cloud-login', disabled: busy })}</details>
      ${mpFold(ui, 'opt-cloud-info', 'Pourquoi un compte ?', '<div class="mp-note">Ta progression est déjà sauvegardée sur le serveur. Un compte te laisse choisir ton nom et la retrouver sur un autre appareil. Se connecter à un compte existant remplace la partie de cet appareil (une copie est gardée).</div>')}`;
  } else if (c.loggedIn) {
    body = `<div class="m-card"><div class="mp-between"><span>Connecté</span><b>${escapeHtml(c.pseudo)}</b></div>
        ${mpBtns([mBtn('Synchroniser', { action: 'cloud-sync', disabled: busy }), mBtn('Se déconnecter', { action: 'cloud-logout' })])}${msg}</div>
      ${listed}
      <details class="m-card mp-det"><summary>Changer de nom</summary><div class="mp-form">${input('cloud-rename-pseudo', 'text', 'Nouveau nom (3 à 20)', 'autocomplete="username"', c.draft?.['cloud-rename-pseudo'] ?? '')}${input('cloud-rename-password', 'password', 'Mot de passe du compte', 'autocomplete="current-password"')}</div>${mBtn('Changer de nom', { action: 'cloud-rename', disabled: busy })}</details>
      <details class="m-card mp-det"><summary>Supprimer mon compte</summary><div class="mp-note">Efface le compte et la progression du serveur. La partie reste sur cet appareil.</div><div class="mp-form">${input('cloud-delete-password', 'password', 'Mot de passe du compte', 'autocomplete="current-password"')}</div>${mBtn('Supprimer', { action: 'cloud-delete', cls: 'mp-danger' })}</details>`;
  } else {
    const status = c.optedOut ? 'Déconnecté : partie sur cet appareil.' : c.error ? 'Hors ligne : partie sur cet appareil.' : 'Connexion au serveur…';
    body = `<div class="m-card"><div class="mp-note">${status}</div><div class="mp-form">${loginForm}</div>
        ${mpBtns([mBtn('Se connecter', { action: 'cloud-login', disabled: busy }), mBtn('Créer un compte', { action: 'cloud-register', disabled: busy, cls: 'ready' })])}
        ${c.optedOut ? mBtn('Sauvegarder en ligne sans compte', { action: 'cloud-resume', disabled: busy }) : ''}${msg}</div>
      ${mpFold(ui, 'opt-cloud-info', 'Comment créer un compte ?', '<div class="mp-note">Choisis un nom d\'utilisateur et un mot de passe (8 caractères min.), puis « Créer un compte ».</div>')}`;
  }
  return `${mpSec('Compte en ligne')}${body}`;
}

function versionPhone(ui) {
  const current = ui.desktop?.version ?? GAME_VERSION;
  if (playsOnSite(ui)) return `${mpSec('Version')}<div class="m-card">${mStat('icon_star', 'Version', current)}<div class="mp-note">Site : toujours à jour.</div></div>`;
  const u = ui.updateInfo ?? {};
  const rel = u.release;
  let status = 'Pas encore vérifié';
  if (u.busy) status = 'Vérification…';
  else if (u.status === 'uptodate') status = `À jour · ${escapeHtml(rel.version)}`;
  else if (u.status === 'error') status = 'Hors ligne';
  else if (u.status === 'available') status = `Nouvelle version ${escapeHtml(rel.version)}`;
  const install = u.status === 'available'
    ? (ui.desktop ? mBtn(u.installing ? 'Téléchargement…' : `Mettre à jour (${rel.version})`, { action: 'install-update', disabled: u.installing || !rel.setup, cls: 'ready' })
      : mBtn(`Télécharger la ${rel.version}`, { action: 'open-releases', cls: 'ready' })) : '';
  const notes = u.status === 'available' && rel.notes ? `<details class="m-card mp-det"><summary>Nouveautés</summary><pre>${escapeHtml(rel.notes)}</pre></details>` : '';
  return `${mpSec('Version')}<div class="m-card">${mStat('icon_star', `Ascendrya ${ui.desktop ? '(bureau)' : '(navigateur)'}`, current)}${mStat('icon_gear', 'Mises à jour', status)}
      ${u.error && u.status !== 'error' ? `<div class="mp-msg bad">${escapeHtml(u.error)}</div>` : ''}
      ${mpBtns([mBtn('Vérifier', { action: 'check-update', disabled: u.busy }), mBtn('Versions', { action: 'open-releases' })])}${install}</div>${notes}${kitify(privateRepoHelp(u))}`;
}

function generalPhone(ui, state) {
  const ago = Math.max(0, (Date.now() - state.lastSaved) / 1000);
  const code = ui.view.exportCode;
  const langs = `<div class="m-chips mp-chips mp-scroll" role="group" aria-label="Langue" data-no-i18n>${availableLangs().map((l) => mChip(`${l.flag} ${l.label}`, { action: 'lang', value: l.code, on: getLang() === l.code })).join('')}</div>`;
  const imp = ui.view.importOpen ? `<div class="m-card"><textarea id="import-text" class="mp-in" rows="3" placeholder="Code ou fichier…" aria-label="Sauvegarde à importer"></textarea>
      <label class="m-btn mp-file">Choisir un fichier…<input id="import-file" type="file" accept=".json,application/json" aria-label="Fichier de sauvegarde" style="position:absolute;width:1px;height:1px;opacity:0" onchange="this.parentNode.firstChild.textContent=(this.files[0]?.name??'Choisir un fichier…')"></label>
      ${mpBtns([mBtn('Importer', { action: 'import-save', cls: 'ready' }), mBtn('Annuler', { action: 'import-open' })])}</div>` : '';
  return `${mpField('Langue · Language', langs)}
    ${mpSec('Sauvegarde')}
    <div class="m-card">${mStat('icon_timer', 'Dernière', `il y a ${formatDuration(ago)}`)}${mBtnGold('Sauvegarder', { action: 'save' })}
      ${mpBtns([mBtn('Exporter', { action: 'export-save', value: 'file' }), mBtn('Copier code', { action: 'export-save', value: 'code' }), mBtn('Importer', { action: 'import-open' })])}
      ${code ? `<textarea class="mp-in" readonly rows="3" aria-label="Code de sauvegarde">${escapeHtml(code)}</textarea>` : ''}</div>${imp}
    ${mpFold(ui, 'opt-save-info', 'Comment ça marche ?', `<div class="mp-note">Sauvegarde automatique toutes les ${BALANCE.autosaveSeconds} s, à chaque action et à la fermeture. Jeu fermé, le héros gagne ${BALANCE.offline.farmMultiplier * 100} % de son rythme, ${BALANCE.offline.capHours} h au plus. Importer copie d'abord la partie actuelle, puis redémarre sur la partie importée.</div>`)}
    ${cloudPhone(ui)}
    ${versionPhone(ui)}
    ${mpSec('Tutoriel')}${mpBtns([mBtn('Revoir le tutoriel', { action: 'tour-full' }), mBtn('Revoir le prologue', { action: 'replay-prologue' })])}
    ${kitify(cheatCard(state, ui))}${kitify(devOfflineCard())}
    ${mpSec('Zone de danger')}<div class="m-card mp-dz">${mBtn('Réinitialiser la partie…', { action: 'reset', cls: 'mp-danger' })}<div class="mp-note">Efface tout sur cet appareil. Exporte avant.</div></div>`;
}

function interfacePhone(ui, state) {
  const cur = state.ui.theme ?? 'knight';
  const theme = THEMES.find((t) => t.id === cur);
  const themes = () => `<div class="mp-themes">${THEMES.map((t) => { const mine = ownsTheme(state, t.id);
    return `<button type="button" class="mp-theme${cur === t.id ? ' on' : ''}${mine ? '' : ' locked'}" data-action="${mine ? 'theme' : 'theme-preview'}" data-value="${t.id}">
      <span class="theme-swatches">${themeSwatches(t.id).map((c) => `<i style="background:${c}"></i>`).join('')}</span><b>${escapeHtml(t.name)}</b>${mine ? '' : `<small>${img('icon_lock')} Boutique</small>`}</button>`; }).join('')}</div>`;
  const assist = state.ui.combatAssist ?? 'mixed';
  const sw = (label, action, on, key, sub) => mpSwitch(label, action, on, { attrs: key ? `data-key="${key}"` : '', sub });
  return `${mpFold(ui, 'opt-theme', 'Thème', themes, escapeHtml(theme?.name ?? ''))}
    ${sw('Mode simple', 'simple-mode', state.ui.simple === true, '', 'Cache les systèmes avancés')}
    ${mpField('Aide au combat', mpChips('combat-assist', [['full', 'Complet'], ['mixed', 'Mixte'], ['manual', 'Manuel']], assist), { full: 'Tout se joue seul', mixed: 'Tes actions comptent plus', manual: 'Rien sans toi' }[assist])}
    ${mpField('Taille des personnages', mpChips('char-size', [['auto', 'Auto'], ['small', 'Petit'], ['medium', 'Moyen'], ['large', 'Grand']], state.ui.charSize ?? 'auto'))}
    ${ui.interfaceExtra?.(state) ?? ''}
    ${mpSec('Notifications et effets')}
    ${sw('Bannières des boss', 'notify', state.ui.notify?.boss !== false, 'boss')}${sw('Messages d\'événements', 'notify', state.ui.notify?.events !== false, 'events', 'Coffres, marchands…')}
    ${sw('Notifications du téléphone', 'notify', state.ui.notify?.phone !== false, 'phone', '2 par jour au plus')}${sw('Cinématiques', 'cinematics', state.ui.cinematics !== false, '', 'Lancement, nouveau monde')}
    ${sw('Tremblement d\'écran', 'screen-shake', state.ui.shake !== false, '', 'Zone, coups de boss')}${sw('Équipement auto', 'auto-equip', state.ui.autoEquip === true, '', 'Au retour de session')}
    ${sw('Noms des sorts', 'skill-names', state.ui.skillNames !== false, '', 'Au-dessus des unités')}${sw('Fil des gains', 'gain-feed', state.ui.feed !== false, '', 'À gauche de la scène')}
    ${sw('Grandes auras 5★', 'big-auras', state.ui.bigAuras === true, '', 'Sinon un simple liseré')}${sw('Mesures anonymes', 'metrics-opt-in', state.ui.metricsOptIn === true, '', 'Aucun identifiant')}
    ${mpField('Veillée automatique', mpChips('vigil-auto', [['never', 'Jamais'], ['phone', 'Téléphone'], ['always', 'Toujours']], state.ui.vigil ?? 'phone'), 'Après 5 min sans toucher')}
    ${mBtn('Veillée au Camp', { action: 'sleep-mode', icon: 'icon_star' })}<div class="mp-gap"></div>${mBtn('Journal de la session', { action: 'show-journal', icon: 'icon_book' })}`;
}

function soundPhone(ui) {
  const s = ui.sound?.settings;
  if (!s) return '';
  const slider = (kind, label) => `<label class="m-card mp-vol"><b>${label}</b><input type="range" min="0" max="100" step="5" value="${Math.round(s[kind] * 100)}" data-action="volume" data-kind="${kind}" aria-label="${label}"></label>`;
  return `${mpSwitch('Couper le son', 'mute', Boolean(s.muted))}${slider('master', 'Général')}${slider('music', 'Musique')}${slider('sfx', 'Effets')}`;
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
    if (isMPhone(ui)) {
      const body = tab === 'interface' ? interfacePhone(ui, state) : tab === 'sound' ? soundPhone(ui) : tab === 'window' ? kitify(windowOptions(ui)) : generalPhone(ui, state);
      const ico = { general: 'icon_gear', interface: 'icon_star', sound: 'icon_bolt', window: 'icon_map' };
      return mpFrame('icon_gear', 'Paramètres', `${mModes(tabs.map(([id, label]) => ({ id, label, icon: ico[id] ?? 'icon_gear', action: 'opt-tab', value: id })), tab, { size: 64 })}${body}`);
    }
    const body = tab === 'interface' ? interfaceTab(ui, state) : tab === 'sound' ? soundOptions(ui) : tab === 'window' ? windowOptions(ui) : generalTab(ui, state);
    return seg + body;
  },
};
