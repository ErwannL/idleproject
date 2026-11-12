"""v9.4.0 : appels PixelLab (clé PIXELLAB_API_KEY, jamais affichée) pour le lot « refaire-v2.3.7 »."""
import base64, io, json, os, time, urllib.request
from PIL import Image

API = 'https://api.pixellab.ai/v2'


def call(method, path, body=None, timeout=300):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None)
    req.add_header('Authorization', 'Bearer ' + os.environ['PIXELLAB_API_KEY'])
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def b64(img):
    buf = io.BytesIO(); img.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode()}


def to_img(x):
    data = x['base64'] if isinstance(x, dict) else x
    return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGBA')


def wait(job, tries=150):
    jid = job.get('background_job_id') or job.get('job_id')
    if not jid:
        return job
    for _ in range(tries):
        time.sleep(4)
        r = call('GET', f'/background-jobs/{jid}')
        if r.get('status') == 'completed':
            return r.get('last_response') or r
        if r.get('status') == 'failed':
            raise RuntimeError(str(r)[:300])
    raise TimeoutError(jid)


def images_of(resp):
    if 'image' in resp and resp['image']:
        return [to_img(resp['image'])]
    return [to_img(i) for i in resp.get('images', [])]


def pixflux(description, size, seed=0, **kw):
    body = {'description': description, 'image_size': {'width': size, 'height': size}, 'no_background': True, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'detailed shading', 'detail': 'highly detailed', **kw}
    return images_of(wait(call('POST', '/create-image-pixflux', body)))


def with_style(description, style_imgs, seed=0, style_description=None):
    body = {'description': description, 'style_images': [{'image': b64(i), 'width': i.width, 'height': i.height} for i in style_imgs], 'seed': seed, 'no_background': True}
    if style_description:
        body['style_description'] = style_description
    return images_of(wait(call('POST', '/generate-with-style-v2', body)))
