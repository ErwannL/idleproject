# Site de préinscription : paliers proches et parrainage

> **Pour Claude** :
> - Copie ce dossier dans le dépôt, sous `docs/site-v10.8/`.
> - Ouvre avec l'outil Read les captures de `apercu/` : avant / après, PC et téléphone, français et anglais.
> - `site-paliers-parrainage.patch` montre le changement côté navigateur, déjà essayé sur une copie du site. Il est à appliquer à la main dans `site/`, car ses chemins pointent vers la copie.

## Pourquoi

Aujourd'hui, le compteur affiche « 4 sur 50 000 ». Un visiteur en conclut que personne ne vient. Le premier palier, 1 000, est loin.

Le but : une petite victoire toutes les 3 à 4 semaines d'ici avril, et une raison de partager.

## 1. Paliers

Les paliers en ligne viennent de l'admin (`/api/live/goals`).

**À faire** :
- régler les paliers ci-dessous dans l'admin ;
- mettre les mêmes valeurs par défaut dans `site/live.js` (`DEFAULT_GOALS`), en cas de panne de l'admin ;
- mettre les mêmes textes dans `site/i18n/fr.js` et `en.js` (clés `tiers`).

Objectif principal (`target`) : **10 000**.

| Palier | Récompense | Image |
|---|---|---|
| 250 | 100 gemmes | `assets/icon_gem.png` |
| 500 | 250 gemmes + 100 K or | `assets/shop/crystal_medium.webp` |
| 1 000 | Familier exclusif Slime doré | `assets/hd_pet_golden_slime.webp` |
| 2 500 | 250 gemmes + 5 tickets | `assets/shop/hero_ticket_permanent.webp` |
| 5 000 | Compagnon exclusif Lame rose (SR) | `assets/hd_ally_rose_blade.webp` |
| 10 000 | **Compagnon SSR Archange** (la mascotte du compte X) | `assets/px/ally_archangel.webp` |

Paliers bonus, en « récompense mystère » jusqu'à 10 000 :

| Palier | Récompense |
|---|---|
| 15 000 | Apparence légendaire Lilith, Reine des braises |
| 20 000 | 1 500 gemmes + 5 tickets + 500 K or |
| 35 000 | Apparence légendaire Roi Grombar + méga pack |
| 50 000 | Familier légendaire Petit phénix + 2 000 gemmes |

## 2. Compteur : toujours le prochain palier

Dans `site/site.js`, `renderGoals` : la barre et le nombre visent le prochain palier, pas l'objectif final.

```js
const goal = next ? next.at : target;
```

Le texte devient :
- en français : `sur ${n} · prochain palier` ;
- en anglais : `of ${n} · next milestone`.

## 3. Parrainage

**Navigateur** (déjà dans le patch) : après une inscription réussie, un encadré « Bienvenue dans l'aventure ! » s'affiche avec :
- le lien personnel `https://ascendrya.com/?ref=<code>` ;
- les boutons Copier, X et WhatsApp ;
- les 5 récompenses (1, 3, 5, 10 et 25 amis) ;
- « Tu as amené N aventuriers ».

Textes en français et en anglais (clé `ref`).

**Serveur, à faire** (`server/app.mjs`, route `POST /api/preregister`) :
1. À l'inscription, créer un code court unique (6 caractères, sans 0/O ni 1/I) et le renvoyer : `{ ok: true, ref: "K7Q2M" }`.
2. Lire `ref` dans le corps de la requête. Le site doit le prendre dans l'adresse (`?ref=`), le garder en `sessionStorage` et l'envoyer avec le formulaire (pas encore dans le patch). Enregistrer qui a parrainé qui.
3. Un filleul ne compte qu'une fois, et seulement après confirmation de son email. On ne peut pas se parrainer soi-même (même email, ou même adresse IP dans l'heure).
4. Nouvelle route `GET /api/preregister/ref/:code` qui renvoie `{ count }`. La page « Merci » l'affiche, et l'email de confirmation rappelle le lien et le compteur.
5. Côté admin : un classement des 10 meilleurs parrains, avec le pseudo ou le début de l'email masqué.
6. Les récompenses de parrainage sont remises au lancement, comme celles des paliers. Pas de récompense en argent.

## 4. Petits réglages

- Après l'inscription, cacher la barre flottante « Préinscription » (`.sticky`) : elle passe par-dessus l'encadré de parrainage sur téléphone (visible sur `apres-tel-en-merci.png`).
- Remplacer les adresses factices de `site/config.js` (`TON-DOMAINE`, `TON-COMPTE`) par les vraies : domaine `ascendrya.com`, comptes X, YouTube, TikTok et Discord.
- Ajouter les pixels Meta et TikTok, et lire `utm_source` pour savoir d'où viennent les inscrits. La politique de confidentialité doit le mentionner.

## Tests

- Compteur à 4 : « 4 sur 250 · prochain palier », la barre à 1,6 %, et la carte 250 marquée « Prochain ».
- Compteur à 300 : la carte 250 est « Débloqué », la barre vise 500.
- Inscription via `?ref=ABCDE` : le parrain gagne +1 après confirmation de l'email du filleul.
- Français et anglais (`?lang=fr`, `?lang=en`) ; PC 1280 px et téléphone 390 px.
