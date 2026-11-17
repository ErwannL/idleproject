# v9.8 : passe au tutoiement des phrases visibles, dans le code ET les clés de traduction (mêmes chaînes partout).
import pathlib
PAIRS = [
 ("recyclez en éclats, puis forgez mieux.", "recycle en éclats, puis forge mieux."),
 ("multiplie</b> vos dégâts", "multiplie</b> tes dégâts"),
 ("— vous irez bien plus loin qu'avant.", "— tu iras bien plus loin qu'avant."),
 ("Vos anciens talents ont été remboursés", "Tes anciens talents ont été remboursés"),
 ("Replantez-les où vous voulez !", "Replante-les où tu veux !"),
 ("Astuce : maintenez le clic sur un bouton", "Astuce : maintiens le clic sur un bouton"),
 ("(il vous en restera ", "(il t'en restera "),
 ("investis vous sont rendus.", "investis te sont rendus."),
 ("Pour choisir votre nom et retrouver votre partie sur un autre appareil, créez votre compte joueur. Votre progression", "Pour choisir ton nom et retrouver ta partie sur un autre appareil, crée ton compte joueur. Ta progression"),
 ("La progression de votre compte remplacera celle de cet appareil", "La progression de ton compte remplacera celle de cet appareil"),
 ("Exportez votre partie avant.", "Exporte ta partie avant."),
 ("augmentent vos chances.", "augmentent tes chances."),
 ("Glissez pour vous déplacer, molette ou pincement pour zoomer", "Glisse pour te déplacer, molette ou pincement pour zoomer"),
 (" <small>(vous)</small>", " <small>(toi)</small>"),
 ("Créez votre compte pour apparaître au classement, voir votre rang et ajouter des amis.", "Crée ton compte pour apparaître au classement, voir ton rang et ajouter des amis."),
 ("Ajoutez des amis pour vous comparer à eux.", "Ajoute des amis pour te comparer à eux."),
 ("Le Musée expose vos objets ancestraux", "Le Musée expose tes objets ancestraux"),
 ("dès que vous en avez 2 emplacements différents", "dès que tu en as 2 emplacements différents"),
 ("votre tentative compte quand même pour votre record.", "ta tentative compte quand même pour ton record."),
 ("vos dégâts s'ajoutent à ceux de la communauté. Votre équipe habituelle", "tes dégâts s'ajoutent à ceux de la communauté. Ton équipe habituelle"),
 ("Nouveau membre : vos contributions", "Nouveau membre : tes contributions"),
 (" % de vos coups manquent", " % de tes coups manquent"),
 ("vous perdez ", "tu perds "),
 (" % de vos PV max par seconde", " % de tes PV max par seconde"),
 ("Chaque ligne indique son gain en dégâts/s : à vous de choisir.", "Chaque ligne indique son gain en dégâts/s : à toi de choisir."),
 ("Réaffûter remonte un objet au niveau de votre étape max.", "Réaffûter remonte un objet au niveau de ton étape max."),
 ("et mesure votre r", "et mesure ton r"),
 ("Un point par niveau du héros, à placer où vous voulez.", "Un point par niveau du héros, à placer où tu veux."),
 ("Glissez ou utilisez la molette pour vous déplacer, Ctrl + molette pour zoomer.", "Glisse ou utilise la molette pour te déplacer, Ctrl + molette pour zoomer."),
 ("Glissez du doigt pour vous déplacer ; les boutons", "Glisse du doigt pour te déplacer ; les boutons"),
 ("Si un boss vous bat,", "Si un boss te bat,"),
 ("Deux compagnons et un familier combattent avec vous.", "Deux compagnons et un familier combattent avec toi."),
 ("Tout ce que vous découvrez s'inscrit ici", "Tout ce que tu découvres s'inscrit ici"),
 ("Tout ce que vous découvrez s\\'inscrit ici", "Tout ce que tu découvres s\\'inscrit ici"),
 ("vous revenez de temps en temps pour améliorer votre héros.", "tu reviens de temps en temps pour améliorer ton héros."),
 ("La meute vous a déjà senti.", "La meute t'a déjà senti."),
 ("La meute vous a déjà senti.".replace("'", "\\'"), "La meute t\\'a déjà senti."),
 ("Le roi démoniaque vous attend sur son trône.", "Le roi démoniaque t'attend sur son trône."),
 ("Retenez votre souffle", "Retiens ton souffle"),
]
n = 0
for p in [*pathlib.Path('src').rglob('*.js'), *pathlib.Path('tests').rglob('*.js')]:
    s = p.read_text(); o = s
    for a, b in PAIRS:
        s = s.replace(a, b)
        if "'" in a: s = s.replace(a.replace("'", "\\'"), b.replace("'", "\\'"))
    if s != o: p.write_text(s); n += 1
print(n, 'fichiers')
