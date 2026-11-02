// Sauvegarde cloud (optionnelle). Le jeu reste jouable en local : toute erreur réseau
// laisse la sauvegarde locale intacte. Le client ne fait que transporter la chaîne JSON de la partie.
import { SAVE_KEY } from './save.js';

export const TOKEN_KEY = 'idle-rpg.cloud-token';
export const PSEUDO_KEY = 'idle-rpg.cloud-pseudo';
// v9.1.1 : '1' si le compte est un invité automatique (joueurXXXXXX) ; '1' dans OPTOUT_KEY si le joueur s'est
// déconnecté exprès (aucun nouvel invité n'est alors créé tout seul).
export const GUEST_KEY = 'idle-rpg.cloud-guest';
export const OPTOUT_KEY = 'idle-rpg.cloud-optout';
// Copie de la partie de l'appareil, gardée quand une connexion ramène la partie du compte.
export const BEFORE_LOGIN_KEY = 'idle-rpg.save.before-login';

export class CloudError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// `baseUrl` vide = même origine (site et jeu servis par le même serveur).
export function createCloudClient({ baseUrl = '', storage, fetchImpl = globalThis.fetch, client = {} }) {
  const get = (k) => {
    try {
      return storage.getItem(k);
    } catch {
      return null;
    }
  };
  const set = (k, v) => {
    try {
      if (v === null) storage.removeItem(k);
      else storage.setItem(k, v);
    } catch {
      // Stockage indisponible.
    }
  };
  const readToken = () => {
    try {
      return storage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  };

  async function request(method, path, { body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const token = readToken();
      if (!token) throw new CloudError(401, 'Connexion requise');
      headers.Authorization = `Bearer ${token}`;
    }
    let res;
    try {
      res = await fetchImpl(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new CloudError(0, 'Serveur indisponible');
    }
    const text = res.status === 204 ? '' : await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new CloudError(res.status, data?.error ?? 'Erreur serveur', data ?? {});
    return data;
  }

  function remember(token, pseudo, guest = false) {
    if (token) set(TOKEN_KEY, token);
    set(PSEUDO_KEY, pseudo);
    set(GUEST_KEY, guest ? '1' : null);
    set(OPTOUT_KEY, null);
  }

  function forget() {
    set(TOKEN_KEY, null);
    set(PSEUDO_KEY, null);
    set(GUEST_KEY, null);
  }

  return {
    isLoggedIn: () => Boolean(readToken()),
    pseudo: () => get(PSEUDO_KEY),
    isGuest: () => get(GUEST_KEY) === '1',
    // Oublie la session locale sans bloquer la création d'un nouvel invité (session expirée).
    forget,
    optedOut: () => get(OPTOUT_KEY) === '1',
    async register(pseudo, password) {
      const data = await request('POST', '/api/register', { body: { pseudo, password }, auth: false });
      remember(data.token, data.pseudo);
      return data.pseudo;
    },
    // Compte invité automatique (premier lancement) : nom joueurXXXXXX, sans mot de passe.
    async guest() {
      const data = await request('POST', '/api/guest', { body: { platform: client.platform, gameVersion: client.version }, auth: false });
      remember(data.token, data.pseudo, true);
      return data.pseudo;
    },
    // Met à jour le nom et le type de compte depuis le serveur (renommage fait ailleurs, etc.).
    async refresh() {
      const data = await request('GET', '/api/account');
      remember(null, data.pseudo, data.guest);
      return data;
    },
    // Invité -> compte joueur : nom d'utilisateur + mot de passe. Même session, même progression.
    async claim(pseudo, password) {
      const data = await request('POST', '/api/account/claim', { body: { pseudo, password } });
      remember(null, data.pseudo, false);
      return data.pseudo;
    },
    async rename(pseudo, password) {
      const data = await request('PUT', '/api/account/pseudo', { body: { pseudo, password } });
      remember(null, data.pseudo, false);
      return data.pseudo;
    },
    async login(pseudo, password) {
      const data = await request('POST', '/api/login', { body: { pseudo, password }, auth: false });
      remember(data.token, data.pseudo);
      return data.pseudo;
    },
    async logout() {
      try {
        if (readToken()) await request('POST', '/api/logout');
      } catch {
        // Déconnexion locale dans tous les cas.
      } finally {
        forget();
        set(OPTOUT_KEY, '1');
      }
    },
    // Renvoie { data, version } ; data = chaîne JSON de la partie, ou null si aucune sauvegarde.
    pull: () => request('GET', '/api/save'),
    // `version` = version connue lors du dernier pull/push. Lève CloudError(409) si périmée.
    // Plateforme et version dans le corps (pas d'en-tête personnalisé : un ancien serveur refuserait la requête CORS).
    push: (version, data) => request('PUT', '/api/save', { body: { version, data, platform: client.platform, gameVersion: client.version } }),
    // Apparaître ou non dans le classement public.
    setListed: (listed) => request('PUT', '/api/account/listed', { body: { listed } }),
    // Suppression du compte et de toutes ses données sur le serveur (RGPD).
    async deleteAccount(password) {
      await request('DELETE', '/api/account', { body: { password } });
      forget();
      set(OPTOUT_KEY, '1');
    },
  };
}

// Partie jamais jouée (nouvelle partie) : ne doit jamais écraser une sauvegarde cloud.
export function isFreshSave(json) {
  const s = JSON.parse(json);
  return (s.kills ?? 0) === 0 && (s.records?.kills ?? 0) === 0 && (s.maxStage ?? 1) <= 1 && (s.level ?? 1) <= 1;
}

// Compare la partie locale et la partie cloud (champ lastSaved) et dit quoi faire.
// Renvoie 'none' | 'push' | 'pull'.
// v9.1.3 (doc4 lot 1) : ne pousse jamais un format de sauvegarde inférieur à celui du cloud (un appareil pas encore
// rechargé dans le nouveau format écraserait la partie convertie). Il peut seulement tirer, ou ne rien faire.
export function reconcile(localJson, cloudJson) {
  if (!cloudJson) return localJson ? 'push' : 'none';
  if (!localJson || isFreshSave(localJson)) return 'pull';
  const l = JSON.parse(localJson);
  const c = JSON.parse(cloudJson);
  const local = Number(l.lastSaved) || 0;
  const cloud = Number(c.lastSaved) || 0;
  if (cloud > local) return 'pull';
  if (local > cloud) return (Number(l.version) || 1) < (Number(c.version) || 1) ? 'none' : 'push';
  return 'none';
}

// Retire l'état de triche avant envoi : le serveur refuse les sauvegardes qui en contiennent.
export function stripCheats(json) {
  if (!json) return json;
  const save = JSON.parse(json);
  if (!save.cheats) return json;
  save.cheats = { effects: [], reveal: false, speeds: [], skipBattle: false };
  return JSON.stringify(save);
}

// Synchronisation complète au lancement ou à la connexion. Renvoie l'action effectuée.
// preferRemote (connexion à un compte existant) : la partie du compte l'emporte toujours si elle existe ;
// celle de l'appareil est gardée en copie (BEFORE_LOGIN_KEY). Sans cela, quelques minutes jouées sur un
// nouvel appareil (plus récentes) écraseraient des semaines de progression.
// maxSaveVersion : format le plus récent que ce jeu sait lire. Une partie du serveur plus récente (enregistrée par
// un appareil mis à jour) n'est ni chargée ni écrasée : action 'newer', et le jeu doit bloquer ses écritures.
export async function syncOnce({ client, storage, version = 0, preferRemote = false, maxSaveVersion = Infinity }) {
  const remote = await client.pull();
  if (remote.data) {
    let v = 0;
    try { v = Number(JSON.parse(remote.data).version) || 0; } catch { v = 0; }
    if (v > maxSaveVersion) return { action: 'newer', version: remote.version, newerVersion: v };
  }
  const local = stripCheats(storage.getItem(SAVE_KEY));
  let action = reconcile(local, remote.data);
  if (preferRemote && remote.data) {
    action = remote.data === local ? 'none' : 'pull';
    if (action === 'pull' && local) storage.setItem(BEFORE_LOGIN_KEY, local);
  }
  if (action === 'pull') {
    storage.setItem(SAVE_KEY, remote.data);
    return { action, version: remote.version };
  }
  if (action === 'push') {
    const pushed = await client.push(remote.version, local);
    return { action, version: pushed.version };
  }
  return { action, version: remote.version || version };
}
