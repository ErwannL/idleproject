// Moteur de traduction commun à toutes les langues (dictionnaire exact, motifs, règles génériques).
// Chaque langue (./en.js, ./ko.js…) fournit son dictionnaire EXACT et ses PATTERNS ; le moteur ajoute
// les règles génériques : listes « a · b », « libellé : valeur », parenthèses, symboles et nombres seuls.

// Virgule décimale française → point (anglais, coréen).
export const num = (s) => String(s ?? '').replace(/(\d),(\d)/g, '$1.$2');

// Découpe au premier niveau de parenthèses / guillemets (« a · (b · c) » → [a, (b · c)]).
function splitTop(s, sep) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '«') depth += 1;
    else if ((c === ')' || c === '»') && depth > 0) depth -= 1;
    else if (depth === 0 && s.startsWith(sep, i)) {
      parts.push(s.slice(start, i));
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

const HAS_LETTER = /\p{L}/u;
// v9.1.9 : grands nombres « 232,3 ai » (unités aa…zz après un chiffre).
const UNITS = /\b(?:K|M|B|T|Qa|Qi|s|m|XP)\b|(?<=\d )[a-z]{2}\b/g;
// Texte sans mot à traduire : nombres, symboles, unités.
const isNeutral = (s) => !HAS_LETTER.test(s.replace(UNITS, ''));
const neutral = (s) => num(s).replace(/(\d) %/g, '$1%');

// Liste « a · b · c » : toutes les parties doivent être traduisibles (ou neutres).
function joinParts(lookup, s, sep, outSep = sep, depth = 0) {
  if (!s.includes(sep)) return null;
  const parts = splitTop(s, sep);
  if (parts.length < 2) return null;
  const out = [];
  for (const p of parts) {
    const t = p.trim() ? lookup(p.trim(), depth + 1) : '';
    if (t === null) return null;
    out.push(t);
  }
  return out.join(outSep);
}


// Crée la fonction de traduction d'une langue. `exact` et `patterns` peuvent être complétés après coup
// (les objets sont lus à chaque appel).
export function createTranslator(exact, patterns) {
  // Traduction d'une chaîne normalisée ; null si inconnue.
  function lookup(s, depth = 0) {
    if (!s) return s;
    if (Object.hasOwn(exact, s)) return exact[s];
    for (const [re, rep] of patterns) {
      const m = s.match(re);
      if (!m) continue;
      if (typeof rep === 'function') {
        const r = rep(m);
        if (r !== null && r !== undefined) return r;
        continue;
      }
      return rep.replace(/\$(\d)/g, (_, i) => num(m[Number(i)] ?? ''));
    }
    if (isNeutral(s)) return neutral(s);
    if (depth > 6) return null;
    const d = depth + 1;
    let r;
    // Listes et séparateurs (rewardText, effectText, « Nom · Rareté · niv. 5 », « A — B »…).
    if ((r = joinParts(lookup, s, ' · ', ' · ', depth)) !== null) return r;
    if ((r = joinParts(lookup, s, ' — ', ' — ', depth)) !== null) return r;
    // v9.1.9 : chemins d'écran « Héros › Améliorations »
    if ((r = joinParts(lookup, s, ' › ', ' › ', depth)) !== null) return r;
    if ((r = joinParts(lookup, s, ' : ', ': ', depth)) !== null) return r;
    if ((r = joinParts(lookup, s, ', ', ', ', depth)) !== null) return r;
    if ((r = joinParts(lookup, s, ' + ', ' + ', depth)) !== null) return r;
    // « Libellé : » (valeur dans un autre élément)
    let m = s.match(/^(.+?) ?:$/);
    if (m && (r = lookup(m[1], d)) !== null) return `${r}:`;
    // « : suite » (après un élément en gras)
    m = s.match(/^: (.+)$/);
    if (m && (r = lookup(m[1], d)) !== null) return `: ${r}`;
    // « Texte (détail) » et « (détail) »
    m = s.match(/^(.+) \(([^()]+)\)$/);
    if (m) {
      const a = lookup(m[1], d);
      const b = lookup(m[2], d);
      if (a !== null && b !== null) return `${a} (${b})`;
    }
    m = s.match(/^\(([^()]+)\)$/);
    if (m && (r = lookup(m[1], d)) !== null) return `(${r})`;
    // Symboles en tête (✦, ★, ●, →, ·, ⚔, 📍, ♛…) ou en fin (▶, ✓, ✔, !, ?, ·).
    m = s.match(/^([^\p{L}\p{N}+\-−(«"'~]+?) ?(\S.*)$/u);
    if (m && m[1].trim() && (r = lookup(m[2], d)) !== null) return `${m[1]}${s.slice(m[1].length, s.length - m[2].length)}${r}`;
    m = s.match(/^(.*\S)( ?)([^\p{L}\p{N})».%…'’]+)$/u);
    if (m && (r = lookup(m[1], d)) !== null) {
      const tail = m[3].trim();
      // Pas d'espace avant « ! ? : ; » en anglais.
      return /^[!?:;]/.test(tail) ? `${r}${tail}` : `${r}${m[2]}${m[3]}`;
    }
    return null;
  }

  // Traduit une chaîne (espaces internes normalisés) ; renvoie l'original si aucune règle ne s'applique.
  function translate(text) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!s) return String(text ?? '');
    const r = lookup(s);
    return r === null ? String(text) : r;
  }
  return { lookup, translate };
}

// v9.1.9 : petit langage pour écrire les motifs d'une langue : P(français, traduction).
// Dans le français : « # » nombre (NUM de la langue), « @ » texte libre, « ~s » lettre facultative (pluriel).
// Dans la traduction : $1 = nombre (virgule → point), %1 = texte traduit par `getLookup()` (sinon le motif ne
// s'applique pas), &1 = durée passée à `dur`. Une fonction en traduction reçoit le résultat de `match`.
export function makeP(NUM, getLookup, dur = (x) => x) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return function P(fr, out) {
    let src = '';
    for (const part of fr.split(/(#|@|~[a-zé])/)) {
      if (part === '#') src += NUM;
      else if (part === '@') src += '(.+?)';
      else if (/^~.$/.test(part)) src += `${part[1]}?`;
      else src += esc(part);
    }
    const re = new RegExp(`^${src}$`);
    if (typeof out === 'function') return [re, out];
    return [re, (m) => {
      let ok = true;
      const r = out.replace(/([$%&])(\d)/g, (_, k, i) => {
        const v = (m[Number(i)] ?? '').trim();
        if (k === '$') return num(v);
        if (k === '&') return dur(v);
        const x = getLookup()(v);
        if (x === null) { ok = false; return v; }
        return x;
      });
      return ok ? r : null;
    }];
  };
}
