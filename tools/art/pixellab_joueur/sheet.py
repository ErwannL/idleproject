import json,base64,sys
from PIL import Image,ImageDraw
d=json.load(open(sys.argv[1])); S=int(sys.argv[3]) if len(sys.argv)>3 else 4
rows={}
for e in d: rows.setdefault(e['id'],[]).append(e)
CW,CH,X0,Y0=84,80,24,14
W=max(len(v) for v in rows.values())*CW*S+160; H=len(rows)*CH*S
o=Image.new('RGB',(W,H),(52,58,74));dr=ImageDraw.Draw(o)
for r,(k,v) in enumerate(rows.items()):
  dr.text((4,r*CH*S+4),k,fill='white')
  for c,e in enumerate(v):
    im=Image.frombytes('RGBA',(e['w'],e['h']),base64.b64decode(e['rgba'])).crop((X0,Y0,X0+CW,Y0+CH)).resize((CW*S,CH*S),0)
    o.paste(im,(160+c*CW*S,r*CH*S),im)
  dr.line([(0,(r+1)*CH*S-1),(W,(r+1)*CH*S-1)],fill=(90,90,110))
o.save(sys.argv[2])
