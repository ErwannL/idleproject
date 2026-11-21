"""v10.7 (partie 6 bis) : illustrations des héros jouables fidèles au sprite de combat (PixelLab, méthode de pl10_fiches.py).
Référence = le sprite de repos tel que le combat le dessine (tools/art/dump_skin_refs.mjs → pixellab107/skins/ref_<id>.png).
Génération image-vers-image (/create-image-pixflux : image de départ = la référence agrandie, même pose), puis palette
verrouillée sur celle du sprite, fond retiré, recadrage + 4 %, ×3 exact à l'installation. Modèle de style : l'Archange.
Les 5 peintures réalistes (assets/hd/real) sont remplacées ; les 6 héros de base gagnent l'arme de leur classe.

  python3 -I tools/art/pl107_skins.py gen [id …]   → tools/art/pixellab107/skins/<id>.png
  python3 -I tools/art/pl107_skins.py install       → assets/hd/px/<clé>.webp et thumb/<clé>.webp
  python3 -I tools/art/pl107_skins.py check [sortie] → contrôle des teintes (écart < 15°) et planche docs/screenshots/v10.7/skins.png
Clé : PIXELLAB_API_KEY (jamais affichée ni écrite).
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DIR = os.path.join(HERE, 'pixellab107', 'skins')
PX = os.path.join(ROOT, 'assets', 'hd', 'px')
STYLE = ', holding the weapon clearly in hand, chibi proportions exactly like the reference sprite, same colors as the reference, more detailed pixel art illustration, full body, soft light, transparent background'
SKINS = {
    'fairy': ('fairy', 'a small cheerful flower fairy with pink hair, leaf dress and translucent wings, holding a glowing wand'),
    'valkyrie': ('valkyrie', 'a young blonde valkyrie with a winged silver helmet, white and blue armor, feathered wings and a spear'),
    'demoness': ('demoness', 'a playful demon girl with small horns, dark purple hair, red and black outfit, bat wings, a curved scythe, not sexualized'),
    'seraph': ('seraph', 'a radiant angel with pink hair, a golden halo, white and gold robe, large white wings, holding a holy sword'),
    'grombar': ('grombar', 'a sturdy dwarf king with a braided orange beard, golden crown, heavy fur cloak and a big war hammer'),
    'knight': ('hero_knight', 'a knight with a sword and a shield, blue cape and blue plume'),
    'paladin': ('hero_paladin', 'a paladin knight with a holy war hammer and a golden shield, a faint halo, cream plume'),
    'guardian': ('hero_guardian', 'a heavy guardian knight with a huge tower shield and thick heavy armor, green cape and green plume'),
    'fortune_knight': ('hero_fortune_knight', 'a fortune knight with a slim rapier and a golden coin purse, a few gold coins flying, white plume'),
    'berserker': ('hero_berserker', 'a berserker knight swinging a big two-handed battle axe, no shield, fur shoulder pads, wild red plume'),
    'dragon_knight': ('hero_dragon_knight', 'a dragon knight with a long lance, scaled armor and a tiny dragon perched on the shoulder, orange plume'),
}


def ref(sid):
    im = Image.open(os.path.join(DIR, f'ref_{sid}.png')).convert('RGBA')
    return im.crop(im.getbbox())


def gen_one(sid):
    from pl939_api import b64, call, images_of, wait
    import pl10_fiches as F
    size = (224, 256)
    init = F.fit(ref(sid), size)
    body = {'description': f'the same character as the reference: {SKINS[sid][1]}' + STYLE, 'image_size': {'width': size[0], 'height': size[1]},
            'no_background': True, 'seed': 107, 'init_image': b64(init), 'init_image_strength': 560 if SKINS[sid][0][:5] != 'hero_' else int(os.environ.get('HERO_STRENGTH', 260)),
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed', 'view': 'side', 'direction': 'east'}
    try:
        im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        im.save(os.path.join(DIR, f'{sid}.png'))
        return f'{sid} ok'
    except Exception as e:  # noqa: BLE001
        return f'{sid} ERREUR {str(e)[:200]}'


def install():
    import pl10_fiches as F
    for sid, (key, _) in SKINS.items():
        src = os.path.join(DIR, f'{sid}.png')
        if not os.path.exists(src):
            continue
        im = F.pad4(F.lock_palette(F.strip_bg(Image.open(src)), ref(sid)))
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(PX, f'{key}.webp'), 'WEBP', lossless=True)
        im.save(os.path.join(PX, 'thumb', f'{key}.webp'), 'WEBP', lossless=True)
        print(sid, '→', key)


def check(out):
    import check_fidelity as CF
    rows, bad = [], []
    for sid, (key, _) in SKINS.items():
        r = ref(sid)
        f = CF.load(os.path.join(PX, f'{key}.webp'))
        g = CF.hue_gap(CF.dominant(r), CF.dominant(f, n=24, share=0.01)) if f else 999
        if g >= 15:
            bad.append(f'{sid} : écart de teinte {g:.0f}°')
        rows.append((sid, r, f, g))
    for sid in ('witch', 'vampire', 'ninja'):  # déjà fidèles (style du jeu), montrés sur la planche
        rows.append((sid, ref(sid), CF.load(os.path.join(PX, f'{sid}.webp')), 0))
    H, W = 260, 420
    sheet = Image.new('RGBA', (W * 7, (H + 40) * 2), (40, 28, 48, 255))
    d = ImageDraw.Draw(sheet)
    for i, (sid, r, f, g) in enumerate(rows):
        x0, y0 = (i % 7) * W, (i // 7) * (H + 40)
        if f is not None:
            k = H / f.height; fi = f.resize((max(1, int(f.width * k)), H), Image.NEAREST); sheet.alpha_composite(fi, (x0 + 10, y0 + 30))
        k = max(1, 140 // r.height); ri = r.resize((r.width * k, r.height * k), Image.NEAREST); sheet.alpha_composite(ri, (x0 + W - ri.width - 10, y0 + 30 + H - ri.height))
        d.text((x0 + 10, y0 + 8), f'{sid} · {g:.0f}°', fill=(120, 230, 120) if g < 15 else (255, 120, 120))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    print('\n'.join(bad) if bad else 'Les 14 skins sont fidèles à leur sprite de combat (teintes).')
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if cmd == 'gen':
        ids = sys.argv[2:] or list(SKINS)
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(gen_one, ids):
                print(m, flush=True)
    elif cmd == 'install':
        install()
    else:
        sys.exit(check(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs', 'screenshots', 'v10.7', 'skins.png')))
