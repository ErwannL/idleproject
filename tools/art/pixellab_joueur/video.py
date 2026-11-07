# v9.2.8 : vidéo 1280x720 à 60 i/s, avant / après, à partir des rendus (render.mjs) de plusieurs apparences.
# Usage : python3 -I video.py out.mp4 b_knight.out.json:Chevalier b_witch.out.json:Sorcière ...
import base64, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
FS = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
CW, CH, X0, Y0, S = 84, 80, 24, 14, 3
looks = []
ORDER = ['walk', 'knight', 'berserker', 'paladin', 'lancer', 'assassin', 'necromancer', 'archer', 'crossbowman', 'pyromancer', 'stormcaller', 'raise_staff']
FR = {'walk': 'marche', 'knight': 'attaque Chevalier', 'berserker': 'attaque Berserker', 'paladin': 'attaque Paladin', 'lancer': 'attaque Lancier', 'assassin': 'attaque Assassin', 'necromancer': 'attaque Nécromancien', 'archer': 'tir Archer', 'crossbowman': 'tir Arbalétrier', 'pyromancer': 'sort Pyromancien', 'stormcaller': 'sort Foudroyant', 'raise_staff': 'geste Météore'}
RF = {'common': 'Commun', 'rare': 'Rare', 'epic': 'Épique', 'legendary': 'Légendaire'}
for a in sys.argv[2:]:
    f, name = a.split(':')
    rows = {}
    for e in json.load(open(f)):
        im = Image.frombytes('RGBA', (e['w'], e['h']), base64.b64decode(e['rgba'])).crop((X0, Y0, X0 + CW, Y0 + CH)).resize((CW * S, CH * S), 0)
        rows.setdefault(e['id'], []).append(im)
    ids = list(rows)
    al = {ids[i].split()[1]: (ids[i], rows[ids[i]], rows[ids[i + 1]]) for i in range(0, len(ids), 2)}
    looks.append((name, [al[c] for c in ORDER if c in al]))
n_anim = len(looks[0][1])
per_anim = 150  # 2,5 s par animation
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1280x720', '-r', '60', '-i', '-',
                       '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', sys.argv[1]], stdin=subprocess.PIPE)
cols = min(2, len(looks)); rws = (len(looks) + 1) // 2
pw, ph = 1280 // cols, 720 // rws
for a in range(n_anim):
    for t in range(per_anim):
        fr = Image.new('RGB', (1280, 720), (36, 40, 54)); d = ImageDraw.Draw(fr)
        for li, (name, anims) in enumerate(looks):
            label, old, new = anims[a]
            px, py = (li % cols) * pw, (li // cols) * ph
            d.rectangle([px + 4, py + 4, px + pw - 4, py + ph - 4], outline=(70, 76, 96))
            d.text((px + 14, py + 10), f'{name} — {FR[label.split()[1]]} · {label.split("(")[1].split(",")[0]} {RF[label.split(", ")[1][:-1]]}', font=F, fill=(240, 236, 220))
            fps = 12
            k = int(t / 60 * fps)
            for j, (seq, tag) in enumerate(((old, 'avant (jeu actuel)'), (new, 'après (perso du joueur)'))):
                im = seq[k % len(seq)]
                x = px + 20 + j * (CW * S + 30); y = py + 40 + (ph - 50 - CH * S) // 2
                d.rectangle([x, y + CH * S - 3 * 9, x + CW * S, y + CH * S - 3 * 9], fill=(90, 96, 80))  # ligne du sol
                fr.paste(im, (x, y), im)
                d.text((x + 6, py + ph - 30), tag, font=FS, fill=(200, 200, 210))
        ff.stdin.write(fr.tobytes())
ff.stdin.close(); ff.wait()
print('ok', sys.argv[1])
