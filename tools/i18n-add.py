# Ajoute des chaînes exactes à EXACT_971 (en, ko). Usage : python3 tools/i18n-add.py fichier.json
# JSON : { "texte fr": ["english", "한국어"], ... } — ignore les clés déjà présentes.
import json, sys
d = json.load(open(sys.argv[1]))
for i, p in enumerate(('src/i18n/en-971.js', 'src/i18n/ko-971.js')):
    s = open(p).read()
    add = ''.join(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v[i], ensure_ascii=False)},\n' for k, v in d.items() if json.dumps(k, ensure_ascii=False) + ':' not in s)
    s = s.replace('export const EXACT_971 = {\n', 'export const EXACT_971 = {\n' + add, 1)
    open(p, 'w').write(s)
