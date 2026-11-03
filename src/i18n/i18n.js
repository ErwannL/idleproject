// Couche de traduction (français → autres langues) appliquée au DOM à la volée.
// Les gabarits de l'interface restent écrits en français ; dans une autre langue, un MutationObserver
// traduit chaque nœud texte ajouté ou modifié (et les attributs title, placeholder, aria-label, alt).
// Les chaînes contenant du HTML ne passent pas par t() : on traduit le DOM après insertion.
// Chaque langue a son dictionnaire et ses motifs (./en.js, ./ko.js), sur le moteur commun ./engine.js.
import { translate as translateEn } from './en.js';
import { translate as translateKo } from './ko.js';
import { BUILD } from '../core/build-info.js';

const STORAGE_KEY = 'idle-rpg.lang';

// Langues connues (coréen ouvert à tous en v9.1.8). `enabled: false` : langue en préparation, invisible pour les joueurs ; elle reste
// utilisable dans la version dev (BUILD.cheats) ou en test via l'adresse « ?lang=ko ».
// La police propre à une langue (coréen) est choisie par la feuille de style via html[lang].
export const LANGS = {
  fr: { label: 'Français', flag: '🇫🇷', enabled: true, translate: null },
  en: { label: 'English', flag: '🇬🇧', enabled: true, translate: translateEn },
  ko: { label: '한국어', flag: '🇰🇷', enabled: true, translate: translateKo },
};
export const SOURCE_LANG = 'fr';

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'CANVAS', 'SVG']);
const HAS_TEXT = /[\p{L}\p{N}]/u;
const CACHE_MAX = 8000;

let lang = null;
let cache = new Map(); // texte normalisé → traduction (ou null : rien à traduire), pour la langue courante
let outputs = new Set(); // traductions déjà produites (évite de retraduire un texte déjà traduit)

// Langue demandée dans l'adresse (« ?lang=ko ») : pour tester une langue pas encore ouverte.
function urlLang() {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    return Object.hasOwn(LANGS, v ?? '') ? v : null;
  } catch {
    return null;
  }
}

// Une langue est proposée si elle est ouverte, ou en version dev, ou demandée par l'adresse.
export function isLangAvailable(code) {
  const l = LANGS[code];
  if (!l) return false;
  return l.enabled || BUILD.cheats === true || urlLang() === code;
}

// Langues à proposer dans Paramètres : [{ code, label, flag }].
export function availableLangs() {
  return Object.entries(LANGS).filter(([code]) => isLangAvailable(code)).map(([code, l]) => ({ code, label: l.label, flag: l.flag }));
}

function readStoredLang() {
  const fromUrl = urlLang();
  if (fromUrl) return fromUrl;
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLangAvailable(v) ? v : SOURCE_LANG;
  } catch {
    return SOURCE_LANG;
  }
}

export function getLang() {
  if (lang === null) lang = readStoredLang();
  return lang;
}

// Change la langue, la mémorise et met à jour les arbres observés (retour au français, puis traduction).
export function setLang(next) {
  const value = isLangAvailable(next) ? next : SOURCE_LANG;
  const changed = value !== getLang();
  lang = value;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // stockage indisponible (navigation privée…) : la langue vaut pour cette session
  }
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = value;
  if (changed) {
    cache = new Map();
    outputs = new Set();
    for (const root of observed.keys()) {
      restoreTree(root);
      if (value !== SOURCE_LANG) translateTree(root);
    }
    try {
      globalThis.dispatchEvent?.(new CustomEvent('idle-rpg:lang', { detail: { lang: value } }));
    } catch {
      // environnement sans CustomEvent (tests Node)
    }
  }
  return value;
}

// Traduction d'un texte normalisé, avec cache.
function translateKey(key) {
  if (cache.has(key)) return cache.get(key);
  let out = null;
  if (!outputs.has(key)) {
    const r = LANGS[getLang()]?.translate?.(key) ?? key;
    if (r !== key) out = r;
  }
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, out);
  if (out !== null) outputs.add(out.replace(/\s+/g, ' ').trim());
  return out;
}

// Traduit une chaîne (dictionnaire exact, puis motifs, sinon l'original) ; les espaces autour sont
// conservés. En français, renvoie le texte tel quel.
export function t(text) {
  if (getLang() === SOURCE_LANG || text === null || text === undefined) return text;
  const s = String(text);
  if (!HAS_TEXT.test(s)) return s;
  const key = s.replace(/\s+/g, ' ').trim();
  const out = translateKey(key);
  if (out === null) return s;
  // « </b> : suite » → « </b>: rest » : pas d'espace avant la ponctuation (anglais, coréen).
  const lead = /^[:;!?]/.test(out) ? '' : s.match(/^\s*/)[0];
  const trail = s.slice(lead.length).match(/\s*$/)[0];
  return `${lead}${out}${trail}`;
}

// --- DOM ------------------------------------------------------------------------------------------

const textOriginal = new WeakMap(); // nœud texte → texte français d'origine
const textApplied = new WeakMap(); // nœud texte → dernier texte écrit par la traduction
const attrOriginal = new WeakMap(); // élément → { attribut: texte français }
const attrApplied = new WeakMap(); // élément → { attribut: dernier texte écrit }

// v9.1.9 : `attr` — pour les attributs, un <canvas> ou un <svg> garde son aria-label / title traduisible
// (seul leur contenu est ignoré).
function skipped(el, attr = false) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName.toUpperCase()) && !(attr && e === el)) return true;
    if (e.hasAttribute('data-no-i18n') || e.getAttribute('translate') === 'no') return true;
  }
  return false;
}

function translateTextNode(node) {
  const value = node.data;
  if (textApplied.get(node) === value) return; // notre propre écriture
  if (!HAS_TEXT.test(value)) return;
  const parent = node.parentElement;
  if (!parent || skipped(parent)) return;
  const out = t(value);
  textOriginal.set(node, value);
  textApplied.set(node, out);
  if (out !== value) node.data = out;
}

function translateAttr(el, name) {
  const value = el.getAttribute(name);
  if (value === null || !HAS_TEXT.test(value)) return;
  const applied = attrApplied.get(el);
  if (applied?.[name] === value) return;
  if (skipped(el, true)) return;
  const out = t(value);
  const orig = attrOriginal.get(el) ?? {};
  orig[name] = value;
  attrOriginal.set(el, orig);
  attrApplied.set(el, { ...applied, [name]: out });
  if (out !== value) el.setAttribute(name, out);
}

function translateElementAttrs(el) {
  for (const name of ATTRS) if (el.hasAttribute(name)) translateAttr(el, name);
}

// Traduit les nœuds texte et les attributs (title, placeholder, aria-label, alt) d'un sous-arbre.
export function translateTree(root) {
  if (!root || getLang() === SOURCE_LANG) return;
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  const doc = root.ownerDocument ?? root;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateTextNode(n);
  if (root.nodeType === 1) translateElementAttrs(root);
  root.querySelectorAll?.('[title],[placeholder],[aria-label],[alt]').forEach(translateElementAttrs);
}

// Remet le français là où la traduction est encore en place (retour à 'fr' ou changement de langue).
function restoreTree(root) {
  if (!root) return;
  const doc = root.ownerDocument ?? root;
  const walker = doc.createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const orig = textOriginal.get(n);
    if (orig !== undefined && n.data === textApplied.get(n)) n.data = orig;
    textApplied.delete(n);
    textOriginal.delete(n);
  }
  const els = [root, ...(root.querySelectorAll?.('[title],[placeholder],[aria-label],[alt]') ?? [])];
  for (const el of els) {
    const orig = attrOriginal.get(el);
    const applied = attrApplied.get(el);
    if (!orig) continue;
    for (const [name, value] of Object.entries(orig)) {
      if (el.getAttribute?.(name) === applied?.[name]) el.setAttribute(name, value);
    }
    attrOriginal.delete(el);
    attrApplied.delete(el);
  }
}

const observed = new Map(); // racine → MutationObserver

function onMutations(records) {
  if (getLang() === SOURCE_LANG) return;
  for (const r of records) {
    if (r.type === 'childList') {
      for (const n of r.addedNodes) {
        if (n.nodeType === 3) translateTextNode(n);
        else if (n.nodeType === 1) translateTree(n);
      }
    } else if (r.type === 'characterData') {
      translateTextNode(r.target);
    } else if (r.type === 'attributes' && r.target.nodeType === 1) {
      translateAttr(r.target, r.attributeName);
    }
  }
}

// Traduit tout l'existant puis tout ce qui est ajouté ou modifié sous `root` (langue autre que le français).
// Renvoie une fonction qui arrête l'observation.
export function startAutoTranslate(root = globalThis.document?.body) {
  if (!root || typeof MutationObserver === 'undefined') return () => {};
  if (!observed.has(root)) {
    const observer = new MutationObserver(onMutations);
    observer.observe(root, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS,
    });
    observed.set(root, observer);
  }
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = getLang();
  translateTree(root);
  return () => {
    observed.get(root)?.disconnect();
    observed.delete(root);
  };
}
