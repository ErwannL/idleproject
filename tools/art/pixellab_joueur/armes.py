# v9.2.8 : spec « toutes les armes » : chaque arme de base, au repos aux 4 raretés puis 3 images de frappe.
import json,sys
SEL=json.load(open('sel.json'))
W={'knight':['short_sword','greatsword'],'archer':['short_bow','long_bow'],'pyromancer':['mage_staff','fire_staff'],'berserker':['battle_axe','whip'],'lancer':['spear','halberd'],'paladin':['mace','war_hammer'],'assassin':['dagger','katar'],'crossbowman':['crossbow','heavy_crossbow'],'stormcaller':['storm_wand','storm_scepter'],'necromancer':['scythe','soul_reaper']}
R=['common','rare','epic','legendary']
look=sys.argv[1]; spec=[]
for c,ws in W.items():
  a=SEL[look][c]; hit=json.load(open(f'work/prep/{a}.json'))['hit'] or 4
  for w in ws:
    for r in R: spec.append({'id':f'{w} ({c})','palette':{'skin':'trial'},'src':'prep','anim':a,'weapon':{'baseId':w,'rarity':r},'frames':[0]})
    spec.append({'id':f'{w} ({c})','palette':{'skin':'trial'},'src':'prep','anim':a,'weapon':{'baseId':w,'rarity':'legendary'},'frames':[max(1,hit-2),hit,min(8,hit+2)]})
json.dump(spec,open(f'arm_{look}.json','w'))
