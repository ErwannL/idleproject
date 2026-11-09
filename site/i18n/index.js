// Langues du site. Ajouter une langue : créer site/i18n/<code>.js (mêmes clés que en.js), puis l'ajouter à LANGS.
// Prévues : ja (日本語), ko (한국어), zh (简体中文) — une clé absente retombe sur l'anglais.
export const LANGS = [
  { code: 'en', label: 'EN', name: 'English', hreflang: 'en' },
  { code: 'fr', label: 'FR', name: 'Français', hreflang: 'fr' },
  // { code: 'ja', label: 'JP', name: '日本語', hreflang: 'ja' },
  // { code: 'ko', label: 'KR', name: '한국어', hreflang: 'ko' },
  // { code: 'zh', label: 'ZH', name: '简体中文', hreflang: 'zh-Hans' },
];
export const DEFAULT_LANG = 'en';
export const loadLang = async (code) => (await import(`./${code}.js`)).default;
