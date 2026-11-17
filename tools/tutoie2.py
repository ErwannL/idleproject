# v9.8 : impératifs et futurs au vouvoiement → tutoiement (mot entier), partout dans src/ (clés de traduction comprises).
import pathlib, re
V = {'terminez':'termine','quittez':'quitte','vainquez':'vaincs','touchez':'touche','atteignez':'atteins','réessayez':'réessaie',
 'renforcez':'renforce','recyclez':'recycle','mettez':'mets','gagnerez':'gagneras','appuyez':'appuie','réaffrontez':'réaffronte',
 'cliquez':'clique','visez':'vise','tapez':'tape','retirez':'retire','reprenez':'reprends','rendez':'rends','rangez':'range',
 'jouez':'joue','choisissez':'choisis','changez':'change','bougiez':'bouges','améliorez':'améliore','ajoutez':'ajoute',
 'abandonnez':'abandonne','suivez':'suis','revenez':'reviens','relancez':'relance','rejoignez':'rejoins','recommencez':'recommence',
 'rachetez':'rachète','portez':'porte','gardez':'garde','créez':'crée','collez':'colle','apprenez':'apprends'}
rx = re.compile(r'\b(' + '|'.join(sorted(V, key=len, reverse=True)) + r')\b', re.I)
def rep(m):
    w = m.group(0); t = V[w.lower()]
    return t[0].upper() + t[1:] if w[0].isupper() else t
n = 0
for p in [*pathlib.Path('src').rglob('*.js'), *pathlib.Path('tests').rglob('*.js')]:
    s = p.read_text(); o = rx.sub(rep, s)
    if o != s: p.write_text(o); n += 1
print(n)
