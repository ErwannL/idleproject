// Onglet « Site » de l'admin : audience du site ascendrya.com, sources, entonnoir, campagnes.
// Script classique chargé après le script principal : il réutilise api(), $(), toast(), fmt(), fmtDate().
// Tout le texte venant des visiteurs (pages, boutons, erreurs…) passe par textContent : jamais d'innerHTML sur des données.
// Graphiques en SVG maison (aucune bibliothèque, aucun service externe). Données : GET /api/admin/site-stats.
(() => {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const nf = (n, digits = 0) => (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const int = (n) => nf(n);
  const pc = (x, digits = 1) => `${nf((x || 0) * 100, digits)} %`;
  const dur = (s) => {
    s = Math.round(s || 0);
    if (s < 60) return `${s} s`;
    if (s < 3600) return `${Math.floor(s / 60)} min ${pad(s % 60)} s`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))}`;
    return `${Math.floor(s / 86400)} j ${Math.floor((s % 86400) / 3600)} h`;
  };
  const ms = (v, metric) => {
    if (metric === 'cls') return nf(v / 1000, 3);
    return v >= 1000 ? `${nf(v / 1000, 2)} s` : `${nf(v)} ms`;
  };
  const PALETTE = ['#f2b43a', '#6aa8ff', '#5fdc7a', '#ff7a8a', '#b78cff', '#4fd1c5', '#ff9f5a', '#8e9cc2'];
  const CH_COLORS = { x: '#e9efff', youtube_shorts: '#ff5a5f', youtube: '#ff9aa2', tiktok: '#4fd1c5', reddit: '#ff9f5a', discord: '#b78cff', steam: '#6aa8ff', play_store: '#5fdc7a', search: '#f2b43a', facebook: '#7f9cf5', instagram: '#f687b3', twitch: '#9f7aea', email: '#8e9cc2', direct: '#6b7ba6', referral: '#a0aec0', other: '#718096', unknown: '#4a5568' };
  const FOCUS = ['x', 'youtube_shorts', 'tiktok', 'steam', 'play_store', 'discord', 'reddit', 'youtube'];
  const SECTION_ORDER = ['top', 'rewards', 'invite', 'discover', 'join'];
  const SECTION_NAMES = { top: 'Accueil (vidéo)', rewards: 'Objectif et récompenses', invite: 'Parrainage', discover: 'Découverte du jeu', join: 'Préinscription' };
  const CLICK_NAMES = {
    cta_nav: 'CTA préinscription (menu)', cta_hero: 'CTA préinscription (accueil)', cta_sticky: 'CTA préinscription (barre fixe)', prereg_submit: 'Envoi du formulaire',
    social_x: 'Pied de page : X', social_tiktok: 'Pied de page : TikTok', social_youtube: 'Pied de page : YouTube', social_discord: 'Pied de page : Discord',
    thanks_social_x: 'Après inscription : X', thanks_social_tiktok: 'Après inscription : TikTok', thanks_social_youtube: 'Après inscription : YouTube', thanks_social_discord: 'Après inscription : Discord',
    ref_share_x: 'Partage du lien de parrainage : X', ref_share_whatsapp: 'Partage du lien de parrainage : WhatsApp', btn_reel_toggle: 'Pause / lecture de la vidéo',
  };
  const clickName = (id) => CLICK_NAMES[id] ?? (id.startsWith('lang_') ? `Langue : ${id.slice(5).toUpperCase()}` : id.startsWith('out_') ? `Sortie : ${id.slice(4)}` : id.startsWith('link_') ? `Lien : ${id.slice(5)}` : id.startsWith('faq_') ? `FAQ : ${id.slice(4)}` : id);
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const DEVICE_NAMES = { mobile: 'Mobile', tablet: 'Tablette', desktop: 'Ordinateur' };
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, props = {}, ...kids) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(props)) if (v !== null && v !== undefined) n.setAttribute(k, v);
    for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };

  const st = { period: '30d', from: '', to: '', channel: '', campaign: '', device: '', lang: '', gran: 'auto', d: null, seq: 0, csv: 'channels' };
  let CH = {}; // libellés des canaux (fournis par le serveur)
  const chName = (k) => CH[k] ?? (k === 'unknown' ? 'Non attribué' : k);
  const chColor = (k) => CH_COLORS[k] ?? '#8e9cc2';

  // ---------- Période ----------
  function range() {
    const today = new Date();
    switch (st.period) {
      case 'today': return { from: ymd(today), to: ymd(today) };
      case '7d': return { from: ymd(addDays(today, -6)), to: ymd(today) };
      case '30d': return { from: ymd(addDays(today, -29)), to: ymd(today) };
      case '90d': return { from: ymd(addDays(today, -89)), to: ymd(today) };
      case 'all': return { from: 'all', to: ymd(today) };
      default: return { from: st.from || ymd(addDays(today, -29)), to: st.to || ymd(today) };
    }
  }
  function query(extra = {}) {
    const r = range();
    const p = new URLSearchParams({ from: r.from, to: r.to, tz: String(new Date().getTimezoneOffset()), granularity: st.gran });
    for (const k of ['channel', 'campaign', 'device', 'lang']) if (st[k]) p.set(k, st[k]);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p;
  }

  // ---------- Briques graphiques ----------
  function delta(cur, prev, { rate = false, invert = false } = {}) {
    if (prev === null || prev === undefined) return { text: '', cls: '' };
    if (rate) {
      const d = (cur - prev) * 100;
      if (Math.abs(d) < 0.05) return { text: '= période précédente', cls: '' };
      const good = invert ? d < 0 : d > 0;
      return { text: `${d > 0 ? '+' : '−'}${nf(Math.abs(d), 1)} pt vs précédente`, cls: good ? 'up' : 'down' };
    }
    if (!prev) return cur ? { text: 'nouveau', cls: 'up' } : { text: '= période précédente', cls: '' };
    const d = ((cur - prev) / prev) * 100;
    if (Math.abs(d) < 0.05) return { text: '= période précédente', cls: '' };
    const good = invert ? d < 0 : d > 0;
    return { text: `${d > 0 ? '+' : '−'}${nf(Math.abs(d), Math.abs(d) < 10 ? 1 : 0)} % vs précédente`, cls: good ? 'up' : 'down' };
  }
  function kpi(label, value, d, color, hint) {
    return el('div', { class: 'ss-kpi', style: `--k:${color}`, title: hint || null }, el('div', { class: 'l', text: label }), el('div', { class: 'v', text: value }), d?.text ? el('div', { class: `d ${d.cls}`, text: d.text }) : null);
  }
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const e = 10 ** Math.floor(Math.log10(v));
    const m = v / e;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e;
  };
  const bucketLabel = (b, gran, short = true) => {
    if (gran === 'hour') return short ? `${b.slice(11)} h` : `${b.slice(8, 10)}/${b.slice(5, 7)} ${b.slice(11)} h`;
    if (gran === 'month') return `${b.slice(5, 7)}/${b.slice(0, 4)}`;
    const d = `${b.slice(8, 10)}/${b.slice(5, 7)}`;
    return gran === 'week' ? (short ? d : `sem. du ${d}/${b.slice(0, 4)}`) : (short ? d : `${d}/${b.slice(0, 4)}`);
  };

  // Courbes ou barres temporelles. series: [{name, color, values, fmt}]
  function timeChart(labels, series, { kind = 'line', height = 210, gran = 'day', fmtY = (v) => nf(v), label = null } = {}) {
    const lab = (b, short) => (label ? label(b) : bucketLabel(b, gran, short));
    const W = innerWidth < 760 ? 360 : 640; const H = height; const pl = 46; const pr = 12; const pt = 12; const pb = 26;
    const n = labels.length;
    const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
    const x = (i) => (kind === 'bar' ? pl + ((i + 0.5) * (W - pl - pr)) / Math.max(1, n) : pl + (n <= 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1)));
    const y = (v) => pt + (1 - v / max) * (H - pt - pb);
    const root = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': series.map((s) => s.name).join(', ') });
    for (let i = 0; i <= 4; i += 1) {
      const v = (max * i) / 4;
      root.append(sv('line', { class: 'gl', x1: pl, x2: W - pr, y1: y(v), y2: y(v) }), sv('text', { x: pl - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmtY(v)));
    }
    const step = Math.max(1, Math.ceil(n / 8));
    labels.forEach((b, i) => { if (i % step === 0) root.append(sv('text', { x: x(i), y: H - 7, 'text-anchor': 'middle' }, lab(b, true))); });
    series.forEach((s, si) => {
      if (kind === 'bar') {
        const bw = Math.max(1.5, ((W - pl - pr) / Math.max(1, n)) * 0.7 / series.length);
        s.values.forEach((v, i) => { if (v > 0) root.append(sv('rect', { x: x(i) - (bw * series.length) / 2 + si * bw, y: y(v), width: bw, height: Math.max(1, H - pb - y(v)), rx: 2, fill: s.color })); });
      } else {
        const pts = s.values.map((v, i) => [x(i), y(v)]);
        if (si === 0 && pts.length > 1) root.append(sv('path', { d: `M${pts[0][0]},${H - pb} ${pts.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${pts[pts.length - 1][0]},${H - pb} Z`, fill: s.color, opacity: 0.13 }));
        root.append(sv('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        if (n <= 45) for (const p of pts) root.append(sv('circle', { cx: p[0], cy: p[1], r: 2.6, fill: s.color }));
      }
    });
    const rule = sv('line', { y1: pt, y2: H - pb, stroke: '#8e9cc2', 'stroke-dasharray': '3 3', opacity: 0, x1: 0, x2: 0 });
    root.append(rule);
    const box = el('div', { class: 'ss-chart' }, root);
    const tip = el('div', { class: 'ss-tip' });
    tip.style.display = 'none';
    box.append(tip);
    const move = (ev) => {
      const r = root.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      let i = kind === 'bar' ? Math.floor(((px - pl) / (W - pl - pr)) * n) : Math.round(((px - pl) / (W - pl - pr)) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      rule.setAttribute('x1', x(i)); rule.setAttribute('x2', x(i)); rule.setAttribute('opacity', kind === 'bar' ? 0 : 1);
      tip.replaceChildren(el('b', { text: lab(labels[i], false) }), ...series.map((s) => el('div', {}, el('i', { style: `background:${s.color}` }), `${s.name} : ${(s.fmt || fmtY)(s.values[i])}`)));
      tip.style.display = 'block';
      tip.style.left = `${Math.max(70, Math.min(r.width - 70, (x(i) / W) * r.width))}px`;
      tip.style.top = `${(Math.min(...series.map((s) => y(s.values[i]))) / H) * r.height}px`;
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerdown', move);
    root.addEventListener('pointerleave', () => { tip.style.display = 'none'; rule.setAttribute('opacity', 0); });
    return box;
  }
  const keyLegend = (items) => el('div', { class: 'ss-key' }, items.map(([c, t]) => el('span', {}, el('i', { style: `background:${c}` }), t)));

  // Barres horizontales : rows [{label, value, sub, color}]
  function hbars(rows, { max, color = '#f2b43a', fmtV = int, empty = 'Aucune donnée.' } = {}) {
    if (!rows.length) return el('div', { class: 'ss-empty', text: empty });
    const m = max ?? Math.max(1, ...rows.map((r) => r.value));
    return el('div', {}, rows.map((r) => el('div', { class: 'ss-hb' },
      el('span', { class: 'nm', title: r.label, text: r.label }),
      el('div', { class: 'tr' }, el('div', { class: 'fl', style: `width:${Math.min(100, (r.value / m) * 100)}%;background:${r.color || color}` })),
      el('span', { class: 'n' }, fmtV(r.value), r.sub ? el('small', { text: r.sub }) : null))));
  }
  const dimBars = (rows, { names = (k) => k, total, color } = {}) => {
    const t = total ?? rows.reduce((s, r) => s + r.count, 0);
    return hbars(rows.map((r) => ({ label: names(r.key), value: r.count, sub: t ? pc(r.count / t, 0) : '', color: color?.(r.key) })), {});
  };

  // Tableau triable.
  function table(cols, rows, { empty = 'Aucune donnée sur la période.', sort = null } = {}) {
    if (!rows.length) return el('div', { class: 'ss-empty', text: empty });
    let key = sort ?? cols.find((c) => c.num)?.key; let asc = false;
    const body = el('tbody');
    const head = el('tr');
    const draw = () => {
      const data = [...rows].sort((a, b) => {
        const va = a[key]; const vb = b[key];
        const r = typeof va === 'string' || typeof vb === 'string' ? String(va ?? '').localeCompare(String(vb ?? ''), 'fr') : (va ?? 0) - (vb ?? 0);
        return asc ? r : -r;
      });
      body.replaceChildren(...data.map((r) => el('tr', {}, cols.map((c) => {
        const v = c.render ? c.render(r) : (c.fmt ? c.fmt(r[c.key], r) : r[c.key]);
        return el('td', { class: `${c.num ? 'num' : ''} ${c.wrap ? 'wrap' : ''}`.trim() }, v ?? '');
      }))));
      [...head.children].forEach((th, i) => { th.className = `${cols[i].num ? 'num' : ''}${cols[i].key === key ? ` sorted${asc ? ' asc' : ''}` : ''}`; });
    };
    for (const c of cols) head.append(el('th', { title: c.title || null, text: c.label, onclick: () => { if (key === c.key) asc = !asc; else { key = c.key; asc = !c.num; } draw(); } }));
    draw();
    return el('div', { class: 'ss-table-wrap' }, el('table', { class: 'ss-table' }, el('thead', {}, head), body));
  }
  const chCell = (r) => el('span', {}, el('i', { class: 'ss-dot', style: `background:${chColor(r.key)}` }), chName(r.key));
  const card = (title, sub, ...body) => el('div', { class: 'ss-card' }, el('h4', { text: title }), sub ? el('div', { class: 'ss-sub', text: sub }) : null, ...body);
  const section = (id, title, sub, ...body) => el('section', { class: 'ss-sec', id: `ss-${id}` }, el('h3', { text: title }), sub ? el('p', { class: 'ss-sub', text: sub }) : null, ...body);

  function heatmap(heat) {
    const cw = 28; const ch = 24; const pl = 34; const pt = 16;
    const max = Math.max(1, ...heat.flat());
    const root = sv('svg', { class: 'ss-heat', viewBox: `0 0 ${pl + 24 * cw} ${pt + 7 * ch + 4}`, role: 'img', 'aria-label': 'Visites par jour de la semaine et par heure' });
    for (let h = 0; h < 24; h += 3) root.append(sv('text', { x: pl + h * cw + cw / 2, y: 10, 'text-anchor': 'middle' }, `${h} h`));
    heat.forEach((row, d) => {
      root.append(sv('text', { x: pl - 6, y: pt + d * ch + ch / 2 + 3, 'text-anchor': 'end' }, DAYS[d]));
      row.forEach((v, h) => root.append(sv('rect', { x: pl + h * cw + 1, y: pt + d * ch + 1, width: cw - 2, height: ch - 2, rx: 4, fill: v ? '#f2b43a' : '#1b2a4b', opacity: v ? 0.18 + 0.82 * (v / max) : 1 }, sv('title', {}, `${DAYS[d]} ${h} h : ${v} session${v > 1 ? 's' : ''}`))));
    });
    return el('div', { class: 'ss-chart scroll' }, root);
  }

  // ---------- Rendu ----------
  function render(d) {
    CH = d.channelLabels || {};
    const k = d.kpis; const pv = d.previous;
    const dl = (key, o) => (pv ? delta(k[key], pv[key], o) : { text: '' });
    $('ss-time').textContent = `Du ${d.range.from} au ${d.range.to} (${d.range.days} j, fuseau de ce navigateur) · mis à jour ${fmtDate(d.now)}${d.previousRange ? ` · comparé au ${d.previousRange.from} → ${d.previousRange.to}` : ''}`;
    const body = $('ss-body');
    body.replaceChildren();
    const liveCard = kpi('En direct (5 min)', nf(d.live.active), null, '#5fdc7a', 'Visiteurs actifs sur le site');
    liveCard.classList.add('live');
    liveCard.id = 'ss-live';
    body.append(el('div', { class: 'ss-kpis', id: 'ss-sec-kpis' },
      liveCard,
      kpi('Visiteurs uniques', nf(k.visitors), dl('visitors'), '#f2b43a'),
      kpi('Nouveaux visiteurs', nf(k.newVisitors), dl('newVisitors'), '#6aa8ff'),
      kpi('Visiteurs revenants', nf(k.returning), dl('returning'), '#b78cff'),
      kpi('Sessions', nf(k.sessions), dl('sessions'), '#4fd1c5'),
      kpi('Pages vues', nf(k.pageviews), dl('pageviews'), '#4fd1c5', k.dntViews ? `dont ${k.dntViews} anonymes (Do Not Track)` : ''),
      kpi('Durée moyenne', dur(k.avgDurationS), dl('avgDurationS'), '#8e9cc2', 'Temps actif moyen par session'),
      kpi('Taux de rebond', pc(k.bounceRate), dl('bounceRate', { rate: true, invert: true }), '#ff7a8a', 'Une page, moins de 10 s actives, pas d\'envoi de formulaire'),
      kpi('Préinscriptions', nf(k.preregs), dl('preregs'), '#5fdc7a', `${nf(k.confirmed)} confirmées par e-mail`),
      kpi('Conversion visite → inscription', pc(k.conversion, 2), dl('conversion', { rate: true }), '#5fdc7a'),
      kpi('Parrainages (filleuls)', nf(k.referrals), dl('referrals'), '#ff9f5a', `${nf(k.referralsConfirmed)} confirmés`),
      kpi('Coefficient viral', nf(k.viral, 2), dl('viral', { rate: false }), '#ff9f5a', 'Inscrits arrivés par un lien de parrainage / inscrits')));

    // Courbes
    const s = d.series; const g = d.range.granularity; const labels = s.map((x) => x.t);
    body.append(section('curves', 'Évolution', `Un point par ${{ hour: 'heure', day: 'jour', week: 'semaine', month: 'mois' }[g]}. Survolez ou touchez un graphique pour lire les valeurs.`,
      el('div', { class: 'ss-grid wide' },
        card('Visiteurs et sessions', null, keyLegend([['#f2b43a', 'Visiteurs uniques'], ['#6aa8ff', 'Sessions']]), timeChart(labels, [{ name: 'Visiteurs', color: '#f2b43a', values: s.map((x) => x.visitors) }, { name: 'Sessions', color: '#6aa8ff', values: s.map((x) => x.sessions) }], { gran: g })),
        card('Préinscriptions', null, keyLegend([['#5fdc7a', 'Préinscriptions'], ['#ff9f5a', 'dont via parrainage']]), timeChart(labels, [{ name: 'Préinscriptions', color: '#5fdc7a', values: s.map((x) => x.preregs) }, { name: 'Via parrainage', color: '#ff9f5a', values: s.map((x) => x.referrals) }], { kind: 'bar', gran: g })),
        card('Conversion visite → préinscription', null, timeChart(labels, [{ name: 'Conversion', color: '#b78cff', values: s.map((x) => x.conversion * 100), fmt: (v) => `${nf(v, 2)} %` }], { gran: g, fmtY: (v) => `${nf(v, v < 10 ? 1 : 0)} %` })),
        card('Pages vues', null, timeChart(labels, [{ name: 'Pages vues', color: '#4fd1c5', values: s.map((x) => x.pageviews) }], { gran: g })))));

    // Entonnoir
    const top = d.funnel[0].count;
    const colors = ['#6aa8ff', '#4fd1c5', '#5fdc7a', '#a5dc5f', '#f2b43a', '#ff9f5a', '#ff7a8a'];
    body.append(section('funnel', 'Entonnoir de conversion', 'Sessions ayant atteint chaque étape (une étape peut être atteinte sans passer par la précédente : l\'inscription directe, par exemple).',
      el('div', { class: 'ss-card' }, el('div', { class: 'ss-fn' }, d.funnel.map((f, i) => el('div', { class: 'st' },
        el('div', { class: 'nm', text: `${i + 1}. ${f.label}` }),
        el('div', { class: 'tr' }, el('div', { class: 'fl', style: `width:${top ? Math.max(2, (f.count / top) * 100) : 2}%;background:${colors[i]}`, text: nf(f.count) })),
        el('div', { class: 'pc' }, el('b', { text: pc(top ? f.count / top : 0) }), ' des visites', i ? el('br') : null, i ? `${d.funnel[i - 1].count ? pc(Math.min(1, f.count / d.funnel[i - 1].count), 0) : '—'} de l'étape précédente` : null)))),
      el('p', { class: 'ss-note', text: 'Utilisez les filtres en haut (canal, campagne, appareil, langue) pour voir l\'entonnoir d\'une source précise ; le tableau « Sources » ci-dessous donne l\'entonnoir de chaque canal côte à côte.' }))));

    // Sources
    const byCh = new Map(d.channels.map((c) => [c.key, c]));
    const focusCards = el('div', { class: 'ss-focus' }, FOCUS.filter((c) => byCh.has(c) || ['x', 'youtube_shorts', 'tiktok', 'steam', 'play_store'].includes(c)).map((c) => {
      const r = byCh.get(c);
      return el('div', { class: `ss-fc${r ? '' : ' off'}`, style: `--c:${chColor(c)}` }, el('b', { text: chName(c) }),
        el('dl', {}, el('dt', { text: 'Visites' }), el('dd', { text: nf(r?.sessions ?? 0) }), el('dt', { text: 'Visiteurs' }), el('dd', { text: nf(r?.visitors ?? 0) }),
          el('dt', { text: 'Préinscrits' }), el('dd', { text: nf(r?.preregs ?? 0) }), el('dt', { text: 'Conversion' }), el('dd', { text: pc(r?.conversion ?? 0, 1) }), el('dt', { text: 'Parrainages' }), el('dd', { text: nf(r?.referrals ?? 0) })));
    }));
    const srcCols = [
      { key: 'key', label: 'Canal', render: chCell }, { key: 'sessions', label: 'Visites', num: true, fmt: int }, { key: 'visitors', label: 'Uniques', num: true, fmt: int },
      { key: 'avgDurationS', label: 'Durée', num: true, fmt: dur }, { key: 'bounceRate', label: 'Rebond', num: true, fmt: (v) => pc(v, 0) },
      { key: 'preregs', label: 'Préinscrits', num: true, fmt: int }, { key: 'conversion', label: 'Conversion', num: true, fmt: (v) => pc(v, 2) },
      { key: 'referrals', label: 'Parrainages', num: true, fmt: int, title: 'Filleuls amenés par les inscrits de ce canal' },
    ];
    const funnelCols = ['Visite', 'Vidéo', 'Section vue', 'Saisie', 'Envoi', 'Confirmé', 'A parrainé'].map((l, i) => ({ key: `f${i}`, label: l, num: true, fmt: int }));
    const chRows = d.channels.map((c) => ({ ...c, ...Object.fromEntries(c.funnel.map((n, i) => [`f${i}`, n])) }));
    const campCols = [
      { key: 'key', label: 'Campagne', wrap: true }, { key: 'source', label: 'Source' }, { key: 'medium', label: 'Support' }, ...srcCols.slice(1),
    ];
    body.append(section('sources', 'Sources et campagnes', 'D\'où viennent les visiteurs : paramètres utm_* du lien en priorité, sinon site d\'origine. Les liens se fabriquent plus bas (générateur de campagne).',
      focusCards,
      el('div', { class: 'ss-grid' },
        card('Visites par canal', null, hbars(d.channels.filter((c) => c.sessions).slice(0, 12).map((c) => ({ label: chName(c.key), value: c.sessions, color: chColor(c.key), sub: k.sessions ? pc(c.sessions / k.sessions, 0) : '' })))),
        card('Préinscriptions par canal', null, hbars(d.channels.filter((c) => c.preregs).sort((a, b) => b.preregs - a.preregs).slice(0, 12).map((c) => ({ label: chName(c.key), value: c.preregs, color: chColor(c.key), sub: pc(c.conversion, 1) })), { empty: 'Aucune préinscription sur la période.' }))),
      el('h4', { text: 'Tous les canaux', style: 'margin:20px 0 8px' }), table(srcCols, d.channels),
      el('h4', { text: 'Entonnoir par canal', style: 'margin:20px 0 8px' }), table([{ key: 'key', label: 'Canal', render: chCell }, ...funnelCols], chRows, { sort: 'f0' }),
      el('h4', { text: 'Campagnes (utm_campaign)', style: 'margin:20px 0 8px' }), table(campCols, d.campaigns, { empty: 'Aucune campagne utm sur la période. Fabriquez un lien dans « Générateur de liens » plus bas.' }),
      d.contents.length ? el('h4', { text: 'Variantes (utm_content)', style: 'margin:20px 0 8px' }) : null,
      d.contents.length ? table([{ key: 'campaign', label: 'Campagne' }, { key: 'content', label: 'Variante' }, ...srcCols.slice(1)], d.contents) : null,
      el('div', { class: 'ss-grid', style: 'margin-top:20px' },
        card('Sites d\'origine (referrers)', 'Domaines seulement, jamais l\'adresse complète.', table([{ key: 'key', label: 'Site', wrap: true }, { key: 'sessions', label: 'Visites', num: true, fmt: int }, { key: 'preregs', label: 'Inscrits', num: true, fmt: int }], d.referrers, { empty: 'Aucun referrer (visites directes ou applications sans referrer).' })),
        card('Pages d\'entrée', null, table([{ key: 'page', label: 'Page' }, { key: 'sessions', label: 'Visites', num: true, fmt: int }, { key: 'bounceRate', label: 'Rebond', num: true, fmt: (v) => pc(v, 0) }, { key: 'preregs', label: 'Inscrits', num: true, fmt: int }], d.entryPages)),
        card('Pages de sortie', null, table([{ key: 'page', label: 'Page' }, { key: 'sessions', label: 'Sorties', num: true, fmt: int }], d.exitPages)),
        card('Pages vues', null, table([{ key: 'page', label: 'Page' }, { key: 'views', label: 'Vues', num: true, fmt: int }, { key: 'uniques', label: 'Sessions', num: true, fmt: int }], d.pages)))));

    // Clics
    const totalClicks = d.clicks.reduce((a, c) => a + c.count, 0);
    const OUT = { x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok', steam: 'Steam', play_store: 'Google Play', discord: 'Discord', reddit: 'Reddit', facebook: 'Facebook', instagram: 'Instagram', twitch: 'Twitch' };
    body.append(section('clicks', 'Clics', `${nf(totalClicks)} clics mesurés. Où les gens cliquent, et vers quels réseaux ils repartent.`,
      el('div', { class: 'ss-grid' },
        card('Boutons et liens les plus cliqués', null, hbars(d.clicks.slice(0, 14).map((c) => ({ label: clickName(c.id), value: c.count, sub: c.sessions !== c.count ? `${nf(c.sessions)} sess.` : '' })), { color: '#f2b43a', empty: 'Aucun clic mesuré.' })),
        card('Sorties vers les réseaux', 'Clics sur un lien qui quitte le site.', hbars(d.outbound.map((o) => ({ label: OUT[o.key] ?? o.key.replace('other:', ''), value: o.count, sub: `${nf(o.sessions)} sess.`, color: chColor(o.key) })), { empty: 'Aucune sortie mesurée.' }))),
      el('div', { style: 'margin-top:14px' }, table([{ key: 'id', label: 'Identifiant', render: (r) => clickName(r.id), wrap: true }, { key: 'out', label: 'Destination', render: (r) => (r.out ? (OUT[r.out] ?? r.out) : '') }, { key: 'count', label: 'Clics', num: true, fmt: int }, { key: 'sessions', label: 'Sessions', num: true, fmt: int }], d.clicks))));

    // Vidéo, défilement, sections
    const v = d.video;
    const secIds = [...new Set([...SECTION_ORDER.filter((x) => d.sections.some((s2) => s2.id === x)), ...d.sections.map((x) => x.id)])];
    const secMap = new Map(d.sections.map((x) => [x.id, x]));
    body.append(section('video', 'Vidéo, défilement et sections', 'La vidéo d\'accueil démarre toute seule (muette, en boucle) : « lectures » = sessions où elle a réellement joué.',
      el('div', { class: 'ss-grid' },
        card('Vidéo d\'accueil', null,
          el('div', { class: 'ss-kpis', style: 'grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:12px' },
            kpi('Lectures', nf(v.plays), null, '#6aa8ff', `${pc(v.playRate, 0)} des sessions`), kpi('% moyen regardé', `${nf(v.avgMaxPct, 0)} %`, null, '#4fd1c5'),
            kpi('Abandons (< 25 %)', nf(v.abandons), null, '#ff7a8a'), kpi('Taux de lecture', pc(v.playRate, 0), null, '#5fdc7a')),
          hbars(v.reach.map((r) => ({ label: `≥ ${r.pct} % vue`, value: r.count, sub: v.plays ? pc(r.count / v.plays, 0) : '' })), { max: Math.max(1, v.plays), color: '#6aa8ff', empty: 'Aucune lecture.' })),
        card('Profondeur de défilement', 'Part des sessions qui ont défilé jusqu\'à…', hbars(d.scroll.map((r) => ({ label: `jusqu'à ${r.pct} %`, value: r.count, sub: pc(r.rate, 0) })), { max: Math.max(1, k.sessions), color: '#b78cff' }),
          el('div', { class: 'ss-scroll' }, d.scroll.map((r) => el('div', {}, el('b', { text: pc(r.rate, 0) }), `${r.pct} %`)))),
        card('Sections vues (carte de chaleur verticale)', 'Dans l\'ordre de la page, de haut en bas.', secIds.length ? el('div', { class: 'ss-page' }, secIds.map((id) => {
          const sct = secMap.get(id);
          const r = sct?.rate ?? 0;
          return el('div', { class: 'blk', style: `--w:${Math.round(r * 100)}%;--a:${(0.12 + r * 0.55).toFixed(2)}` }, el('span', { text: SECTION_NAMES[id] ?? id }), el('b', { text: `${pc(r, 0)} · ${nf(sct?.sessions ?? 0)}` }));
        })) : el('div', { class: 'ss-empty', text: 'Aucune section mesurée.' })))));

    // Audience
    const a = d.audience;
    const hours = a.hours;
    body.append(section('audience', 'Audience', 'Appareils, langues, pays et moments de la journée (heure de ce navigateur).',
      el('div', { class: 'ss-grid' },
        card('Appareils', null, dimBars(a.devices, { names: (x) => DEVICE_NAMES[x] ?? x })),
        card('Systèmes', null, dimBars(a.os)), card('Navigateurs', null, dimBars(a.browsers)), card('Tailles d\'écran', null, dimBars(a.screens)),
        card('Langues du site', null, dimBars(a.langs, { names: (x) => x.toUpperCase() })), card('Pays', a.countryNote, dimBars(a.countries))),
      el('div', { class: 'ss-grid wide', style: 'margin-top:14px' },
        card('Jour de la semaine', null, timeChartDays(a.weekdays)),
        card('Heure de la journée', null, timeChart(hours.map((_, i) => `0000-00-00T${pad(i)}`), [{ name: 'Sessions', color: '#f2b43a', values: hours }], { kind: 'bar', height: 170, label: (b) => `${b.slice(11)} h` }))),
      el('div', { style: 'margin-top:14px' }, card('Carte de chaleur : jour × heure', 'Plus c\'est lumineux, plus il y a de sessions. Survolez une case pour le détail.', heatmap(a.heat)))));

    // Parrainage
    const rf = d.referral;
    body.append(section('referral', 'Parrainage', 'Les inscrits qui en amènent d\'autres. Les e-mails sont masqués.',
      el('div', { class: 'ss-kpis', style: 'margin-bottom:14px' },
        kpi('Arrivées par lien de parrainage', nf(rf.arrivals), null, '#ff9f5a', 'Sessions arrivées avec ?ref='), kpi('…qui se sont inscrites', nf(rf.arrivalsConverted), null, '#5fdc7a', rf.arrivals ? pc(rf.arrivalsConverted / rf.arrivals, 0) : ''),
        kpi('Liens copiés', nf(rf.copies), null, '#6aa8ff'), kpi('Partages', nf(rf.shares), null, '#b78cff'),
        kpi('Délai visite → inscription', rf.avgSecondsToSignup ? dur(rf.medianSecondsToSignup) : '—', null, '#8e9cc2', 'Médiane ; moyenne : ' + dur(rf.avgSecondsToSignup)),
        kpi('Délai pour un filleul', rf.avgSecondsToSignupReferred ? dur(rf.avgSecondsToSignupReferred) : '—', null, '#8e9cc2', 'Moyenne, depuis la première visite'),
        kpi('Délai parrain → filleul', rf.avgSecondsAfterSponsor ? dur(rf.avgSecondsAfterSponsor) : '—', null, '#8e9cc2', 'Moyenne, entre les deux inscriptions')),
      el('div', { class: 'ss-grid wide' },
        card('Meilleurs parrains', null, table([{ key: 'who', label: 'Parrain' }, { key: 'ref', label: 'Code' }, { key: 'count', label: 'Filleuls', num: true, fmt: int }, { key: 'confirmed', label: 'Confirmés', num: true, fmt: int }, { key: 'channel', label: 'Venu de', render: (r) => (r.channel ? chName(r.channel) : '—') }], rf.top, { sort: 'confirmed', empty: 'Aucun parrainage encore.' })),
        card('Chaînes de parrainage', 'Un inscrit sans parrain qui a lancé une chaîne : taille totale et profondeur.', table([{ key: 'who', label: 'Racine' }, { key: 'size', label: 'Personnes', num: true, fmt: int }, { key: 'depth', label: 'Niveaux', num: true, fmt: int }, { key: 'channel', label: 'Venu de', render: (r) => (r.channel ? chName(r.channel) : '—') }], rf.chains, { sort: 'size', empty: 'Aucune chaîne encore.' })))));

    // Qualité
    const q = d.quality;
    const VITALS = { lcp: ['LCP (affichage principal)', 'Bon ≤ 2,5 s'], fcp: ['FCP (premier affichage)', 'Bon ≤ 1,8 s'], cls: ['CLS (stabilité visuelle)', 'Bon ≤ 0,1'], inp: ['INP (réactivité)', 'Bon ≤ 200 ms'], ttfb: ['TTFB (réponse du serveur)', 'Bon ≤ 800 ms'], load: ['Chargement complet', ''] };
    const vrows = Object.entries(d.quality.vitals).filter(([, x]) => x.n).map(([key, x]) => ({ key, name: VITALS[key]?.[0] ?? key, ...x, rating: x.p75 <= x.limits[0] ? 'good' : x.p75 <= x.limits[1] ? 'mid' : 'poor' }));
    body.append(section('quality', 'Qualité technique', 'Erreurs JavaScript, temps de chargement (Core Web Vitals) et trafic écarté.',
      el('div', { class: 'ss-grid wide' },
        el('div', { class: 'full' }, card('Core Web Vitals', 'Médiane, 75e et 95e centile des visites mesurées (le 75e fait foi).', table([
          { key: 'name', label: 'Mesure' }, { key: 'p50', label: 'Médiane', num: true, fmt: (x, r) => ms(x, r.key) }, { key: 'p75', label: '75e', num: true, fmt: (x, r) => ms(x, r.key) }, { key: 'p95', label: '95e', num: true, fmt: (x, r) => ms(x, r.key) },
          { key: 'good', label: 'Bon', num: true, fmt: (x) => pc(x, 0) }, { key: 'n', label: 'Mesures', num: true, fmt: int },
          { key: 'rating', label: 'Verdict', render: (r) => el('span', { class: `ss-pill ${r.rating}`, text: { good: 'Bon', mid: 'À améliorer', poor: 'Mauvais' }[r.rating] }) }], vrows, { sort: 'n', empty: 'Pas encore de mesures de performance.' }))),
        card('Trafic écarté', 'Robots et sessions sans aucune interaction (non comptés dans les statistiques).', hbars([
          { label: 'Robots (agent utilisateur)', value: q.bots.ua, color: '#ff7a8a' }, { label: 'Sessions sans interaction', value: q.bots.noInteraction, color: '#ff9f5a' }], { empty: '' }))),
      el('h4', { text: 'Erreurs JavaScript du site', style: 'margin:20px 0 8px' }),
      table([{ key: 'message', label: 'Message', wrap: true }, { key: 'source', label: 'Fichier' }, { key: 'count', label: 'Fois', num: true, fmt: int }, { key: 'sessions', label: 'Sessions', num: true, fmt: int }, { key: 'page', label: 'Page' }, { key: 'last', label: 'Dernière', num: true, fmt: fmtDate }], q.errors, { empty: 'Aucune erreur JavaScript sur la période. 🎉' })));

    // Campagnes
    body.append(section('campaigns', 'Générateur de liens de campagne', 'Chaque réseau reçoit son propre lien : c\'est ce qui permet de savoir combien de gens viennent de X, YouTube Shorts, TikTok…', el('div', { id: 'ss-gen' })));
    renderGenerator(d);
  }

  function timeChartDays(values) {
    return timeChart(DAYS, [{ name: 'Sessions', color: '#6aa8ff', values }], { kind: 'bar', height: 170, label: (b) => b });
  }

  // ---------- Générateur de liens ----------
  let gen = { presets: [], campaigns: [], baseUrl: 'https://ascendrya.com' };
  const slugTag = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9_.-]/g, '').slice(0, 60);
  function genUrl(f) {
    const s = slugTag(f.source); const m = slugTag(f.medium); const c = slugTag(f.campaign);
    if (!s || !m || !c) return '';
    const u = new URL(`${gen.baseUrl.replace(/\/+$/, '')}/`);
    u.searchParams.set('utm_source', s); u.searchParams.set('utm_medium', m); u.searchParams.set('utm_campaign', c);
    if (slugTag(f.content)) u.searchParams.set('utm_content', slugTag(f.content));
    if (slugTag(f.term)) u.searchParams.set('utm_term', slugTag(f.term));
    return u.toString();
  }
  const copyText = async (text, label = 'Lien copié.') => {
    try { await navigator.clipboard.writeText(text); toast(label); } catch {
      const t = el('textarea', { style: 'position:fixed;opacity:0' }); t.value = text; document.body.append(t); t.select();
      try { document.execCommand('copy'); toast(label); } catch { toast('Copie impossible : sélectionnez le lien à la main.', 'bad'); } t.remove();
    }
  };
  async function loadGen() {
    try { gen = { ...gen, ...(await api('/api/admin/site-campaigns')) }; } catch (e) { toast(e.message, 'bad'); }
  }
  function renderGenerator(d) {
    const root = $('ss-gen');
    if (!root) return;
    const f = { preset: '', name: '', source: '', medium: '', campaign: '', content: '', term: '' };
    const inputs = {};
    const out = el('div', { class: 'ss-url', id: 'ss-gen-url', text: 'Choisissez un réseau, puis donnez un nom de campagne.' });
    const refresh = () => { const u = genUrl(f); out.textContent = u || 'Choisissez un réseau, puis donnez un nom de campagne.'; out.dataset.url = u; copyBtn.disabled = !u; saveBtn.disabled = !u; };
    const field = (key, label, ph, req) => {
      inputs[key] = el('input', { type: 'text', maxlength: 60, placeholder: ph, autocomplete: 'off', 'aria-label': label, oninput: (e) => { f[key] = e.target.value; refresh(); } });
      return el('label', {}, `${label}${req ? ' *' : ''}`, inputs[key]);
    };
    const chips = el('div', { class: 'ss-row', style: 'margin-bottom:12px' }, gen.presets.map((p) => el('button', { type: 'button', class: 'ss-chip', 'data-p': p.id, text: p.label, onclick: () => {
      f.preset = p.id; f.source = p.source; f.medium = p.medium;
      inputs.source.value = p.source; inputs.medium.value = p.medium;
      if (!f.campaign) { f.campaign = `lancement-${ymd(new Date()).slice(0, 7)}`; inputs.campaign.value = f.campaign; }
      chips.querySelectorAll('.ss-chip').forEach((c) => c.classList.toggle('on', c.dataset.p === p.id));
      refresh();
    } })));
    const copyBtn = el('button', { class: 'btn primary', type: 'button', text: 'Copier le lien', onclick: () => copyText(out.dataset.url || '') });
    const saveBtn = el('button', { class: 'btn', type: 'button', text: 'Enregistrer la campagne', onclick: async () => {
      try {
        const made = await api('/api/admin/site-campaigns', { method: 'POST', body: { name: f.name, preset: f.preset, source: f.source, medium: f.medium, campaign: f.campaign, content: f.content, term: f.term } });
        toast(made.existed ? 'Cette campagne existe déjà.' : 'Campagne enregistrée.');
        await loadGen(); renderList();
      } catch (e) { toast(e.message, 'bad'); }
    } });
    const list = el('div', { style: 'margin-top:18px' });
    const results = new Map((d.campaignsCreated || []).map((c) => [c.id, c]));
    const renderList = () => {
      list.replaceChildren(el('h4', { text: 'Campagnes enregistrées', style: 'margin:0 0 8px' }), table([
        { key: 'name', label: 'Nom', wrap: true }, { key: 'source', label: 'Source' }, { key: 'campaign', label: 'Campagne' }, { key: 'content', label: 'Variante', fmt: (x) => x || '' },
        { key: 'sessions', label: 'Visites', num: true, fmt: int }, { key: 'preregs', label: 'Inscrits', num: true, fmt: int }, { key: 'conversion', label: 'Conv.', num: true, fmt: (x) => pc(x, 1) },
        { key: 'url', label: 'Actions', render: (r) => el('span', { class: 'ss-row', style: 'flex-wrap:nowrap' },
          el('button', { class: 'btn small', type: 'button', text: 'Copier', onclick: () => copyText(r.url) }),
          el('button', { class: 'btn small danger', type: 'button', text: 'Supprimer', onclick: async () => { if (!confirm('Supprimer cette campagne enregistrée ? (les statistiques restent)')) return; try { await api(`/api/admin/site-campaigns/${r.id}`, { method: 'DELETE' }); await loadGen(); renderList(); } catch (e) { toast(e.message, 'bad'); } } })) },
      ], gen.campaigns.map((c) => ({ ...c, ...(results.get(c.id) ?? { sessions: 0, visitors: 0, preregs: 0, conversion: 0 }) })), { sort: 'sessions', empty: 'Aucune campagne enregistrée. Fabriquez un lien ci-dessus puis cliquez sur « Enregistrer la campagne ».' }));
    };
    root.replaceChildren(el('div', { class: 'ss-card' },
      chips,
      el('div', { class: 'ss-form' }, field('name', 'Nom interne', 'Short du 28 nov (facultatif)'), field('source', 'utm_source', 'x, youtube, tiktok…', true), field('medium', 'utm_medium', 'social, shorts, store…', true),
        field('campaign', 'utm_campaign', 'lancement-2026-11', true), field('content', 'utm_content', 'short-01, bio, pinned…'), field('term', 'utm_term', 'mot-cle (facultatif)')),
      out, el('div', { class: 'ss-row' }, copyBtn, saveBtn),
      el('p', { class: 'ss-note', text: `Adresse de base : ${gen.baseUrl}. Mettez ce lien dans la description, la bio ou le tweet épinglé : chaque visite sera rattachée à ce réseau et à cette campagne (utm_content sert à comparer deux vidéos ou deux posts).` }),
      list));
    renderList(); refresh();
  }

  // ---------- Barre d'outils ----------
  const SECTIONS = [['kpis', 'Chiffres clés'], ['curves', 'Évolution'], ['funnel', 'Entonnoir'], ['sources', 'Sources'], ['clicks', 'Clics'], ['video', 'Vidéo et défilement'], ['audience', 'Audience'], ['referral', 'Parrainage'], ['quality', 'Qualité'], ['campaigns', 'Campagnes']];
  const PERIODS = [['today', "Aujourd'hui"], ['7d', '7 j'], ['30d', '30 j'], ['90d', '90 j'], ['all', 'Tout'], ['custom', 'Personnalisé']];
  const CSV_TABLES = [['channels', 'Canaux'], ['campaigns', 'Campagnes'], ['contents', 'Variantes'], ['referrers', 'Referrers'], ['series', 'Courbes'], ['funnel', 'Entonnoir'], ['clicks', 'Clics'], ['outbound', 'Sorties'], ['sections', 'Sections'], ['pages', 'Pages'], ['entry_pages', 'Pages d\'entrée'], ['exit_pages', 'Pages de sortie'], ['errors', 'Erreurs'], ['sponsors', 'Parrains'], ['devices', 'Appareils'], ['os', 'Systèmes'], ['browsers', 'Navigateurs'], ['countries', 'Pays'], ['langs', 'Langues'], ['sessions', 'Sessions (brut anonyme)'], ['kpis', 'Chiffres clés']];
  let built = false;
  function buildShell() {
    const root = $('ss-root');
    const chipRow = el('div', { class: 'ss-row', role: 'group', 'aria-label': 'Période' }, PERIODS.map(([id, label]) => el('button', { type: 'button', class: `ss-chip${st.period === id ? ' on' : ''}`, 'data-period': id, text: label, onclick: () => { st.period = id; syncBar(); load(); } })));
    const dateFrom = el('input', { type: 'date', id: 'ss-from', 'aria-label': 'Du', onchange: (e) => { st.from = e.target.value; load(); } });
    const dateTo = el('input', { type: 'date', id: 'ss-to', 'aria-label': 'Au', onchange: (e) => { st.to = e.target.value; load(); } });
    const mkSel = (key, label, id) => el('label', { class: 'ss-lbl' }, `${label} `, el('select', { id, 'aria-label': label, onchange: (e) => { st[key] = e.target.value; load(); } }, el('option', { value: '', text: 'Tous' })));
    const granSel = el('select', { id: 'ss-gran', 'aria-label': 'Granularité', onchange: (e) => { st.gran = e.target.value; load(); } }, [['auto', 'Auto'], ['hour', 'Par heure'], ['day', 'Par jour'], ['week', 'Par semaine'], ['month', 'Par mois']].map(([v, t]) => el('option', { value: v, text: t })));
    const csvSel = el('select', { id: 'ss-csv-sel', 'aria-label': 'Tableau à exporter', onchange: (e) => { st.csv = e.target.value; } }, CSV_TABLES.map(([v, t]) => el('option', { value: v, text: t })));
    const csvBtn = el('button', { class: 'btn small', type: 'button', text: 'Exporter CSV', onclick: async () => {
      try {
        const res = await api(`/api/admin/site-stats/csv?${query({ table: st.csv })}`, { raw: true });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const url = URL.createObjectURL(await res.blob());
        const a = el('a', { href: url, download: `ascendrya-site-${st.csv}-${ymd(new Date())}.csv` });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (e) { toast(e.message, 'bad'); }
    } });
    root.replaceChildren(
      el('div', { class: 'ss-bar' },
        chipRow,
        el('div', { class: 'ss-row' }, el('span', { id: 'ss-custom', class: 'ss-row hidden' }, dateFrom, '→', dateTo), mkSel('channel', 'Canal', 'ss-f-channel'), mkSel('campaign', 'Campagne', 'ss-f-campaign'), mkSel('device', 'Appareil', 'ss-f-device'), mkSel('lang', 'Langue', 'ss-f-lang'),
          el('label', { class: 'ss-lbl' }, 'Courbes ', granSel), el('span', { class: 'ss-row', style: 'margin-left:auto' }, csvSel, csvBtn)),
        el('nav', { class: 'ss-nav', 'aria-label': 'Sections' }, SECTIONS.map(([id, t]) => el('a', { href: `#ss-${id === 'kpis' ? 'sec-kpis' : id}`, text: t, onclick: (e) => { e.preventDefault(); $(id === 'kpis' ? 'ss-sec-kpis' : `ss-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } })))),
      el('div', { id: 'ss-body' }, el('p', { class: 'muted', text: 'Chargement…' })));
    built = true;
    syncBar();
  }
  function syncBar() {
    document.querySelectorAll('#ss-root [data-period]').forEach((b) => b.classList.toggle('on', b.dataset.period === st.period));
    $('ss-custom')?.classList.toggle('hidden', st.period !== 'custom');
    if (st.period === 'custom') { const r = range(); $('ss-from').value = r.from; $('ss-to').value = r.to; }
  }
  function fillOptions(d) {
    const opt = (id, key, rows, name) => {
      const sel = $(id); if (!sel) return;
      const cur = st[key];
      sel.replaceChildren(el('option', { value: '', text: 'Tous' }), ...rows.map((v) => el('option', { value: v, text: name(v) })));
      if (cur && !rows.includes(cur)) sel.append(el('option', { value: cur, text: name(cur) }));
      sel.value = cur;
    };
    opt('ss-f-channel', 'channel', d.options.channels, chName);
    opt('ss-f-campaign', 'campaign', d.options.campaigns, (v) => v);
    opt('ss-f-device', 'device', d.options.devices, (v) => DEVICE_NAMES[v] ?? v);
    opt('ss-f-lang', 'lang', d.options.langs, (v) => v.toUpperCase());
  }

  async function load() {
    if (!built) buildShell();
    const seq = ++st.seq;
    try {
      const [d] = await Promise.all([api(`/api/admin/site-stats?${query()}`), loadGen()]);
      if (seq !== st.seq) return;
      st.d = d;
      CH = d.channelLabels || CH;
      fillOptions(d);
      render(d);
    } catch (e) { if (seq === st.seq) { toast(e.message, 'bad'); $('ss-time').textContent = 'Erreur de chargement'; } }
  }

  async function pollLive() {
    const panel = document.querySelector('[data-panel="site"]');
    if (!panel || panel.classList.contains('hidden') || !$('ss-live')) return;
    try {
      const l = await api('/api/admin/site-stats/live');
      const v = $('ss-live')?.querySelector('.v');
      if (v) v.textContent = nf(l.active);
    } catch { /* la prochaine tentative réessaiera */ }
  }
  setInterval(pollLive, 30000);

  document.querySelector('[data-tab="site"]')?.addEventListener('click', load);
  $('ss-refresh')?.addEventListener('click', load);
  window.siteStatsReload = load;
})();
