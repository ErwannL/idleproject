# v9.2.9 : harmonisation des tailles — chaque nouveau familier réduit d'un facteur unique (vue, sprite, toutes les
# images d'animation et de geste), réduction douce puis couleurs ramenées à la palette d'origine, alpha franc.
import glob, os, json, sys
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__)); A='/home/user/idleproject/'
H={'crystal_hedgehog':18,'kitsune':22,'jade_turtle':18,'dragonling':24,'phoenix':24}
MODE=sys.argv[1] if len(sys.argv)>1 else 'lz'
def pal(im): return sorted({p[:3] for p in im.getdata() if p[3]})
def shrink(im,f,P):
    w,h=im.size; W,Hh=max(1,round(w*f)),max(1,round(h*f))
    if MODE=='nn': out=im.resize((W,Hh),Image.NEAREST)
    else:
        out=im.resize((W,Hh),Image.BOX); px=out.load()
        for y in range(Hh):
            for x in range(W):
                r,g,b,a=px[x,y]
                if a<128: px[x,y]=(0,0,0,0); continue
                r,g,b=[v*255//a for v in (r,g,b)] if False else (r,g,b)
                c=min(P,key=lambda c:(c[0]-r)**2+(c[1]-g)**2+(c[2]-b)**2); px[x,y]=(*c,255)
    return out
for k,t in H.items():
    ref=Image.open(f'{S}/ref/pet_{k}.png').convert('RGBA'); sp=Image.open(f'{S}/ref/pet_{k}_sprite.png')
    f=t/sp.height; P=pal(ref)
    r2=shrink(ref,f,P); b=r2.getbbox()
    out=f'{S}/small_{MODE}'; os.makedirs(out,exist_ok=True)
    r2.save(f'{out}/pet_{k}.png'); r2.crop(b).save(f'{out}/pet_{k}_sprite.png')
    json.dump({'ox':b[0],'oy':b[1]},open(f'{out}/pet_{k}.json','w'))
    for d in glob.glob(f'{S}/raw/pet_{k}_*'):
        od=f'{out}/{os.path.basename(d)}'; os.makedirs(od,exist_ok=True)
        for fp in glob.glob(d+'/f*.png'):
            im=Image.open(fp).convert('RGBA'); shrink(im,f,P+pal(im)[:0]).save(f'{od}/{os.path.basename(fp)}')
    print(k,round(f,3),r2.crop(b).size)
