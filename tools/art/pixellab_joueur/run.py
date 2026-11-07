# v9.2.8 : anime les personnages SANS ARME du compte PixelLab du joueur (/animate-character, mode pixminimax, est).
# Usage : python3 -I run.py jobs.json   job : {name, cid, act, n?, end?(bool), seed?}
import base64, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
H = 'https://api.pixellab.ai/v2'; K = os.environ['PIXELLAB_API_KEY']
W = os.environ.get('PL_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))  # hors dépôt de préférence
ROT = os.environ.get('PL_ROT', os.path.join(W, 'rot'))  # rotations téléchargées : <id>/Idle/rotations/east.png (export ZIP)


def req(m, p, body=None):
    r = urllib.request.Request(H + p, method=m, data=json.dumps(body).encode() if body else None,
                               headers={'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'})
    err = None
    for a in range(5):
        try:
            with urllib.request.urlopen(r, timeout=120) as f: return json.load(f)
        except urllib.error.HTTPError as e:
            msg = e.read()[:400].decode(errors='replace')
            if e.code in (429, 500, 502, 503): time.sleep(15 * (a + 1)); continue
            raise RuntimeError(f'HTTP {e.code} {msg}')
        except Exception as e: err = e; time.sleep(10)
    raise RuntimeError(f'reseau {err}')


def b64(p): return {'type': 'base64', 'base64': base64.b64encode(open(p, 'rb').read()).decode(), 'format': 'png'}


def one(j):
    out = f"{W}/raw/{j['name']}"
    if os.path.exists(out + '/f0.png'): return j['name'], 'deja', 0
    east = f"{ROT}/{j['cid']}/Idle/rotations/east.png"
    body = {'character_id': j['cid'], 'mode': 'pixminimax', 'directions': ['east'], 'action_description': j['act'],
            'frame_count': j.get('n', 8), 'animation_name': j['name']}
    if j.get('end', True): body['end_frame'] = b64(east)
    try:
        r = req('POST', '/animate-character', body); jid = r['background_job_ids'][0]
        while True:
            time.sleep(6); s = req('GET', '/background-jobs/' + jid)
            if s['status'] not in ('processing', 'pending', 'queued'): break
    except Exception as e: return j['name'], 'erreur ' + str(e)[:300], 0
    g = (s.get('usage') or {}).get('generations', 0)
    with open(W + '/ledger.txt', 'a') as f: f.write(f"{j['name']} {s['status']} {g}\n")
    if s['status'] != 'completed': return j['name'], 'echec ' + str(s)[:300], g
    lr = s.get('last_response') or {}
    ims = lr.get('images') or []
    if not ims:
        json.dump(s, open(f"{W}/raw_{j['name']}.json", 'w')); return j['name'], 'sans images ' + str(list(lr))[:200], g
    os.makedirs(out, exist_ok=True)
    for i, im in enumerate(ims):
        open(f'{out}/f{i}.png', 'wb').write(base64.b64decode(im['base64'].split(',')[-1]))
    fr = [Image.open(f'{out}/f{i}.png').convert('RGBA') for i in range(len(ims))]
    w, h = fr[0].size; sh = Image.new('RGBA', (len(fr) * w * 3, h * 3), (60, 60, 80, 255))
    for i, m in enumerate(fr): sh.alpha_composite(m.resize((w * 3, h * 3), 0), (i * w * 3, 0))
    os.makedirs(W + '/sheets', exist_ok=True); sh.save(f"{W}/sheets/{j['name']}.png")
    return j['name'], 'ok', g


if __name__ == '__main__':
    jobs = json.load(open(sys.argv[1]))
    os.makedirs(W, exist_ok=True)
    with ThreadPoolExecutor(8) as ex:
        for n, st, g in ex.map(one, jobs): print(n, st, g, flush=True)
