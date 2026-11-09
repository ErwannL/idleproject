// v9.3.0 : écrans LIVE-OPS de l'admin (calendrier, goals du site, contenus, historique). Script classique chargé après
// le script principal de index.html : il réutilise api(), $(), toast(), fmt(), fmtDate(). Aucun secret ici : le jeton
// admin reste en mémoire / sessionStorage de l'onglet, envoyé en en-tête Authorization (pas de cookie, donc pas de
// CSRF possible). Toute validation est refaite par le serveur (server/live.mjs).
(() => {
  const DAY = 86400000;
  const KIND_LABEL = { event: 'Événement', banner: 'Vedette', offer: 'Offre', announcement: 'Annonce', flag: 'Interrupteur' };
  const STATUS = {
    draft: ['Brouillon', ''], scheduled: ['Programmé', 'info'], active: ['Actif', 'ok'], ended: ['Terminé', ''], disabled: ['Désactivé', 'warn'],
  };
  let st = null; // état renvoyé par GET /api/admin/live
  let skew = 0; // heure serveur − heure du navigateur
  let cursor = new Date(); // période affichée
  let editing = null; // élément ouvert dans l'éditeur (null = création)
  let goalsDraft = null;

  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const serverNow = () => Date.now() + skew;
  const pill = (s) => `<span class="pill ${STATUS[s][1]}">${STATUS[s][0]}</span>`;

  // Montant saisi librement : 40260, « 40 260 », « 40.26k », « 40,26k », « 1,5M » (même règle que le serveur).
  function parseAmount(v) {
    const m = /^([0-9]+(?:[.,][0-9]+)?)\s*([kKmM]?)$/.exec(String(v).replace(/[\s  ]/g, ''));
    if (!m) return NaN;
    return Math.round(Number(m[1].replace(',', '.')) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] ?? 1));
  }
  window.liveParseAmount = parseAmount;

  function catalogOf(kind) {
    const c = st.catalog;
    if (kind === 'event') return Object.fromEntries(Object.entries(c.events).map(([k, v]) => [k, { label: v.label, since: v.since, detail: v.detail }]));
    if (kind === 'banner') return c.units;
    if (kind === 'offer') return c.offers;
    if (kind === 'flag') return Object.fromEntries(Object.entries(c.flags).map(([k, v]) => [k, { label: v.label, since: c.minClient }]));
    return { message: { label: 'Message du jour', since: c.minClient } };
  }
  const itemName = (it) => it.title || catalogOf(it.kind)[it.ref]?.label || it.ref;

  async function load() {
    st = await api('/api/admin/live');
    skew = st.serverTime - Date.now();
    $('lv-clock').textContent = `Heure du serveur : ${fmtDate(st.serverTime)} — ${st.items.filter((i) => i.effective === 'active').length} élément(s) actif(s)`;
  }

  // ---- Calendrier ------------------------------------------------------------------------------------------------
  function range() {
    if ($('lv-view').value === 'weeks') {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return { from: d, days: 14, label: `Semaines du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const from = new Date(first);
    from.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const days = Math.ceil(((last - from) / DAY + 1) / 7) * 7;
    return { from, days, label: first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), month: first.getMonth() };
  }

  // Chevauchements : deux événements (ou deux vedettes) non brouillons sur les mêmes dates.
  function clashes(items) {
    const out = new Set();
    const live = items.filter((i) => (i.kind === 'event' || i.kind === 'banner') && ['scheduled', 'active', 'draft'].includes(i.effective) && i.startsAt);
    for (const a of live) for (const b of live) {
      if (a.id < b.id && a.kind === b.kind && a.startsAt < (b.endsAt ?? Infinity) && b.startsAt < (a.endsAt ?? Infinity)) { out.add(a.id); out.add(b.id); }
    }
    return out;
  }

  function renderCalendar() {
    const r = range();
    $('lv-period').textContent = r.label;
    $('lv-legend').innerHTML = Object.entries(KIND_LABEL).map(([k, v]) => `<span><i class="lv-sw k-${k}" style="background:${{ event: '#f2b43a', banner: '#b48cff', offer: '#5fdc7a', announcement: '#6aa8ff', flag: '#9aa6c4' }[k]}"></i>${v}</span>`).join('')
      + '<span><i style="background:transparent;outline:2px solid var(--bad)"></i>Chevauchement</span><span>Hachuré : brouillon (ne s\'active pas)</span>';
    const clash = clashes(st.items);
    const dow = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => `<div class="lv-dow">${d}</div>`).join('');
    const today = new Date(serverNow()).toDateString();
    let cells = '';
    for (let i = 0; i < r.days; i += 1) {
      const d = new Date(r.from);
      d.setDate(d.getDate() + i);
      const s = d.getTime();
      const e = s + DAY;
      // Sans date de fin (annonce, offre, interrupteur permanents) : seulement le jour de début, pour garder la grille lisible.
      const bars = st.items.filter((it) => it.startsAt != null && it.startsAt < e && (it.endsAt ?? it.startsAt + 1) > s)
        .map((it) => `<button class="lv-bar k-${it.kind} s-${it.effective}${clash.has(it.id) ? ' clash' : ''}" draggable="true" data-id="${it.id}" title="${esc(`${KIND_LABEL[it.kind]} · ${itemName(it)} · ${STATUS[it.effective][0]}`)}">${it.startsAt >= s ? '' : '… '}${esc(itemName(it))}</button>`).join('');
      cells += `<div class="lv-day${r.month !== undefined && d.getMonth() !== r.month ? ' out' : ''}${d.toDateString() === today ? ' today' : ''}" data-day="${s}"><div class="lv-num">${d.getDate()}</div>${bars}</div>`;
    }
    $('lv-cal').innerHTML = dow + cells;
    const up = st.items.filter((i) => ['active', 'scheduled'].includes(i.effective)).sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
    $('lv-upcoming').innerHTML = up.length ? up.map((it) => `<div class="lv-up">${pill(it.effective)} <b>${esc(KIND_LABEL[it.kind])}</b> ${esc(itemName(it))}
      <span class="muted">${fmtDate(it.startsAt)} → ${it.endsAt ? fmtDate(it.endsAt) : 'sans fin'}</span>
      <button class="btn small" data-open="${it.id}">Ouvrir</button></div>`).join('') : '<div class="muted">Rien de programmé.</div>';
  }

  $('lv-cal').addEventListener('click', (e) => {
    const bar = e.target.closest('.lv-bar');
    if (bar) return openEditor(st.items.find((i) => i.id === Number(bar.dataset.id)));
    const day = e.target.closest('.lv-day');
    if (day) openEditor(null, { kind: 'event', start: Number(day.dataset.day) + 10 * 3600000 });
    return undefined;
  });
  // Glisser une barre sur un autre jour : décale début et fin (même durée, même heure).
  let dragId = null;
  let dragFrom = 0;
  $('lv-cal').addEventListener('dragstart', (e) => {
    const bar = e.target.closest('.lv-bar');
    if (!bar) return;
    dragId = Number(bar.dataset.id);
    dragFrom = Number(bar.closest('.lv-day').dataset.day);
    e.dataTransfer.effectAllowed = 'move';
  });
  $('lv-cal').addEventListener('dragover', (e) => {
    const day = e.target.closest('.lv-day');
    if (!day || dragId == null) return;
    e.preventDefault();
    document.querySelectorAll('.lv-day.drop').forEach((d) => d.classList.remove('drop'));
    day.classList.add('drop');
  });
  $('lv-cal').addEventListener('drop', async (e) => {
    const day = e.target.closest('.lv-day');
    if (!day || dragId == null) return;
    e.preventDefault();
    const it = st.items.find((i) => i.id === dragId);
    const shift = Number(day.dataset.day) - dragFrom;
    dragId = null;
    if (!it || !shift) return renderCalendar();
    if (it.effective === 'active' || it.effective === 'ended') { toast('Un élément en cours ou terminé ne se déplace pas : modifiez ses dates dans l\'éditeur.', 'bad'); return renderCalendar(); }
    try {
      await api(`/api/admin/live/items/${it.id}`, { method: 'PUT', body: { version: it.version, startsAt: it.startsAt + shift, endsAt: it.endsAt != null ? it.endsAt + shift : null } });
      toast(`Déplacé au ${fmtDate(it.startsAt + shift)}.`);
    } catch (err) { toast(err.message, 'bad'); }
    return refreshAll();
  });
  $('lv-cal').addEventListener('dragend', () => document.querySelectorAll('.lv-day.drop').forEach((d) => d.classList.remove('drop')));
  $('lv-upcoming').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) openEditor(st.items.find((i) => i.id === Number(b.dataset.open)));
  });
  const move = (dir) => {
    if ($('lv-view').value === 'weeks') cursor = new Date(cursor.getTime() + dir * 14 * DAY);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    renderCalendar();
  };
  $('lv-prev').addEventListener('click', () => move(-1));
  $('lv-next').addEventListener('click', () => move(1));
  $('lv-view').addEventListener('change', renderCalendar);
  $('lv-new').addEventListener('click', () => openEditor(null, { kind: 'event' }));

  // ---- Éditeur ---------------------------------------------------------------------------------------------------
  const toLocal = (ms) => {
    if (ms == null) return '';
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fromLocal = (v) => (v ? new Date(v).getTime() : null);

  function fillRefs(kind, ref) {
    const cat = catalogOf(kind);
    $('lv-m-ref').innerHTML = Object.entries(cat).map(([k, v]) => `<option value="${esc(k)}"${k === ref ? ' selected' : ''}>${esc(v.label)} (depuis ${esc(v.since)})</option>`).join('');
    $('lv-m-ref-wrap').classList.toggle('hidden', kind === 'announcement');
  }

  function renderParams(kind, ref, data = {}) {
    const box = $('lv-m-params');
    $('lv-m-detail').textContent = kind === 'event' ? st.catalog.events[ref]?.detail ?? '' : '';
    if (kind === 'event') {
      const spec = st.catalog.events[ref]?.params ?? {};
      const val = data.params ?? {};
      box.innerHTML = Object.entries(spec).map(([k, p]) => {
        const v = val[k] ?? p.def;
        if (p.type === 'bool') return `<label>${esc(p.label)}<select data-param="${k}" data-type="bool"><option value="1"${v ? ' selected' : ''}>Oui</option><option value="0"${v ? '' : ' selected'}>Non</option></select></label>`;
        if (p.type === 'enum') return `<label>${esc(p.label)}<select data-param="${k}" data-type="enum">${p.values.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
        return `<label>${esc(p.label)} <small>(${p.min} à ${p.max})</small><input data-param="${k}" data-type="${p.type}" type="number" step="${p.type === 'int' ? 1 : 0.1}" min="${p.min}" max="${p.max}" value="${v}"></label>`;
      }).join('');
    } else if (kind === 'announcement') {
      box.innerHTML = `<label style="grid-column:1/-1">Texte affiché dans le jeu (500 caractères au plus)<textarea id="lv-m-text" maxlength="500">${esc(data.text ?? '')}</textarea></label>`;
    } else if (kind === 'flag') {
      box.innerHTML = `<label>Valeur<select id="lv-m-flag"><option value="1"${data.value !== false ? ' selected' : ''}>Activé</option><option value="0"${data.value === false ? ' selected' : ''}>Coupé</option></select></label>`;
    } else box.innerHTML = '';
    renderPreview();
  }

  function formBody() {
    const kind = $('lv-m-kind').value;
    const body = {
      title: $('lv-m-title-in').value.trim(), startsAt: fromLocal($('lv-m-start').value), endsAt: fromLocal($('lv-m-end').value),
    };
    if ($('lv-m-min').value.trim()) body.minClient = $('lv-m-min').value.trim();
    if (!editing) { body.kind = kind; if (kind !== 'announcement') body.ref = $('lv-m-ref').value; }
    else if (kind !== 'announcement') body.ref = $('lv-m-ref').value;
    if (kind === 'event') {
      const params = {};
      document.querySelectorAll('#lv-m-params [data-param]').forEach((el) => {
        const t = el.dataset.type;
        params[el.dataset.param] = t === 'bool' ? el.value === '1' : t === 'enum' ? el.value : Number(el.value);
      });
      body.data = { params };
    } else if (kind === 'announcement') body.data = { text: $('lv-m-text')?.value ?? '' };
    else if (kind === 'flag') body.data = { value: $('lv-m-flag').value === '1' };
    else body.data = {};
    if (editing) body.version = editing.version;
    return body;
  }

  // Aperçu : ce que verra le joueur et quand.
  function renderPreview() {
    const kind = $('lv-m-kind').value;
    const ref = $('lv-m-ref').value;
    const name = kind === 'announcement' ? ($('lv-m-title-in').value || 'Annonce') : catalogOf(kind)[ref]?.label ?? ref;
    const s = fromLocal($('lv-m-start').value);
    const e = fromLocal($('lv-m-end').value);
    const when = s ? `du ${fmtDate(s)} au ${e ? fmtDate(e) : '(sans fin)'}` : 'dates non choisies';
    const what = {
      event: `l'onglet Aventure › Événement affiche « ${esc(name)} »`, banner: `la bannière limitée met « ${esc(name)} » en vedette`,
      offer: `la boutique (Packs) propose « ${esc(name)} »`, announcement: `l'onglet Événement affiche l'annonce « ${esc(name)} »`,
      flag: `l'interrupteur « ${esc(name)} » est ${$('lv-m-flag')?.value === '0' ? 'coupé' : 'activé'}`,
    }[kind];
    $('lv-m-preview').innerHTML = `<b>Aperçu joueur :</b> ${what}, ${esc(when)} (heure du serveur), pour les jeux en version ${esc($('lv-m-min').value || 'minimale du catalogue')} ou plus récente.`
      + (editing ? `<div class="muted" style="margin-top:6px">État : ${pill(editing.effective)} · version ${editing.version} · modifié par ${esc(editing.updatedBy)} le ${fmtDate(editing.updatedAt)}</div>` : '');
  }

  function openEditor(item, preset = {}) {
    editing = item ?? null;
    const kind = item?.kind ?? preset.kind ?? 'event';
    $('lv-m-title').textContent = item ? `${KIND_LABEL[kind]} : ${itemName(item)}` : 'Nouvel élément live';
    $('lv-m-sub').textContent = item ? `n° ${item.id}` : 'Choisissez un contenu livré par une mise à jour, ses dates et ses réglages.';
    $('lv-m-kind').value = kind;
    $('lv-m-kind').disabled = Boolean(item);
    fillRefs(kind, item?.ref);
    $('lv-m-title-in').value = item?.title ?? '';
    const start = item?.startsAt ?? preset.start ?? null;
    const days = kind === 'event' ? st.catalog.events[$('lv-m-ref').value]?.days ?? 14 : 14;
    $('lv-m-start').value = toLocal(start);
    $('lv-m-end').value = toLocal(item ? item.endsAt : start != null && kind !== 'offer' && kind !== 'announcement' ? start + days * DAY : null);
    $('lv-m-min').value = item?.minClient ?? '';
    $('lv-m-error').textContent = '';
    renderParams(kind, $('lv-m-ref').value, item?.data ?? {});
    const eff = item?.effective;
    $('lv-m-start-now').classList.toggle('hidden', eff === 'active');
    $('lv-m-stop-now').classList.toggle('hidden', !(eff === 'active' || eff === 'scheduled'));
    $('lv-m-stop-now').textContent = eff === 'scheduled' ? '■ Déprogrammer' : '■ Arrêter maintenant';
    $('lv-m-delete').classList.toggle('hidden', !item || eff === 'active');
    $('lv-m-save').textContent = eff === 'active' ? 'Enregistrer' : 'Enregistrer et programmer';
    $('lv-modal').classList.remove('hidden');
  }
  window.liveOpenEditor = openEditor;
  const closeEditor = () => { $('lv-modal').classList.add('hidden'); editing = null; };
  $('lv-m-close').addEventListener('click', closeEditor);
  $('lv-modal').addEventListener('click', (e) => { if (e.target.id === 'lv-modal') closeEditor(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('lv-modal').classList.contains('hidden')) closeEditor(); });
  $('lv-m-kind').addEventListener('change', () => { fillRefs($('lv-m-kind').value); renderParams($('lv-m-kind').value, $('lv-m-ref').value); });
  $('lv-m-ref').addEventListener('change', () => renderParams($('lv-m-kind').value, $('lv-m-ref').value, editing?.ref === $('lv-m-ref').value ? editing.data : {}));
  for (const id of ['lv-m-start', 'lv-m-end', 'lv-m-min', 'lv-m-title-in']) $(id).addEventListener('input', renderPreview);
  $('lv-m-params').addEventListener('change', renderPreview);

  async function run(fn, okText) {
    $('lv-m-error').textContent = '';
    try {
      await fn();
      toast(okText);
      closeEditor();
      await refreshAll();
    } catch (err) {
      $('lv-m-error').textContent = err.message;
    }
  }
  async function save(schedule) {
    const body = formBody();
    if (!editing) {
      body.status = schedule ? 'scheduled' : 'draft';
      return api('/api/admin/live/items', { method: 'POST', body });
    }
    const saved = await api(`/api/admin/live/items/${editing.id}`, { method: 'PUT', body });
    if (schedule && ['draft', 'disabled'].includes(saved.effective)) return api(`/api/admin/live/items/${saved.id}/schedule`, { method: 'POST', body: { version: saved.version } });
    if (!schedule && saved.effective === 'scheduled') return api(`/api/admin/live/items/${saved.id}/draft`, { method: 'POST', body: { version: saved.version } });
    return saved;
  }
  $('lv-m-save').addEventListener('click', () => run(() => save(true), 'Enregistré : démarrage et arrêt automatiques aux dates prévues.'));
  $('lv-m-draft').addEventListener('click', () => run(() => save(false), 'Brouillon enregistré (ne s\'active pas).'));
  $('lv-m-start-now').addEventListener('click', () => run(async () => {
    let it = editing;
    if (!it) it = await api('/api/admin/live/items', { method: 'POST', body: { ...formBody(), status: 'draft' } });
    else it = await api(`/api/admin/live/items/${it.id}`, { method: 'PUT', body: formBody() });
    await api(`/api/admin/live/items/${it.id}/activate`, { method: 'POST', body: { version: it.version } });
  }, 'Activé : les joueurs le voient au prochain rafraîchissement (5 min au plus).'));
  $('lv-m-stop-now').addEventListener('click', () => {
    if (!editing) return;
    if (!confirm(`Arrêter « ${itemName(editing)} » tout de suite pour tous les joueurs ?`)) return;
    run(() => api(`/api/admin/live/items/${editing.id}/stop`, { method: 'POST', body: { version: editing.version } }), 'Arrêté.');
  });
  $('lv-m-delete').addEventListener('click', () => {
    if (!editing || !confirm(`Supprimer « ${itemName(editing)} » ?`)) return;
    run(() => api(`/api/admin/live/items/${editing.id}`, { method: 'DELETE' }), 'Supprimé.');
  });

  // ---- Contenus ---------------------------------------------------------------------------------------------------
  async function renderContent() {
    const k = $('lc-kind').value;
    const rows = st.items.filter((i) => !k || i.kind === k);
    $('lc-body').innerHTML = rows.length ? rows.map((it) => `<tr class="click" data-open="${it.id}"><td>${KIND_LABEL[it.kind]}</td><td>${esc(itemName(it))}</td><td>${pill(it.effective)}</td>
      <td>${fmtDate(it.startsAt)}</td><td>${it.endsAt ? fmtDate(it.endsAt) : '—'}</td><td>${esc(it.minClient)}</td><td><button class="btn small">Ouvrir</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="muted">Aucun élément.</td></tr>';
    const preview = await api('/api/admin/live/preview');
    $('lc-preview').textContent = JSON.stringify(preview, null, 2);
  }
  $('lc-body').addEventListener('click', (e) => {
    const tr = e.target.closest('[data-open]');
    if (tr) openEditor(st.items.find((i) => i.id === Number(tr.dataset.open)));
  });
  $('lc-kind').addEventListener('change', renderContent);
  $('lc-new').addEventListener('click', () => openEditor(null, { kind: $('lc-kind').value || 'banner' }));

  // ---- Goals ------------------------------------------------------------------------------------------------------
  function renderGoals() {
    const g = st.goals;
    goalsDraft = structuredClone(g.data);
    $('lg-info').textContent = `Version ${g.version} · modifié par ${g.updatedBy} le ${fmtDate(g.updatedAt)}. Le site lit ces goals sur /api/live/goals.`;
    $('lg-kpis').innerHTML = [['Préinscrits réels', g.realCount], ['Compteur affiché', g.displayedCount], ['Objectif', g.data.target], ['Paliers', g.data.tiers.length]]
      .map(([l, v]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${fmt(v)}</div></div>`).join('');
    $('lg-target').value = fmt(g.data.target);
    $('lg-mode').value = g.data.display.mode;
    $('lg-value').value = String(g.data.display.value);
    $('lg-headline').value = g.data.texts.headline ?? '';
    $('lg-reached').value = g.data.texts.reached ?? '';
    renderTiers();
  }
  // Images déjà envoyées depuis l'admin (liste pour le champ « Image »).
  async function loadAssets() {
    let list = document.getElementById('lg-assets');
    if (!list) { list = document.createElement('datalist'); list.id = 'lg-assets'; document.body.append(list); }
    try {
      const data = await api('/api/admin/assets');
      list.innerHTML = data.files.map((f) => `<option value="${esc(f.path)}"></option>`).join('');
    } catch { list.innerHTML = ''; }
  }
  // Envoi d'une image choisie dans le sélecteur de fichiers du navigateur (le serveur vérifie le vrai format).
  document.addEventListener('change', async (e) => {
    const input = e.target;
    if (!input.matches || !input.matches('input[data-pick]')) return;
    const file = input.files[0];
    if (!file) return;
    const row = input.closest('tr');
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error('Image trop lourde : 3 Mo au plus.');
      const res = await fetch('/api/admin/assets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) },
        body: file,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Envoi refusé');
      row.querySelector('[data-f="img"]').value = json.path;
      row.querySelector('[data-thumb]').src = '/' + json.path;
      toast('Image envoyée : ' + json.path);
      loadAssets();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      input.value = '';
    }
  });

  function renderTiers() {
    $('lg-value-wrap').classList.toggle('hidden', $('lg-mode').value === 'real');
    $('lg-tiers').innerHTML = goalsDraft.tiers.map((t, i) => `<tr data-i="${i}">
      <td><input data-f="at" value="${esc(fmt(t.at))}" inputmode="decimal" aria-label="Seuil"></td><td><input data-f="label" value="${esc(t.label)}" maxlength="12" aria-label="Libellé"></td>
      <td><input data-f="name" value="${esc(t.name)}" maxlength="60" aria-label="Récompense"></td><td><input data-f="detail" value="${esc(t.detail)}" maxlength="120" aria-label="Détail"></td>
      <td><input data-f="tag" value="${esc(t.tag ?? '')}" maxlength="30" aria-label="Étiquette"></td><td><input data-f="excl" type="checkbox"${t.excl ? ' checked' : ''} aria-label="Exclusif"></td>
      <td class="lv-img"><div class="lv-img-row"><input data-f="img" value="${esc(t.img)}" maxlength="120" list="lg-assets" aria-label="Image"><label class="btn small lv-pick">Choisir un fichier<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-pick hidden></label></div><img class="lv-thumb" data-thumb src="${esc(t.img ? "/" + t.img : "")}" alt="" width="40" height="40"></td><td><button class="btn small danger" data-del="${i}" aria-label="Supprimer le palier">✕</button></td></tr>`).join('');
    renderGoalPreview();
    loadAssets();
  }
  function readGoals() {
    document.querySelectorAll('#lg-tiers tr').forEach((tr) => {
      const t = goalsDraft.tiers[Number(tr.dataset.i)];
      tr.querySelectorAll('[data-f]').forEach((el) => {
        const f = el.dataset.f;
        if (f === 'excl') t.excl = el.checked;
        else if (f === 'at') t.at = parseAmount(el.value);
        else t[f] = el.value;
      });
      if (!t.tag) delete t.tag;
    });
    const mode = $('lg-mode').value;
    return {
      target: parseAmount($('lg-target').value), display: { mode, value: mode === 'real' ? 0 : mode === 'offset' ? Number($('lg-value').value.replace(/\s/g, '')) : parseAmount($('lg-value').value) },
      texts: { headline: $('lg-headline').value, reached: $('lg-reached').value }, tiers: goalsDraft.tiers,
    };
  }
  function renderGoalPreview() {
    const d = readGoals();
    const real = st.goals.realCount;
    const shown = d.display.mode === 'manual' ? d.display.value : d.display.mode === 'offset' ? Math.max(0, real + (d.display.value || 0)) : real;
    const ok = Number.isFinite(d.target) && d.target > 0;
    const pct = ok ? Math.min(100, (shown / d.target) * 100) : 0;
    const next = d.tiers.find((t) => shown < t.at);
    $('lg-preview').innerHTML = ok ? `<div><b>${fmt(shown)}</b> / ${fmt(d.target)} aventuriers (${pct.toFixed(1)} %)</div><div class="lg-bar"><span style="width:${pct}%"></span></div>
      <div class="muted">${next ? `Encore ${fmt(next.at - shown)} pour le palier ${esc(next.label)}.` : esc(d.texts.reached || 'Objectif atteint.')}</div>
      ${d.tiers.some((t) => t.at > d.target) ? '<div class="error">Un palier dépasse l\'objectif : il ne sera jamais atteint par la barre.</div>' : ''}`
      : '<div class="error">Objectif illisible : tapez par exemple 40260, 40 260 ou 40,26k.</div>';
  }
  $('lg-tiers').addEventListener('input', renderGoalPreview);
  $('lg-tiers').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    readGoals();
    goalsDraft.tiers.splice(Number(b.dataset.del), 1);
    renderTiers();
  });
  for (const id of ['lg-target', 'lg-value', 'lg-headline', 'lg-reached']) $(id).addEventListener('input', renderGoalPreview);
  $('lg-mode').addEventListener('change', renderTiers);
  $('lg-add').addEventListener('click', () => {
    readGoals();
    const last = goalsDraft.tiers.at(-1)?.at ?? 0;
    goalsDraft.tiers.push({ at: last + 10000, label: '', name: '', detail: '', img: 'assets/icon_gem.png' });
    renderTiers();
  });
  $('lg-sort').addEventListener('click', () => { readGoals(); goalsDraft.tiers.sort((a, b) => a.at - b.at); renderTiers(); });
  $('lg-save').addEventListener('click', async () => {
    try {
      await api('/api/admin/live/goals', { method: 'PUT', body: { version: st.goals.version, data: readGoals() } });
      toast('Goals enregistrés : le site les affiche au prochain chargement.');
      await refreshAll();
    } catch (err) { toast(err.message, 'bad'); }
  });

  // ---- Historique -------------------------------------------------------------------------------------------------
  function renderHistory() {
    $('lh-body').innerHTML = st.history.length ? st.history.map((h) => `<tr><td>${fmtDate(h.at)}</td><td>${esc(h.admin)}</td><td>${esc(h.action)}</td><td>${esc(h.summary)}</td></tr>`).join('')
      : '<tr><td colspan="4" class="muted">Aucune modification.</td></tr>';
  }
  $('lh-refresh').addEventListener('click', () => refreshAll());

  // ---- Navigation -------------------------------------------------------------------------------------------------
  let tab = '';
  async function refreshAll() {
    try {
      await load();
      if (tab === 'live-cal') renderCalendar();
      if (tab === 'live-goals') renderGoals();
      if (tab === 'live-content') await renderContent();
      if (tab === 'live-history') renderHistory();
    } catch (err) { toast(err.message, 'bad'); }
  }
  window.liveRefresh = refreshAll;
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    tab = btn.dataset.tab;
    if (tab.startsWith('live-')) refreshAll();
  }));
})();
