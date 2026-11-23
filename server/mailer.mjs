// Emails de la préinscription : confirmation de l'adresse et lien de parrainage, envoyés par l'API transactionnelle
// de Brevo (POST https://api.brevo.com/v3/smtp/email, en-tête api-key). Aucune dépendance : fetch.
// Configuration (variables d'environnement du serveur, jamais dans le dépôt) : BREVO_API_KEY, MAIL_FROM, PUBLIC_BASE_URL.
// Sans BREVO_API_KEY (tests, développement) : rien n'est envoyé, on journalise seulement.

export const MAIL_LIMITS = { perDay: 250, perHour: 60, perAddressMs: 3600_000 }; // offre gratuite Brevo : 300 par jour
export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// « Ascendrya <contact@ascendrya.com> » → { name, email }.
export function parseFrom(from = '') {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { name: m[1].replace(/^"|"$/g, '') || 'Ascendrya', email: m[2].trim() };
  return { name: 'Ascendrya', email: from.trim() || 'contact@ascendrya.com' };
}

// Masque une adresse pour les journaux (jamais l'adresse en clair).
const mask = (email) => { const [u, d = ''] = String(email).split('@'); return `${u.slice(0, 2)}***@${d.slice(0, 1)}***`; };

// Service d'envoi. transport(message) → Promise<void> ; par défaut, Brevo (ou rien si pas de clé).
export function createMailer({ apiKey = '', from = '', baseUrl = 'https://ascendrya.com', transport = null, now = () => Date.now(), log = () => {}, limits = MAIL_LIMITS } = {}) {
  const sender = parseFrom(from);
  const send = transport ?? (apiKey
    ? async (msg) => {
      const res = await fetch(BREVO_URL, { method: 'POST', headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(msg) });
      if (!res.ok) throw new Error(`Brevo HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
    : async (msg) => { log(`email non envoyé (pas de BREVO_API_KEY) : « ${msg.subject} » → ${mask(msg.to[0].email)}`); });
  // Limites globales (en mémoire) : par jour et par heure.
  const win = { day: '', dayN: 0, hour: -1, hourN: 0 };
  function allow() {
    const t = now(); const day = new Date(t).toISOString().slice(0, 10); const hour = Math.floor(t / 3600_000);
    if (win.day !== day) { win.day = day; win.dayN = 0; }
    if (win.hour !== hour) { win.hour = hour; win.hourN = 0; }
    if (win.dayN >= limits.perDay || win.hourN >= limits.perHour) return false;
    win.dayN += 1; win.hourN += 1;
    return true;
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    enabled: Boolean(apiKey || transport),
    stats: () => ({ ...win }),
    // Renvoie true si l'email est parti (ou simulé), false s'il a été retenu (limite) ou a échoué. Ne lève jamais.
    async send({ to, subject, html, text }) {
      if (!allow()) { log(`email retenu (limite d'envoi atteinte) → ${mask(to)}`); return false; }
      try {
        await send({ sender, to: [{ email: to }], subject, htmlContent: html, textContent: text });
        return true;
      } catch (e) {
        log(`échec de l'envoi d'un email → ${mask(to)} : ${String(e.message ?? e).slice(0, 200)}`);
        return false;
      }
    },
  };
}

// ---- Contenu des emails (français et anglais) ----
const T = {
  fr: {
    subject: 'Confirme ta préinscription à Ascendrya',
    hello: 'Merci ! Clique sur le bouton pour confirmer ton adresse.',
    confirm: 'Confirmer mon adresse',
    invite: 'Invite tes amis : chaque ami inscrit te rapporte une récompense au lancement.',
    link: 'Ton lien de parrainage',
    count: (n) => `Tu as amené ${n} aventurier${n > 1 ? 's' : ''} pour le moment.`,
    rewards: [['1 ami', '50 gemmes'], ['3 amis', '1 ticket d’invocation'], ['5 amis', 'Cadre « Pionnier »'], ['10 amis', '5 tickets + titre « Recruteur »'], ['25 amis', 'Apparence de familier exclusive']],
    notYou: 'Tu n’es pas à l’origine de cette inscription ? Ignore cet email.',
    unsub: 'Se désinscrire',
    friendSubject: 'Un ami vient de te rejoindre sur Ascendrya !',
    friend: (n) => `Un ami a confirmé sa préinscription grâce à ton lien. Tu en as amené ${n}.`,
  },
  en: {
    subject: 'Confirm your Ascendrya pre-registration',
    hello: 'Thank you! Click the button to confirm your address.',
    confirm: 'Confirm my address',
    invite: 'Invite your friends: each friend who signs up earns you a reward at launch.',
    link: 'Your referral link',
    count: (n) => `You have brought ${n} adventurer${n === 1 ? '' : 's'} so far.`,
    rewards: [['1 friend', '50 gems'], ['3 friends', '1 summon ticket'], ['5 friends', '"Pioneer" frame'], ['10 friends', '5 tickets + "Recruiter" title'], ['25 friends', 'Exclusive pet skin']],
    notYou: 'Didn’t sign up? Just ignore this email.',
    unsub: 'Unsubscribe',
    friendSubject: 'A friend just joined you on Ascendrya!',
    friend: (n) => `A friend confirmed their pre-registration with your link. You have brought ${n}.`,
  },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function confirmationEmail({ lang = 'fr', baseUrl, token, ref, count = 0 }) {
  const t = T[lang] ?? T.fr;
  const confirmUrl = `${baseUrl}/?confirm=${encodeURIComponent(token)}&lang=${lang}`;
  const refUrl = `${baseUrl}/?ref=${encodeURIComponent(ref)}`;
  const unsubUrl = `${baseUrl}/?unsubscribe=${encodeURIComponent(token)}&lang=${lang}`;
  const rows = t.rewards.map(([a, b]) => `<tr><td style="padding:4px 10px;font-weight:700;color:#ffe08a">${esc(a)}</td><td style="padding:4px 10px;color:#e8ecf5">${esc(b)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif;color:#e8ecf5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#16203a;border:2px solid #f2b43a;border-radius:16px">
<tr><td align="center" style="padding:24px 20px 8px"><img src="${baseUrl}/assets/icon.png" alt="" width="64" height="64" style="display:block;margin:0 auto 6px;image-rendering:pixelated"><div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#f2b43a">ASCENDRYA</div></td></tr>
<tr><td align="center" style="padding:8px 24px;font-size:17px">${esc(t.hello)}</td></tr>
<tr><td align="center" style="padding:16px 24px"><a href="${esc(confirmUrl)}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#f2b43a;color:#2a1a06;font-weight:900;font-size:17px;text-decoration:none">${esc(t.confirm)}</a></td></tr>
<tr><td style="padding:8px 24px;font-size:15px">${esc(t.invite)}</td></tr>
<tr><td style="padding:4px 24px;font-size:14px">${esc(t.link)} : <a href="${esc(refUrl)}" style="color:#7fd4ff">${esc(refUrl)}</a></td></tr>
<tr><td style="padding:8px 14px"><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table></td></tr>
<tr><td style="padding:4px 24px 16px;font-size:14px;color:#c4d0ea">${esc(t.count(count))}</td></tr>
<tr><td style="padding:12px 24px 20px;font-size:12px;color:#8e9db8;border-top:1px solid #2a3654">${esc(t.notYou)} · <a href="${esc(unsubUrl)}" style="color:#8e9db8">${esc(t.unsub)}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [t.hello, '', `${t.confirm} : ${confirmUrl}`, '', t.invite, `${t.link} : ${refUrl}`, ...t.rewards.map(([a, b]) => `- ${a} : ${b}`), t.count(count), '', t.notYou, `${t.unsub} : ${unsubUrl}`].join('\n');
  return { subject: t.subject, html, text };
}

export function friendJoinedEmail({ lang = 'fr', baseUrl, ref, count }) {
  const t = T[lang] ?? T.fr;
  const refUrl = `${baseUrl}/?ref=${encodeURIComponent(ref)}`;
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#0b1120;font-family:Arial,Helvetica,sans-serif;color:#e8ecf5;padding:24px">
<p style="font-size:17px">${esc(t.friend(count))}</p><p style="font-size:14px">${esc(t.link)} : <a href="${esc(refUrl)}" style="color:#7fd4ff">${esc(refUrl)}</a></p></body></html>`;
  return { subject: t.friendSubject, html, text: `${t.friend(count)}\n${t.link} : ${refUrl}` };
}
