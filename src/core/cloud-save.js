// Sauvegarde cloud (optionnelle). Le jeu reste jouable en local : toute erreur réseau
// laisse la sauvegarde locale intacte. Le client ne fait que transporter la chaîne JSON de la partie.
import { SAVE_KEY } from './save.js';

export const TOKEN_KEY = 'idle-rpg.cloud-token';
export const PSEUDO_KEY = 'idle-rpg.cloud-pseudo';

export class CloudError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// `baseUrl` vide = même origine (site et jeu servis par le même serveur).
export function createCloudClient({ baseUrl = '', storage, fetchImpl = globalThis.fetch }) {
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

  function remember(token, pseudo) {
    try {
      storage.setItem(TOKEN_KEY, token);
      storage.setItem(PSEUDO_KEY, pseudo);
    } catch {
      // Stockage indisponible : la session ne survivra pas au rechargement.
    }
  }

  function forget() {
    try {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(PSEUDO_KEY);
    } catch {
      // Rien à faire.
    }
  }

  return {
    isLoggedIn: () => Boolean(readToken()),
    pseudo: () => {
      try {
        return storage.getItem(PSEUDO_KEY);
      } catch {
        return null;
      }
    },
    async register(pseudo, password) {
      const data = await request('POST', '/api/register', { body: { pseudo, password }, auth: false });
      remember(data.token, data.pseudo);
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
      }
    },
    // Renvoie { data, version } ; data = chaîne JSON de la partie, ou null si aucune sauvegarde.
    pull: () => request('GET', '/api/save'),
    // `version` = version connue lors du dernier pull/push. Lève CloudError(409) si périmée.
    push: (version, data) => request('PUT', '/api/save', { body: { version, data } }),
    // Suppression du compte et de toutes ses données sur le serveur (RGPD).
    async deleteAccount(password) {
      await request('DELETE', '/api/account', { body: { password } });
      forget();
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
export function reconcile(localJson, cloudJson) {
  if (!cloudJson) return localJson ? 'push' : 'none';
  if (!localJson || isFreshSave(localJson)) return 'pull';
  const local = Number(JSON.parse(localJson).lastSaved) || 0;
  const cloud = Number(JSON.parse(cloudJson).lastSaved) || 0;
  if (cloud > local) return 'pull';
  if (local > cloud) return 'push';
  return 'none';
}

// Synchronisation complète au lancement ou à la connexion. Renvoie l'action effectuée.
export async function syncOnce({ client, storage, version = 0 }) {
  const remote = await client.pull();
  const local = storage.getItem(SAVE_KEY);
  const action = reconcile(local, remote.data);
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
