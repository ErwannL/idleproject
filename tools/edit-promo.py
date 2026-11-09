#!/usr/bin/env python3
"""v9.3.1 : vidéos promotionnelles (40 s et 20 s) montées à partir des images filmées par tools/record-trailer.mjs.

  NOENC=1 node tools/record-trailer.mjs --part main --frames DIR ; NOENC=1 WB_SECONDS=20 node tools/record-trailer.mjs --part wb --frames DIR
  python3 tools/edit-promo.py DIR OUT_DIR [40|20|all]

Mouvements de caméra (zoom avant/arrière, panoramiques) au plus proche voisin, transitions variées (xfade),
titres animés, mention « Vidéo promotionnelle ». Pas de spoil : une partie des mondes seulement.
Colosse : la barre et les bandeaux du haut sont hors cadre (recadrage).
"""
import os, subprocess, sys

FRAMES, OUT = sys.argv[1], sys.argv[2]
WHICH = sys.argv[3] if len(sys.argv) > 3 else 'all'
FPS = 60
SECS = [2.8, 3, 2.6, 3.2, 2.6, 2.6, 2.4, 2.6, 3.2, 2.6, 3.6, 3]  # plans de record-trailer.mjs (MOMENTS)
START = [int(sum(SECS[:i]) * FPS) for i in range(len(SECS))]
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
if not os.path.exists(FONT): FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
TMP = os.path.join(FRAMES, 'promo-tmp'); os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)

def ff(args): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *args], check=True)

def esc(s): return s.replace(':', r'\:').replace("'", "’")

def title(text, size, y, t0, t1, color='#ffd76a'):
    a = f"if(lt(t,{t0}),0,if(lt(t,{t0}+0.3),(t-{t0})/0.3,if(lt(t,{t1}-0.3),1,max(0,({t1}-t)/0.3))))"
    return (f"drawtext=fontfile={FONT}:text='{esc(text)}':fontsize={size}:fontcolor={color}:alpha='{a}'"
            f":borderw=5:bordercolor=#1a0d05:shadowx=0:shadowy=6:shadowcolor=black@0.6:x=(w-text_w)/2:y={y}")

def camera(kind, n):
    # Caméra : image agrandie ×2 puis fenêtre 1280×720 qui zoome ou glisse (proche voisin : pixels nets).
    p = f"(on/{max(1, n - 1)})"
    z = {'in': f"1.0+0.18*{p}", 'out': f"1.18-0.18*{p}", 'panL': '1.15', 'panR': '1.15', 'push': f"1.05+0.3*{p}*{p}"}[kind]
    x = {'panL': f"(iw-iw/zoom)*(1-{p})", 'panR': f"(iw-iw/zoom)*{p}"}.get(kind, 'iw/2-iw/zoom/2')
    y = 'ih-ih/zoom'  # caméra calée en bas : là où se battent les personnages
    return f"scale=2560:1440:flags=neighbor,zoompan=z='{z}':x='{x}':y='{y}':d=1:s=1280x720:fps={FPS}"

def clip(name, src, start, n, cam, texts=(), wb=False):
    out = f"{TMP}/{name}.mp4"
    vf = []
    if wb: vf.append('crop=1040:585:120:135,scale=1280:720:flags=neighbor')  # sans la barre du boss
    vf.append(camera(cam, n))
    dur = n / FPS
    vf += [title(t, s, y, a, min(b, dur)) for (t, s, y, a, b) in texts]
    ff(['-framerate', str(FPS), '-start_number', str(start), '-i', f"{FRAMES}/{src}/f%05d.png", '-frames:v', str(n),
        '-vf', ','.join(vf) + ',format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', out])
    return out, dur

def card(name, dur, lines, bg_frame=None):
    out = f"{TMP}/{name}.mp4"
    if bg_frame:
        inp = ['-loop', '1', '-framerate', str(FPS), '-i', bg_frame]
        base = f"scale=1280:720,boxblur=12:2,eq=brightness=-0.25,zoompan=z='1+0.06*on/{int(dur*FPS)}':d=1:s=1280x720:fps={FPS}"
    else:
        inp = ['-f', 'lavfi', '-i', f"color=c=#0b0716:s=1280x720:r={FPS}"]
        base = 'null'
    vf = [base] + [title(t, s, y, a, b, c) for (t, s, y, a, b, c) in lines]
    ff([*inp, '-t', str(dur), '-vf', ','.join(vf) + ',format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', out])
    return out, dur

TRANS = ['fade', 'slideleft', 'circleopen', 'wipeleft', 'smoothleft', 'fadeblack', 'radial', 'slideup', 'zoomin', 'dissolve']

def assemble(parts, out_name, xd=0.35):
    inputs = []; [inputs.extend(['-i', p]) for p, _ in parts]
    chain, off, last = [], 0.0, '[0:v]'
    for i in range(1, len(parts)):
        off += parts[i - 1][1] - xd
        lab = f"[v{i}]"
        chain.append(f"{last}[{i}:v]xfade=transition={TRANS[(i - 1) % len(TRANS)]}:duration={xd}:offset={off:.3f}{lab}")
        last = lab
    fc = ';'.join(chain) + f";{last}fade=t=out:st={off + parts[-1][1] - 0.5:.3f}:d=0.5,format=yuv420p[out]"
    mp4 = f"{OUT}/{out_name}.mp4"
    ff([*inputs, '-filter_complex', fc, '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', mp4])
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout)
    print(f"{mp4} : {d:.1f} s, {os.path.getsize(mp4) / 1048576:.1f} Mo")
    return mp4

def world(i, cam, n=None, texts=()):
    n = n or int(SECS[i] * FPS)
    return clip(f"w{i}-{cam}-{n}", 'main', START[i], n, cam, texts)

def wb(a, b, cam, texts=()):
    return clip(f"wb{a}-{cam}", 'wb', int(a * FPS), int((b - a) * FPS), cam, texts, wb=True)

BG = f"{FRAMES}/wb/f00360.png"
PROMO = 'VIDÉO PROMOTIONNELLE'

if WHICH in ('40', 'all'):
    parts = [
        card('open40', 2.6, [(PROMO, 22, 250, 0.1, 2.6, '#c9b8ff'), ('ASCENDRYA', 96, 300, 0.4, 2.6, '#ffd76a'), ('Un RPG idle en pixel art', 34, 430, 0.9, 2.6, '#ffffff')], BG),
        world(0, 'in', texts=[('DES MONDES À EXPLORER', 54, 70, 0.2, 2.8)]),
        world(1, 'out'),
        world(3, 'panR', texts=[('DES BOSS REDOUTABLES', 54, 70, 0.2, 3.2)]),
        world(4, 'out'),
        world(7, 'push', texts=[('DES COMPÉTENCES DÉVASTATRICES', 54, 70, 0.2, 2.6)]),
        world(8, 'panL', texts=[('DES HÉROS ET DES COMPAGNONS', 54, 70, 0.2, 3.2)]),
        world(10, 'in', texts=[('PLONGEZ DANS L’ABÎME', 54, 70, 0.2, 3.6)]),
        card('colosse40', 1.8, [('MAIS UN GÉANT S’ÉVEILLE…', 56, 320, 0.15, 1.8, '#ff9a5a')], BG),
        wb(1.0, 5.6, 'push', [('LE COLOSSE DES ANCIENS', 64, 600, 0.3, 4.6)]),
        wb(5.8, 9.8, 'panL'),
        wb(10.0, 14.4, 'in', [('UNISSEZ VOS FORCES', 56, 600, 0.3, 4.4)]),
        wb(15.6, 19.9, 'out'),
        card('end40', 3.6, [('ASCENDRYA', 104, 230, 0.1, 3.6, '#ffd76a'), ('PRÉINSCRIPTIONS OUVERTES', 40, 380, 0.5, 3.6, '#ffffff'),
                            ('Bientôt sur PC et Android', 32, 440, 0.8, 3.6, '#c9b8ff'), (PROMO, 20, 640, 0.8, 3.6, '#8f86b0')], BG),
    ]
    assemble(parts, 'ascendrya-promo-40s')

if WHICH in ('20', 'all'):
    parts = [
        card('open20', 1.6, [(PROMO, 20, 260, 0.05, 1.6, '#c9b8ff'), ('ASCENDRYA', 92, 300, 0.2, 1.6, '#ffd76a')], BG),
        world(3, 'panR', n=150, texts=[('DES MONDES À EXPLORER', 52, 70, 0.1, 2)]),
        world(7, 'push', n=150, texts=[('DES COMPÉTENCES DÉVASTATRICES', 52, 70, 0.1, 2)]),
        world(8, 'in', n=150),
        world(10, 'panL', n=150),
        wb(1.0, 5.0, 'push', [('LE COLOSSE DES ANCIENS', 60, 600, 0.2, 4.0)]),
        wb(10.0, 13.4, 'in', [('UNISSEZ VOS FORCES', 54, 600, 0.2, 3.4)]),
        card('end20', 3.0, [('ASCENDRYA', 100, 240, 0.05, 3, '#ffd76a'), ('PRÉINSCRIPTIONS OUVERTES', 38, 390, 0.3, 3, '#ffffff'),
                            ('Bientôt sur PC et Android', 30, 448, 0.5, 3, '#c9b8ff'), (PROMO, 20, 640, 0.5, 3, '#8f86b0')], BG),
    ]
    assemble(parts, 'ascendrya-promo-20s')

if WHICH in ('reel', 'all'):
    # Bandeau du site (fond muet en boucle) : mondes et Colosse sans texte, quelques mondes seulement (pas de spoil).
    parts = [world(0, 'in', n=150), world(3, 'panR', n=150), world(7, 'push', n=150), world(8, 'panL', n=150), world(10, 'in', n=150),
             wb(1.0, 4.0, 'push'), wb(10.0, 13.0, 'out')]
    assemble(parts, 'ascendrya-reel')
