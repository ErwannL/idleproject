# Idle RPG — prototype (Godot 4.4)

RPG idle 2D vue de côté, pixel art, pensé pour PC dans une petite fenêtre.
Référence produit : cahier des charges `Cahier_des_charges_Idle_RPG_Desktop_Pixel_Art.docx`.

## État actuel

Fondations posées, **pas encore de scène jouable**.

| Élément | Fichier | Statut |
|---|---|---|
| Configuration projet (fenêtre 400 × 250, redimensionnable) | `project.godot` | écrit, **non ouvert dans Godot** |
| Équilibrage centralisé (zone, ennemis, améliorations, raretés, objets) | `data/balance.json` | écrit, **JSON non validé** |
| Gains hors ligne (plafond 8 h, horloge future rejetée) | `scripts/core/offline_progress.gd` | écrit, **non testé** |
| Formatage des nombres (1,2 K, 3,4 M) | `scripts/core/number_format.gd` | écrit, **non testé** |
| Sauvegarde JSON avec écriture atomique | `scripts/core/save_file.gd` | écrit, **non testé** |

Non réalisé : combat automatique, ennemis, boss, or, loot, inventaire, améliorations, interface, tests.

## Pourquoi rien n'a été exécuté

Godot 4.4 n'est pas installé dans l'environnement de développement. Le téléchargement du binaire
(depuis GitHub) a été bloqué par la politique d'exécution de code externe. Aucun des fichiers
ci-dessus n'a donc été lancé ni vérifié.

## Lancer le projet (une fois Godot installé)

```bash
# Ouvrir dans l'éditeur
godot --path . --editor

# Vérifier que les scripts se compilent (sans fenêtre)
godot --headless --path . --quit
```

## Prochaines étapes

1. Installer Godot 4.4 (ou autoriser le téléchargement) et ouvrir le projet.
2. Valider `balance.json` et `offline_progress.gd` avec un test headless.
3. Ajouter le combat automatique (héros, ennemis, boss) en placeholders colorés.
4. Ajouter l'économie (or, améliorations), puis le loot et l'inventaire à 3 emplacements.
5. Brancher la sauvegarde à chaque action et le résumé hors ligne au lancement.
