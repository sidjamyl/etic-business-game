# Déploiement et mode de secours

Déploiement manuel (S6, S8) : une seule image Docker (serveur Bun et application web construite), PostgreSQL, Caddy pour le HTTPS et une sauvegarde quotidienne. Le même Compose sert sur le VPS et, en secours, sur un ordinateur du réseau local. Tous les fichiers sont dans `deploy/`.

| Fichier | Rôle |
| --- | --- |
| `Dockerfile` (racine) | Image multi-étapes : dépendances, construction Vite, image d'exécution sans outils de développement |
| `deploy/compose.yml` | Services `app`, `db`, `backup` et `caddy` |
| `deploy/Caddyfile` | HTTPS automatique (Let's Encrypt) ou HTTP simple pour le secours |
| `deploy/.env.example` | Variables à copier dans `deploy/.env` |
| `deploy/deploy.sh` | Vérifie qu'aucune partie n'est en cours, sauvegarde, reconstruit et redémarre |
| `deploy/restore.sh` | Restaure une sauvegarde |

Le serveur applique les migrations au démarrage et recharge les parties enregistrées. La compression et le cache longue durée des fichiers statiques sont assurés par le serveur : fichiers de `/assets/` en cache un an (noms versionnés), `index.html` jamais.

## Règle : aucune mise en production pendant une partie

`deploy.sh` refuse de déployer si une partie est **en cours ou en pause** et affiche son nom. Terminer la partie depuis la salle de contrôle, puis relancer. `FORCE=1 ./deploy/deploy.sh` contourne la vérification pour une correction d'urgence uniquement : le serveur enregistre les parties à l'arrêt et les recharge, mais les joueurs sont déconnectés pendant le redémarrage.

## 1. Préparer le VPS (une fois)

Prérequis : Docker Engine avec le plugin Compose, Git, ports **80/tcp, 443/tcp et 443/udp** ouverts dans le pare-feu.

**Sous-domaine gratuit.** Recommandation : [DuckDNS](https://www.duckdns.org). Créer un sous-domaine (par exemple `etic-game.duckdns.org`) pointant vers l'IP publique du VPS. Google accepte ces sous-domaines pour la connexion, car `duckdns.org` figure dans la liste des suffixes publics ; une IP brute ou un domaine privé ne sont pas acceptés. Vérifier la résolution avant de continuer :

```sh
dig +short etic-game.duckdns.org   # doit afficher l'IP du VPS
```

**Connexion Google** (facultative ; e-mail et mot de passe fonctionnent toujours). Dans Google Cloud Console → API et services → Identifiants, créer un ID client OAuth « Application Web » :

- Origine JavaScript autorisée : `https://etic-game.duckdns.org`
- URI de redirection autorisée : `https://etic-game.duckdns.org/api/auth/callback/google`
- Écran de consentement : ajouter `etic-game.duckdns.org` aux domaines autorisés. En mode « Test », seuls les comptes ajoutés comme testeurs peuvent se connecter : publier l'application (scopes de base, sans vérification Google) avant le jour du jeu.

**Code et configuration :**

```sh
git clone https://github.com/sidjamyl/etic-business-game.git
cd etic-business-game
cp deploy/.env.example deploy/.env
openssl rand -hex 32      # → POSTGRES_PASSWORD
openssl rand -base64 32   # → BETTER_AUTH_SECRET
nano deploy/.env          # APP_URL, SITE_ADDRESS, secrets, ORGANIZER_EMAILS, Google
chmod 600 deploy/.env
```

## 2. Déployer

```sh
git pull --ff-only
./deploy/deploy.sh
```

Le script construit l'image pendant que l'ancienne version tourne encore, sauvegarde la base dans `deploy/backups/predeploy-*.dump` (7 conservées), redémarre puis attend la réponse de `/health`.

**Juste après le premier déploiement**, l'organisateur crée son compte avec l'adresse de `ORGANIZER_EMAILS`, avant de diffuser l'adresse. Le rôle est attribué selon l'e-mail et les adresses ne sont pas vérifiées pour l'inscription par mot de passe : un compte créé par quelqu'un d'autre avec cette adresse recevrait le rôle.

### Vérifications après déploiement

```sh
curl -s https://etic-game.duckdns.org/health          # {"status":"ok","database":"up"}
curl -sI https://etic-game.duckdns.org/ | head -n 5    # HTTP/2 200, cache-control: no-cache
docker compose -f deploy/compose.yml ps                # app « healthy »
docker compose -f deploy/compose.yml logs -f app       # journaux JSON (Pino)
```

Puis dans un navigateur : connexion par e-mail, connexion Google, création d'une partie de répétition, écran projeté `/screen/<id>` qui se met à jour sans recharger la page.

### Si le VPS a déjà un proxy sur 80/443

Laisser `COMPOSE_PROFILES=` vide dans `deploy/.env` (Caddy n'est pas lancé) et faire pointer le proxy existant vers `127.0.0.1:3000` (modifiable avec `APP_BIND`). Le proxy doit transmettre l'IP du client dans **un seul** en-tête `X-Forwarded-For` et ne pas mettre en tampon les flux SSE. Exemple nginx :

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

## 3. Sauvegardes

- Le service `backup` écrit `deploy/backups/daily-AAAA-MM-JJ.dump` une fois par jour et garde les 7 dernières.
- `deploy.sh` ajoute une sauvegarde avant chaque déploiement.
- Copier régulièrement `deploy/backups/` hors du VPS, par exemple : `scp -r vps:etic-business-game/deploy/backups ./sauvegardes-etic`.

Restaurer (remplace toutes les données, demande confirmation) :

```sh
./deploy/restore.sh deploy/backups/daily-2026-11-20.dump
```

## 4. Mode de secours sur un ordinateur du réseau local

À utiliser si le VPS ou l'accès à Internet tombe le jour du jeu. À préparer et tester la veille.

1. Sur un ordinateur avec Docker (Docker Desktop sur macOS ou Windows), cloner le dépôt et récupérer la dernière sauvegarde si l'on veut reprendre une partie.
2. Trouver son adresse sur le réseau local (macOS : `ipconfig getifaddr en0`), par exemple `192.168.1.20`. Lui réserver cette adresse dans le routeur si possible.
3. Créer `deploy/.env` avec :

   ```sh
   APP_URL=http://192.168.1.20
   SITE_ADDRESS=:80
   COMPOSE_PROFILES=https
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   # POSTGRES_PASSWORD, BETTER_AUTH_SECRET, ORGANIZER_EMAILS comme sur le VPS
   ```

4. `./deploy/deploy.sh`, puis, pour reprendre une partie, `./deploy/restore.sh <sauvegarde>`.
5. Les joueurs ouvrent `http://192.168.1.20` depuis le même réseau Wi-Fi. Autoriser les connexions entrantes si le pare-feu le demande.

Limites du secours :

- HTTP simple : les cookies ne sont pas marqués `Secure`, ce qui est nécessaire pour se connecter sans HTTPS.
- **Pas de connexion Google** (Google refuse les adresses privées). Les comptes créés avec Google sur le VPS n'ont pas de mot de passe et ne peuvent pas se connecter sur une base restaurée ; ils ne peuvent pas non plus se réinscrire avec la même adresse. Pour un secours sur une base vide, chacun crée un compte par e-mail et mot de passe.
- Tous les joueurs doivent utiliser exactement l'adresse de `APP_URL`.

## Notes techniques

- La limite de connexions de Better Auth est réglée pour une salle partageant une même IP publique : 60 tentatives de connexion et 60 inscriptions par minute et par IP.
- Les flux temps réel (SSE) restent ouverts : ping toutes les 15 s et délai d'inactivité de Bun porté à 60 s ; Caddy ne compresse ni ne met en tampon ces réponses.
- Le port de l'application n'est publié que sur `127.0.0.1` : l'IP utilisée pour limiter les connexions vient de `X-Forwarded-For`, fixé par Caddy.
