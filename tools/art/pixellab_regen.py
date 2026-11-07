"""v9.2.9 : régénération (PixelLab, animate-pixminimax) d'une attaque du héros dont la main de frappe n'était pas la
main de prise (arme tenue dans la main d'avant au repos, coup porté de la main arrière). La vue de repos (f0 de
l'animation d'origine, arme comprise) sert de première et de dernière image ; le texte impose la main d'avant.
Clé lue dans PIXELLAB_API_KEY (jamais affichée). Les images vont dans <sortie>/f0..f8.png, puis pixellab_allies.py.

Usage : python3 tools/art/pixellab_regen.py <dossier source anim_allies> <sortie> "<geste>" [graine]
"""
import base64
import io
import json
import os
import sys
import time
import urllib.request

from PIL import Image

API = 'https://api.pixellab.ai/v2'


def _call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None)
    req.add_header('Authorization', 'Bearer ' + os.environ['PIXELLAB_API_KEY'])
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def _b64(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode()}


def regen(src, out, motion, seed=0):
    f0 = Image.open(os.path.join(src, 'f0.png')).convert('RGBA')
    job = _call('POST', '/animate-pixminimax', {
        'first_frame': _b64(f0), 'last_frame': _b64(f0), 'frame_count': 8, 'seed': seed, 'no_background': True,
        'description': motion, 'direction': 'east', 'view': 'side',
        'initial_pose': 'standing, weapon held in the front hand (the hand nearest the camera)'})
    jid = job['background_job_id']
    for _ in range(120):
        time.sleep(4)
        r = _call('GET', f'/background-jobs/{jid}')
        if r.get('status') == 'completed':
            imgs = r['last_response']['images']
            os.makedirs(out, exist_ok=True)
            for i, im in enumerate(imgs[:9]):
                data = base64.b64decode(im['base64'] if isinstance(im, dict) else im)
                Image.open(io.BytesIO(data)).convert('RGBA').resize(f0.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
            return len(imgs)
        if r.get('status') == 'failed':
            raise RuntimeError(str(r)[:300])
    raise TimeoutError(jid)


if __name__ == '__main__':
    print(regen(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 0))
