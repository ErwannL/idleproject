"""v10.4 (plan 10.4, partie 5) : images du coffre de butin animé, avec PixelLab (API v2, clé dans PIXELLAB_API_KEY, jamais
affichée ni écrite).

  python3 -I tools/art/pl104_chest.py balance      générations restantes
  python3 -I tools/art/pl104_chest.py prep         images d'entrée (coffre fermé / ouvert de art102 réduits à 64 px d'art)
  python3 -I tools/art/pl104_chest.py lid [graine] ouverture du couvercle (/animate-pixminimax : première image = coffre
                                                   fermé, dernière = coffre grand ouvert sur son or) → raw/lid_<graine>/f*.png
  python3 -I tools/art/pl104_chest.py build <graine>  garde les images retenues → assets/ui/art104/loot_chest_lid_N.png
Sources brutes et prompts : tools/art/pixellab104/chest/.
"""
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab104', 'chest')
OUT = os.path.join(ROOT, 'assets', 'ui', 'art104')
ART = os.path.join(ROOT, 'assets', 'ui', 'art102')
API = 'https://api.pixellab.ai/v2'
CROP = (8, 10, 120, 120)  # zone utile des images 128 px (pixels doubles) : 56 x 55 pixels d'art
PROMPT = ('wooden treasure chest with gold bands, seen from the front, the lid slowly swings open on its back hinge, '
          'revealing a heap of gold coins that glows, then the lid rests fully open')


def req(method, path, body=None):
    r = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                               headers={'Authorization': 'Bearer ' + os.environ['PIXELLAB_API_KEY'], 'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code} {e.read()[:300].decode(errors="replace")}')


def balance():
    return req('GET', '/balance')['subscription']['generations']


def b64(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def native(name):
    """Image d'art102 rognée et ramenée à 1 pixel d'écran par pixel d'art (56 x 55), posée sur un canvas 64 x 64."""
    im = Image.open(os.path.join(ART, name)).convert('RGBA').crop(CROP)
    im = im.resize((im.width // 2, im.height // 2), Image.NEAREST)
    cv = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    cv.paste(im, (4, 8), im)
    return cv


def prep():
    os.makedirs(RAW, exist_ok=True)
    native('loot_chest.png').save(os.path.join(RAW, 'in_closed.png'))
    native('loot_chest_open.png').save(os.path.join(RAW, 'in_open.png'))


def lid(seed=1, n=int(os.environ.get('CHEST_N', 8))):
    prep()
    a = Image.open(os.path.join(RAW, 'in_closed.png'))
    z = Image.open(os.path.join(RAW, 'in_open.png'))
    body = {'first_frame': b64(a), 'frame_count': n, 'seed': seed, 'no_background': True,
            'description': PROMPT, 'direction': 'south', 'view': 'low top-down'}
    json.dump({k: v for k, v in body.items() if k not in ('first_frame', 'last_frame')}, open(os.path.join(RAW, f'prompt_{seed}.json'), 'w'), indent=1)
    j = req('POST', '/animate-pixminimax', body)
    jid = j['background_job_id']
    for _ in range(120):
        time.sleep(5)
        s = req('GET', f'/background-jobs/{jid}')
        if s.get('status') == 'completed':
            out = os.path.join(RAW, f'lid_{seed}')
            os.makedirs(out, exist_ok=True)
            for i, im in enumerate(s['last_response']['images']):
                data = base64.b64decode(im['base64'] if isinstance(im, dict) else im)
                Image.open(io.BytesIO(data)).convert('RGBA').save(os.path.join(out, f'f{i}.png'))
            print('images', len(s['last_response']['images']), 'usage', s.get('usage'))
            return
        if s.get('status') == 'failed':
            raise RuntimeError(str(s)[:300])
    raise TimeoutError(jid)


def build(seed, keep=6):
    """Garde les `keep` premières images (les suivantes ne bougent plus) : 64 x 64 pixels d'art, pieds sur la dernière
    ligne ; le moteur les agrandit par un multiple entier (src/render/loot-chest.js)."""
    src = os.path.join(RAW, f'lid_{seed}')
    os.makedirs(OUT, exist_ok=True)
    for i in range(keep):
        Image.open(os.path.join(src, f'f{i}.png')).convert('RGBA').save(os.path.join(OUT, f'loot_chest_lid_{i}.png'))
    print(keep, 'images')


if __name__ == '__main__':
    c = sys.argv[1] if len(sys.argv) > 1 else 'balance'
    if c == 'balance':
        print(balance())
    elif c == 'prep':
        prep()
    elif c == 'lid':
        lid(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
    elif c == 'build':
        build(sys.argv[2])
