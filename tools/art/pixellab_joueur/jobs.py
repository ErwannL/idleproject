# v9.2.8 : personnages SANS ARME du compte PixelLab du joueur -> animations du héros tenant l'arme équipée (essai).
# Chaîne : jobs.py (liste des animations) -> run.py (/animate-character, mode pixminimax, vue est, 1 génération)
#   -> skel.py (/estimate-skeleton, 0,1 génération/image : coude et poignet du bras avant = prise et angle de l'arme)
#   -> prep.py (cadre 96x72 du héros, pieds y=71, traînées retirées, prises [x, y, angle])
#   -> render.mjs (rendu par le vrai code du jeu : hero-draw.js drawHeroPick + heroHeldWeapon, couleur de rareté)
#   -> sheet.py / armes.py / video.py (planches avant/après x4, toutes les armes, vidéo 1280x720 60 i/s).
# correspondance.json : apparence du jeu -> personnage choisi (le plus récent sans arme) ; selection.json : prise retenue
# par animation. Pas encore branché dans le jeu (voir le verdict de la 9.2.8 : main au repos, taille, traînées).
import json,sys
TAIL=', keeps exactly the same side view facing right the whole time, never turns around, the head stays visible on every frame, feet stay on the same spot, no visual effects, no projectile, no motion trails, the hands are empty and hold nothing at all, no sword, no bow, no staff, no tool, no light, no spark'
GRIP=' with the front fist closed as if gripping an invisible '
ATK={
 'knight':'raises the closed front fist up behind the shoulder, then brings the fist forward and down diagonally in front of the body with force, then returns to guard',
 'archer':'stretches the front arm straight forward at shoulder height with the fist closed, pulls the back hand to the cheek, opens the back hand, the front arm recoils slightly',
 'pyromancer':'raises the closed front fist to chest height then pushes it forward and up in a casting motion, robe and hair blowing',
 'berserker':'lifts the closed front fist high above the head, then brings it down forward with force in a heavy chopping blow, body leaning forward',
 'lancer':'pulls the closed front fist back to the hip then punches it straight forward in a long thrust at waist height, body leaning forward',
 'paladin':'raises the closed front fist above the head then smashes it down forward in a hammering blow',
 'assassin':'crouches and lunges forward with a quick low jab of the closed front fist',
 'crossbowman':'raises both closed fists together forward at chest height, holds them steady aiming forward, then both arms jolt back slightly',
 'stormcaller':'points the closed front fist straight forward with the arm fully extended, holds it, then lowers it',
 'necromancer':'sweeps the closed front fist in a wide low arc from behind to the front of the body',
}
GEST={
 'palm_push':'pulls one hand back then thrusts the open palm forward toward the right in a sharp strike, then returns to the idle pose',
 'sweep':'twists its torso and sweeps both arms in a wide horizontal circle around its body, then twists back to the idle pose',
 'roar':'clenches both fists, hunches its shoulders and leans back, opening its mouth wide in a furious battle cry, then relaxes back to the idle pose',
 'smite':'raises one open hand high to the sky, holds it up, then swings the arm down to point forward at the enemy on the right, then returns to the idle pose',
 'raise_staff':'slowly raises both closed fists high above its head toward the sky , holds the pose, then lowers them back to the idle pose',
}
def jobs(look,cid):
    J=[{'name':f'{look}_walk','cid':cid,'act':'walking cycle to the right, legs stepping, front arm bent forward with the fist closed as if holding a weapon, cape and hair swaying, character stays in place, no visual effects'},
       {'name':f'{look}_swim','cid':cid,'act':'dives forward and lies flat horizontally as if in water, whole body fully horizontal with the head on the right and the feet on the left, swimming front crawl, arms stroking alternately, legs flutter kicking, hair and clothes trailing behind, character stays in place, no visual effects, no water drawn','end':False}]
    J+=[{'name':f'{look}_{c}_attack','cid':cid,'act':a+TAIL} for c,a in ATK.items()]
    J+=[{'name':f'{look}_{g}','cid':cid,'act':a+TAIL} for g,a in GEST.items()]
    return J
if __name__=='__main__':
    out=[]
    for a in sys.argv[2:]:
        l,c=a.split('='); out+=jobs(l,c)
    json.dump(out,open(sys.argv[1],'w'),indent=1); print(len(out))
