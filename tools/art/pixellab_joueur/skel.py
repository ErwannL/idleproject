# v9.2.8 : squelette estimé (PixelLab /estimate-skeleton, 0,1 génération) de chaque image : coude et poignet.
import base64,json,os,sys,urllib.request,time
from concurrent.futures import ThreadPoolExecutor
K=os.environ['PIXELLAB_API_KEY']
def est(p):
    cache=p[:-4]+'.skel.json'
    if os.path.exists(cache): return p,json.load(open(cache))
    b={'image':{'type':'base64','base64':base64.b64encode(open(p,'rb').read()).decode(),'format':'png'}}
    for a in range(4):
        try:
            r=urllib.request.Request('https://api.pixellab.ai/v2/estimate-skeleton',method='POST',data=json.dumps(b).encode(),headers={'Authorization':'Bearer '+K,'Content-Type':'application/json'})
            with urllib.request.urlopen(r,timeout=120) as f: d=json.load(f)
            json.dump(d['keypoints'],open(cache,'w')); return p,d['keypoints']
        except Exception as e: err=e; time.sleep(8)
    return p,None
if __name__=='__main__':
    with ThreadPoolExecutor(8) as ex:
        for p,k in ex.map(est,sys.argv[1:]): print(p, 'ok' if k else 'ECHEC')
