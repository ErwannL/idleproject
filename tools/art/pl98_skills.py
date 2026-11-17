"""v9.8 (F4) : une icône propre à chaque compétence de classe du héros (20) et aux 4 communes de chaque classe (40),
couleur de l'élément de la classe. Sorties : assets/ui/skills98/<id>.png (40 px). Usage : python3 tools/art/pl98_skills.py"""
import os, sys, json, subprocess
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import call, wait, images_of
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'ui', 'skills98')
COLOR = {'knight': 'blue and silver', 'archer': 'green', 'pyromancer': 'orange fire', 'berserker': 'crimson red', 'lancer': 'cyan water', 'paladin': 'gold holy light',
         'assassin': 'violet shadow', 'crossbowman': 'teal and bronze', 'stormcaller': 'electric blue lightning', 'necromancer': 'sickly green and purple'}
def jobs():
    js = subprocess.run(['node', '-e', """import('./src/data/skills.js').then(m=>{const out=[];for(const s of m.SKILLS.filter(x=>x.cls))out.push([s.id,s.cls,s.name,s.type]);for(const [c,n] of Object.entries(m.CLASS_COMMON_NAMES))['quick','whirl','cry','holy'].forEach((id,i)=>out.push([`${c}_${id}`,c,n[i],['hit','aoe','buff','holy'][i]]));console.log(JSON.stringify(out))})"""], cwd=ROOT, capture_output=True, text=True).stdout
    return json.loads(js)
KIND = {'hit': 'single strike', 'aoe': 'area burst', 'buff': 'empowering aura', 'holy': 'radiant healing strike'}
def gen(j):
    sid, cls, name, typ = j
    path = os.path.join(OUT, f'{sid}.png')
    if os.path.exists(path): return f'{sid} déjà là'
    try:
        body = {'description': f'fantasy RPG skill icon "{name}", {KIND.get(typ, "")}, {COLOR[cls]} color theme, bold symbol, square icon with dark frame, crisp pixel art', 'image_size': {'width': 40, 'height': 40}, 'seed': 5,
                'outline': 'single color outline', 'shading': 'medium shading', 'detail': 'medium detail'}
        images_of(wait(call('POST', '/create-image-pixflux', body)))[0].save(path); return f'{sid} ok'
    except Exception as e: return f'{sid} ERREUR {str(e)[:120]}'  # noqa: BLE001
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with ThreadPoolExecutor(6) as ex:
        for m in ex.map(gen, jobs()): print(m, flush=True)
