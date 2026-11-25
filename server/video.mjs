// Vidéo d'accueil du site : analyse (ffprobe), conseils en français, version d'URL et outils ffmpeg.
// Tout est pur ou injectable (`tools`) pour être testé sans ffmpeg.
import { execFile } from 'node:child_process';

const MO = 1048576;
// Seuils des conseils (pour le téléphone).
export const ADVICE_LIMITS = {
  pcHeavyBytes: 40 * MO,
  pcHeavyBitrate: 8_000_000,
  pcHeavyHeight: 1500, // plus de 1080p : 4K, 2K…
  phoneHeavyBytes: 15 * MO,
  phoneHeavyBitrate: 3_000_000,
  phoneHeavyHeight: 720,
  longSeconds: 60,
};
const BROWSER_VIDEO = new Set(['h264', 'vp8', 'vp9', 'av1']);

// Outils réels : ffprobe/ffmpeg s'ils sont installés. probe -> { available, data } ; run -> true si ffmpeg a réussi.
export function realTools() {
  const probe = (file) => new Promise((ok) => {
    execFile('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeout: 60_000, maxBuffer: 4 * MO }, (err, out) => {
      if (err && err.code === 'ENOENT') return ok({ available: false, data: null });
      try { ok({ available: true, data: err ? null : JSON.parse(out) }); } catch { ok({ available: true, data: null }); }
    });
  });
  const run = (args) => new Promise((ok) => execFile('ffmpeg', args, { timeout: 10 * 60_000 }, (err) => ok(!err)));
  const present = (cmd) => new Promise((ok) => execFile(cmd, ['-version'], { timeout: 10_000 }, (err) => ok(!err)));
  let seen = null;
  const has = () => (seen ??= Promise.all([present('ffmpeg'), present('ffprobe')]).then(([ffmpeg, ffprobe]) => ({ ffmpeg, ffprobe })));
  return { probe, run, has };
}

// Résumé lisible d'une sortie ffprobe. Sans ffprobe : seulement le poids (analyzed: false).
export function summarizeProbe(res, size = 0) {
  if (!res?.available) return { analyzed: false, reason: 'absent', size };
  const d = res.data;
  const v = d?.streams?.find((s) => s.codec_type === 'video');
  if (!v) return { analyzed: false, reason: 'illisible', size };
  const a = d.streams.find((s) => s.codec_type === 'audio');
  const num = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; };
  const fr = String(v.avg_frame_rate ?? '0/1').split('/');
  const duration = num(d.format?.duration) || num(v.duration);
  const bytes = num(d.format?.size) || size;
  return {
    analyzed: true, size: bytes,
    width: num(v.width), height: num(v.height), codec: String(v.codec_name ?? '').toLowerCase(),
    duration, bitrate: num(d.format?.bit_rate) || (duration ? Math.round((bytes * 8) / duration) : 0),
    fps: Math.round((Number(fr[0]) / (Number(fr[1]) || 1)) * 10) / 10 || 0,
    hasAudio: Boolean(a), audioCodec: a ? String(a.codec_name ?? '') : '',
    container: String(d.format?.format_name ?? ''),
  };
}

const fmtMo = (b) => `${(b / MO).toFixed(b >= 10 * MO ? 0 : 1).replace('.', ',')} Mo`;
const fmtMb = (b) => `${(b / 1e6).toFixed(1).replace('.', ',')} Mb/s`;

// Conseils pour UNE vidéo. role : 'pc' | 'phone'. ctx : { hasPhone, mode ('single'|'dual'), ffmpeg (bool), webmOk (bool) }.
// Retour : [{ level: 'ok'|'info'|'warn'|'bad', text }].
export function videoAdvice(info, role = 'pc', ctx = {}) {
  const out = [];
  const L = ADVICE_LIMITS;
  if (!info) return out;
  if (!info.analyzed) {
    if (info.reason === 'illisible') out.push({ level: 'bad', text: 'Ce fichier n\'est pas lu comme une vidéo : vérifie qu\'il n\'est pas abîmé.' });
    else out.push({ level: 'info', text: 'Analyse impossible (ffprobe n\'est pas installé sur le serveur) : pas de conseil automatique.' });
    return out;
  }
  if (role === 'pc') {
    const heavy = info.height >= L.pcHeavyHeight || info.width >= 2500 || info.size > L.pcHeavyBytes || info.bitrate > L.pcHeavyBitrate;
    if (heavy && !ctx.hasPhone) {
      const why = [info.height >= L.pcHeavyHeight || info.width >= 2500 ? `${info.width}×${info.height}` : '', info.size > L.pcHeavyBytes ? fmtMo(info.size) : '', info.bitrate > L.pcHeavyBitrate ? fmtMb(info.bitrate) : ''].filter(Boolean).join(', ');
      out.push({ level: 'warn', text: `Trop lourde pour le téléphone (${why}) : mets une version téléphone (ou laisse le serveur la faire).` });
    } else if (heavy) out.push({ level: 'info', text: 'Vidéo lourde : les téléphones utilisent la version téléphone, pas celle-ci.' });
    if (!ctx.hasPhone && !heavy) out.push({ level: 'info', text: 'Pas de version téléphone : les téléphones liront cette vidéo. Mets-en une plus légère si elle est lourde.' });
    if (info.duration > L.longSeconds) out.push({ level: 'warn', text: `Vidéo longue (${Math.round(info.duration)} s) : une boucle de 10 à 30 s pèse moins et reste agréable.` });
    if (info.codec && !BROWSER_VIDEO.has(info.codec) && !ctx.webmOk) {
      out.push({ level: 'bad', text: `Codec ${info.codec.toUpperCase()} non lu par la plupart des navigateurs : ré-encode en H.264 (MP4) ou VP9 (WebM).` });
    }
  } else {
    if (info.height > L.phoneHeavyHeight || info.size > L.phoneHeavyBytes || info.bitrate > L.phoneHeavyBitrate) {
      out.push({ level: 'warn', text: `Version téléphone encore lourde (${info.width}×${info.height}, ${fmtMo(info.size)}, ${fmtMb(info.bitrate)}) : vise 540 p, moins de 15 Mo.` });
    }
    if (info.duration > L.longSeconds) out.push({ level: 'warn', text: `Version téléphone longue (${Math.round(info.duration)} s) : vise 10 à 30 s.` });
    if (info.codec && info.codec !== 'h264') out.push({ level: 'bad', text: `Codec ${info.codec.toUpperCase()} : les iPhone ne lisent que le H.264 en MP4.` });
  }
  if (info.hasAudio) out.push({ level: 'info', text: 'Cette vidéo a du son : le son est coupé sur le site.' });
  if (!out.length) out.push({ level: 'ok', text: 'Rien à redire.' });
  return out;
}

// Version d'URL : ajoute ?v=<empreinte> (remplace une version déjà présente) pour contourner le cache des téléphones.
export function versionedUrl(url, v) {
  if (!url || v === undefined || v === null || v === '') return url;
  const [path, query = ''] = String(url).split('?');
  const rest = query.split('&').filter((p) => p && !p.startsWith('v='));
  rest.push(`v=${encodeURIComponent(v)}`);
  return `${path}?${rest.join('&')}`;
}

// Réglage fusionné avec les valeurs d'origine : ce que le site montre. m = réglage enregistré ou null.
export function resolveVideo(m, defaults) {
  if (!m) return { ...defaults };
  const customPc = Boolean(m.mp4 || m.webm);
  return {
    mp4: customPc ? m.mp4 ?? null : defaults.mp4,
    webm: customPc ? m.webm ?? null : defaults.webm,
    // Une vidéo PC envoyée n'hérite jamais de la version téléphone ni de l'aperçu de l'ancienne vidéo.
    phone: m.phone ?? (customPc ? null : defaults.phone),
    poster: m.poster ?? (customPc ? null : defaults.poster),
  };
}

// Version « empreinte » de l'ensemble : change dès qu'un fichier change. Les fichiers envoyés ont un nom unique ;
// les fichiers d'origine du dépôt sont datés par leur dernière modification (`stamps` : chemin -> ms).
export function videoVersion(m, urls, stamps = {}) {
  const parts = [];
  for (const k of ['mp4', 'webm', 'phone', 'poster']) {
    const p = urls[k];
    if (p) parts.push(`${k}:${p}:${stamps[p] ?? ''}`);
  }
  let h = 5381;
  const s = parts.join('|') + (m?.updated ?? '');
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Version téléphone en retard sur la vidéo PC (ou faite depuis une autre vidéo) ? -> true.
// defaultMismatch : les vidéos d'origine du dépôt n'ont pas la même durée (téléphone resté sur l'ancienne vidéo).
export function phoneIsStale(m, defaultMismatch = false) {
  if (m?.phone && m.src?.phone === 'fabriquée') return (m.phoneFrom ?? m.pcId ?? 'origine') !== (m.pcId ?? 'origine');
  if (m?.phone) return false; // envoyée à la main : choix du propriétaire
  return Boolean(defaultMismatch) && !(m && (m.mp4 || m.webm)); // origine : téléphone d'une autre vidéo que le PC
}
