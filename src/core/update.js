// Mises à jour (v7.8) : comparaison de versions et lecture de la dernière release GitHub.
export const RELEASES_API = 'https://api.github.com/repos/ErwannL/idleproject/releases/latest';
export const RELEASES_PAGE = 'https://github.com/ErwannL/idleproject/releases/latest';

// « v7.10.0 » > « 7.9.2 » : comparaison numérique champ par champ.
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// Réponse de l'API GitHub → { version, url, notes, setup } (setup = installateur Windows s'il existe).
export function parseRelease(json) {
  if (!json || typeof json.tag_name !== 'string') return null;
  const version = json.tag_name.replace(/^v/i, '');
  const setup = (json.assets ?? []).find((a) => /^IdleRPG-[\d.]+-setup\.exe$/.test(a?.name ?? ''));
  return {
    version,
    url: typeof json.html_url === 'string' ? json.html_url : RELEASES_PAGE,
    notes: typeof json.body === 'string' ? json.body.slice(0, 1500) : '',
    setup: setup ? { name: setup.name, url: setup.browser_download_url, size: setup.size ?? 0 } : null,
  };
}

export function updateStatus(current, release) {
  if (!release) return 'error';
  return compareVersions(release.version, current) > 0 ? 'available' : 'uptodate';
}
