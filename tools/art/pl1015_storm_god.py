"""v10.15.0 : animations PixelLab du Dieu de l'Orage (storm_god), à partir de sa pose de repos validée.

  python3 -I tools/art/pl1015_storm_god.py rest3 [graine]        forme de colère (phase 3) → pixellab1015/storm_god/rest3_<graine>.png
  python3 -I tools/art/pl1015_storm_god.py gen <anim> [graine…]  essais → pixellab1015/storm_god/try/<anim>_<graine>/f0..fN.png
  python3 -I tools/art/pl1015_storm_god.py pick <anim> <graine>  retient un essai → pixellab1015/storm_god/<anim>/f0..f(n-1).png
  python3 -I tools/art/pl1015_storm_god.py install               planches → assets/world-boss/storm_god/storm_god_<anim>.png

/animate-pixminimax rend frame_count+1 images (la 0 est l'image d'entrée) ; frame_count est un multiple de 4.
Pas de dessin Pillow : seulement du recadrage, de l'assemblage et du plus-proche-voisin. Clé : PIXELLAB_API_KEY, jamais affichée.
"""
import os
import shutil
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pl1015_giants as G  # noqa: E402

GID = 'storm_god'
RAW = os.path.join(G.RAW, GID)
FRAME = 160
SIZE = 136  # contenu des images (85 %)
SHIFT = 10  # décalage à gauche : le corps est à droite de l'image, le marteau à gauche
SUBJ = 'a giant bronze-armored thunder god with a cloud beard holding a huge war hammer'

# nom: (images, ref, image de fin, description du mouvement)
ANIMS = {
    'idle': (8, 'rest', 'rest', 'breathing deeply, chest rising and falling, the cloud beard and hair drifting in the wind, shoulders heaving, the hammer swaying slightly, lightning crackling and flickering around his arms'),
    'attack': (9, 'rest', 'rest', 'crouching back and winding the hammer up over his right shoulder, then a violent powerful overhead hammer smash downward and forward to the left, body lunging with the blow, then holding the pose and slowly recovering'),
    'hurt': (6, 'rest', 'rest', 'flinching and staggering back to the right with his head thrown back and arms flung out, then regaining balance'),
    'throw': (13, 'rest', 'rest', 'leaning far back and raising the hammer high above his head with both hands while lightning gathers on it, then hurling the hammer forward to the left with a huge body twist and throwing arm extended, then arm held out and slowly returning to standing'),
    'beam': (13, 'rest', 'rest', 'throwing his head back and spreading his arms wide, crackling with lightning, then lowering his head and glaring forward to the left with eyes blazing while his body trembles and leans forward, head sweeping slightly downward, then straightening up'),
    'death': (13, 'rest', None, 'staggering, dropping the hammer, falling to his knees, then collapsing heavily forward onto the ground and lying motionless, dust'),
    'idle3': (8, 'rest3', 'rest3', 'enraged breathing, shoulders heaving heavily, beard and hair whipping violently, lightning arcing wildly around him, leaning forward aggressively'),
    'attack3': (9, 'rest3', 'rest3', 'crouching back and winding the hammer up behind him, then a ferocious overhead hammer smash downward and forward to the left with a lunge, then holding the pose and recovering'),
    'throw3': (13, 'rest3', 'rest3', 'leaning far back and raising the hammer high above his head with both hands while lightning gathers on it, then hurling the hammer forward to the left with a huge body twist, then slowly returning to standing'),
    'beam3': (13, 'rest3', 'rest3', 'throwing his head back and spreading his arms wide, crackling with lightning, then lowering his head and glaring forward to the left with eyes blazing while his body trembles and leans forward, head sweeping slightly downward, then straightening up'),
    'quake': (9, 'rest', 'rest', 'raising the hammer high above his head with both hands, then slamming the hammer into the ground in front of him with a huge heavy blow, the whole body crashing down, then holding, then slowly lifting the hammer back'),
    'embers': (9, 'rest', 'rest', 'tilting his head and raising both arms and the hammer up toward the sky, roaring at the sky with his chest thrown out, lightning rising around him, then lowering again'),
    'transform': (13, 'rest', 'rest3', 'hunching over and clenching his fists, trembling, then roaring upward as he straightens, arms spread, power surging through his body and lightning exploding around him, then settling in an aggressive stance'),
}


def ref_img(name):
    return Image.open(os.path.join(RAW, f'{name}.png')).convert('RGBA')


def one(task):
    from pl939_api import b64, call, to_img, wait
    name, seed = task
    n, ref, last, desc = ANIMS[name]
    first = ref_img(ref)
    body = {'first_frame': b64(first), 'frame_count': 4 * -(-(n - 1) // 4), 'seed': seed, 'no_background': True,
            'description': desc, 'direction': 'west', 'view': 'side', 'subject_description': SUBJ}
    if last:
        body['last_frame'] = b64(ref_img(last))
    for essai in range(6):
        try:
            imgs = wait(call('POST', '/animate-pixminimax', body))['images']
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 5:
                return f'{name}@{seed} ERREUR HTTP {e.code}'
            time.sleep(15 * (essai + 1))
        except Exception as e:  # noqa: BLE001
            return f'{name}@{seed} ERREUR {str(e)[:200]}'
    out = os.path.join(RAW, 'try', f'{name}_{seed}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).resize(first.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return f'{name}@{seed} ok {len(imgs)} images'


def rest3(seed):
    from pl939_api import b64, call, images_of, wait
    body = {'method': 'edit_with_text', 'edit_images': [{'image': b64(ref_img('rest')), 'width': FRAME, 'height': FRAME}],
            'image_size': {'width': FRAME, 'height': FRAME}, 'seed': seed, 'no_background': True,
            'description': 'same giant thunder god in the same pose, but in a furious storm form: bright glowing white eyes, bronze armor glowing orange-hot with golden runes, '
                           'many thick bright white and yellow lightning bolts crackling all around his whole body and hammer, cloud beard turned dark thundercloud grey, more menacing'}
    im = images_of(wait(call('POST', '/edit-images-v2', body)))[0]
    im.save(os.path.join(RAW, f'rest3_{seed}.png'))
    print('rest3', seed, im.size)


def pick(name, seed):
    n = ANIMS[name][0]
    src = os.path.join(RAW, 'try', f'{name}_{seed}')
    out = os.path.join(RAW, name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    avail = len([f for f in os.listdir(src) if f.endswith('.png')])
    # n images sur avail : les n premières ; hurt (6 sur 9) : on étale
    idx = list(range(n)) if avail - n < 2 or name != 'hurt' else [0, 1, 2, 4, 6, 8]
    for k, i in enumerate(idx):
        shutil.copy(os.path.join(src, f'f{i}.png'), os.path.join(out, f'f{k}.png'))
    print(name, 'retenu', seed, idx)


def install():
    for name, (n, *_r) in ANIMS.items():
        d = os.path.join(RAW, name)
        if not os.path.isdir(d):
            continue
        sheet = Image.new('RGBA', (FRAME * n, FRAME))
        dy = None
        for i in range(n):
            f = Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA')
            if dy is None:  # même décalage pour toute la planche : pieds de l'image 0 sur la ligne FRAME-6
                bb = f.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
                dy = bb[3] - (FRAME - 6) if bb else 0
            f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), Image.NEAREST)
            # taille : même ordre que le Colosse (il serait 23 % plus haut et sortirait du cadre en phase 3) ;
            # réduction au plus proche voisin, centrée, pieds sur la ligne FRAME-6
            sc = f.resize((SIZE, SIZE), Image.NEAREST)
            f = Image.new('RGBA', f.size)
            f.paste(sc, ((FRAME - SIZE) // 2 - SHIFT, (FRAME - 6) - round((FRAME - 6) * SIZE / FRAME)))
            sheet.paste(f, (i * FRAME, 0))
        out = os.path.join(G.DST, GID)
        os.makedirs(out, exist_ok=True)
        sheet.save(os.path.join(out, f'{GID}_{name}.png'), optimize=True)
        print(name, n)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'rest3':
        rest3(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
    elif cmd == 'gen':
        name = sys.argv[2]
        seeds = [int(s) for s in sys.argv[3:]] or [3]
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(one, [(name, s) for s in seeds]):
                print(m, flush=True)
    elif cmd == 'genmany':  # genmany anim@seed anim@seed …
        tasks = [(a.split('@')[0], int(a.split('@')[1])) for a in sys.argv[2:]]
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(one, tasks):
                print(m, flush=True)
    elif cmd == 'pick':
        pick(sys.argv[2], int(sys.argv[3]))
    elif cmd == 'install':
        install()
