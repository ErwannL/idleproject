# Emails de la préinscription : confirmation et parrainage

> **Pour Claude (sur le serveur)** : le code du dépôt est déjà prêt. Il manque seulement l'envoi des emails.
> Lis d'abord `server/app.mjs` : route `POST /api/preregister`, route `GET /api/preregister/confirm`, table `preregistrations`
> (colonnes `ref`, `referrer`, `confirm_token`, `confirmed_at`). Ne casse rien d'existant, et termine par les tests (`node --test`).

## Le but

Aujourd'hui, une personne qui se préinscrit ne reçoit rien. Or un filleul ne compte pour son parrain **qu'après la confirmation de son email**. Sans email, aucun parrainage ne compte.

## 1. L'email de confirmation

Envoyé juste après une **nouvelle** préinscription (pas si l'adresse était déjà inscrite et confirmée).

- **Expéditeur** : `Ascendrya <contact@ascendrya.com>`. Le domaine `ascendrya.com` doit être authentifié pour l'envoi (SPF, DKIM, DMARC), sinon les emails finissent en indésirables.
- **Langue** : celle du site au moment de l'inscription (français ou anglais). Le site envoie déjà la langue dans `?lang=` : ajoute-la au corps de la requête si besoin, français par défaut.
- **Objet** : « Confirme ta préinscription à Ascendrya » / « Confirm your Ascendrya pre-registration ».
- **Contenu** (court, en HTML simple avec une version texte) :
  1. Le logo ou le titre ASCENDRYA.
  2. « Merci ! Clique sur le bouton pour confirmer ton adresse. »
  3. Un gros bouton **Confirmer** vers `https://ascendrya.com/?confirm=<confirm_token>`. La page appelle déjà la route de confirmation.
  4. Le lien de parrainage personnel `https://ascendrya.com/?ref=<ref>` et une phrase : « Invite tes amis : chaque ami inscrit te rapporte une récompense au lancement. »
  5. Les 5 récompenses de parrainage : 1 ami (50 gemmes), 3 (1 ticket d'invocation), 5 (cadre « Pionnier »), 10 (5 tickets + titre « Recruteur »), 25 (apparence de familier exclusive).
  6. Le nombre actuel de filleuls confirmés.
  7. En bas : « Tu n'es pas à l'origine de cette inscription ? Ignore cet email. » et un lien de désinscription. Cette route existe déjà (`POST /api/preregister/remove`) : prévois une page ou un lien qui l'appelle.
- Si l'envoi échoue, l'inscription reste valide : on journalise l'erreur (sans l'adresse email en clair) et on ne renvoie pas d'erreur au visiteur.

## 2. Après la confirmation

- Quand on ouvre `?confirm=<jeton>`, le site doit afficher un message clair : « Adresse confirmée, merci ! » ou « Lien déjà utilisé ou invalide ». La route renvoie déjà `{ ok: true | false }`. Il manque seulement l'affichage côté site (`site/site.js`, `site/i18n/fr.js` et `en.js`).
- Facultatif : quand un filleul confirme, envoyer au parrain un email court « Un ami vient de te rejoindre ! Tu en as amené N. » Au plus un email par jour et par parrain, regroupé.

## 3. Garde-fous

- Pas plus d'un email de confirmation par adresse et par heure (une réinscription ne renvoie pas un email à chaque fois).
- Limite globale d'envois par heure, pour ne pas être bloqué par le service d'envoi en cas d'abus.
- Aucun secret (clé, mot de passe) dans le dépôt : uniquement dans la configuration du serveur.
- Les préinscrits déjà présents avant ce changement n'ont pas de jeton. Prévois une commande à lancer une seule fois, qui leur crée un code et un jeton et leur envoie l'email, par petits lots. Ne la lance pas sans mon accord.
- Mets à jour la politique de confidentialité (`site/confidentialite.html`) : on envoie un email de confirmation, et le nom du service d'envoi utilisé.

## Tests

- Nouvelle inscription : un email est envoyé (service d'envoi simulé dans les tests), avec le bon lien de confirmation et le bon lien de parrainage.
- Même adresse deux fois dans l'heure : un seul email.
- Envoi en échec : l'inscription renvoie quand même `202` avec le code de parrainage.
- `?confirm=` valide : message « Adresse confirmée » ; jeton inconnu : message « Lien invalide ».
- Inscription via `?ref=CODE`, puis confirmation : le compteur du parrain passe de 0 à 1.
- Un vrai email de test reçu dans une boîte Gmail, pas en indésirables.
