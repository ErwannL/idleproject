# Mise à jour automatique du serveur « games »

Toutes les 5 minutes, `idle-rpg-update.timer` lance `/usr/local/sbin/idle-rpg-update`, qui compare
la branche principale du dépôt (`main`) à la dernière version déployée.
Si elle a changé : sauvegarde dans `/var/backups/idle-rpg/<date>/` (server, site, base), copie de
`server/` et `site/` dans `/srv/idle-rpg/`, redémarrage d'`idle-rpg`, vérification de `/` et de l'API.
En cas d'échec, l'ancienne version est remise en place (le commit refusé est noté dans
`/var/lib/idle-rpg-src/deployed.failed`, il n'est pas réessayé).

Accès au dépôt privé : clé de déploiement en lecture seule `/root/.ssh/idle-rpg-deploy`
(GitHub → Settings → Deploy keys : « games (mise à jour auto, lecture seule) »).

Installation (sur le serveur, depuis ce dossier) :

```sh
sudo install -m 755 idle-rpg-update /usr/local/sbin/
sudo install -m 644 idle-rpg-update.service idle-rpg-update.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now idle-rpg-update.timer
```

Suivi : `journalctl -u idle-rpg-update`. Forcer une vérification : `sudo systemctl start idle-rpg-update`.

## Déploiement immédiat (webhook GitHub)

En plus du minuteur, GitHub prévient le serveur à chaque push : l'URL du webhook est
`https://ascendrya.com/api/hooks/deploy` (Caddy sur le serveur, ports 80/443 redirigés par la Freebox ; l'ancienne adresse Funnel marche aussi).
Caddy envoie ce chemin vers le récepteur local (127.0.0.1:9001), qui lance `idle-rpg-update` tout de suite ;
le reste du site (`/`) va vers le jeu (127.0.0.1:8787).
