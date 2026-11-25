// v9.8 (H8) : envoi des notifications locales (Android, plugin Capacitor LocalNotifications) quand le jeu passe en
// arrière-plan ; tout est annulé au retour au premier plan. Rien sur PC ni dans le navigateur.
import { planNotifications } from '../core/notify-plan.js';
import { t } from '../i18n/i18n.js'; // v10.14.1 : les notifications suivent la langue du jeu (anglais, coréen)

const plugin = () => (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.LocalNotifications : null);

export function setupNotifications(getState, isTitanOpen) {
  const ln = plugin();
  if (!ln || typeof document === 'undefined') return;
  let asked = false;
  const cancel = () => ln.cancel({ notifications: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })) }).catch(() => {});
  const schedule = async () => {
    const state = getState();
    if (!state || state.ui?.notify?.phone === false) return;
    try {
      if (!asked) { asked = true; const p = await ln.checkPermissions(); if (p.display !== 'granted') await ln.requestPermissions(); }
      const list = planNotifications(state, Date.now(), { titanOpen: isTitanOpen() });
      await cancel();
      if (list.length) await ln.schedule({ notifications: list.map((n) => ({ id: n.id, title: t(n.title), body: t(n.body), schedule: { at: new Date(n.at), allowWhileIdle: true } })) });
    } catch { /* permission refusée ou plugin absent : rien */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) schedule(); else cancel(); });
}
