# Guide de déploiement sur VPS Hostinger

Ce guide décrit l'installation complète de l'application sur un VPS Hostinger (Ubuntu 22.04 / 24.04).

---

## 1. Prérequis côté Hostinger

1. **Acheter un VPS** (plan KVM — minimum 2 vCPU, 4 Go RAM, 50 Go disque).
2. **Système d'exploitation** : Ubuntu 22.04 LTS ou 24.04 LTS.
3. **Accès SSH** : connectez-vous avec `ssh root@IP_DU_VPS`.

---

## 2. Préparation du serveur

### 2.1 Mises à jour

```bash
apt update && apt upgrade -y
```

### 2.2 Installer Docker et Docker Compose

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh

# Vérifier
docker --version
docker compose version
```

### 2.3 Installer Git (pour cloner le projet)

```bash
apt install -y git
```

### 2.4 Ouvrir les ports 80 et 443 dans le pare-feu Hostinger

Dans le panel Hostinger → **VPS → Pare-feu / Security** :

- Ajouter une règle TCP **port 80** (HTTP)
- Ajouter une règle TCP **port 443** (HTTPS)

> Le port 3001 n'a **pas besoin** d'être ouvert — Traefik fait le proxy en interne.
>
> ⚠️ **Important** : Vous devez avoir un **nom de domaine** pointant vers l'IP de votre VPS (enregistrement A dans votre gestionnaire DNS). Traefik génère automatiquement les certificats SSL via Let's Encrypt.

---

## 3. Installer Traefik (reverse proxy global)

Traefik gère le HTTPS automatiquement (Let's Encrypt) et permet d'héberger plusieurs applications sur le même VPS.

### 3.1 Créer le réseau Docker

```bash
docker network create traefik-proxy
```

### 3.2 Cloner et configurer Traefik

```bash
mkdir -p /opt/traefik/dynamic
mkdir -p /opt/traefik/letsencrypt
cd /opt/traefik
```

Copier les fichiers depuis le projet :
```bash
cp /opt/ageo/traefik/docker-compose.yml /opt/traefik/docker-compose.yml
cp /opt/ageo/traefik/dynamic/dynamic.yml /opt/traefik/dynamic/dynamic.yml
```

Éditer la configuration :
```bash
nano /opt/traefik/docker-compose.yml
```

Changer :
- `votre@email.com` → votre vrai email (pour Let's Encrypt)
- `traefik.votre-domaine.com` → sous-domaine pour le dashboard Traefik

### 3.3 Démarrer Traefik

```bash
cd /opt/traefik
docker compose up -d
```

Vérifier :
```bash
docker compose logs -f traefik
```

Le dashboard Traefik est accessible sur `http://IP_DU_VPS:8080` (temporaire, avant SSL).

---

## 4. Transférer le projet sur le VPS

### Option A : Git (recommandé)

```bash
cd /opt
git clone https://github.com/VOTRE-COMPET/ageo.git
cd ageo
```

### Option B : SCP (depuis votre machine locale)

```bash
# Depuis votre PC — envoyer le dossier complet
scp -r "C:\Users\RMT\OneDrive\Desktop\AGEO" root@IP_DU_VPS:/opt/ageo
```

> **Note** : Ne pas inclure `node_modules/` ni `client/dist/` — ils seront reconstruits par Docker.

---

## 5. Configurer les variables d'environnement

Éditer le fichier `docker-compose.yml` sur le VPS :

```bash
nano /opt/ageo/docker-compose.yml
```

**1. Changer le domaine** dans les labels Traefik (section `app.labels`) :

```
traefik.http.routers.ageo.rule=Host(`ageo.votre-domaine.com`)
```

Remplacez `ageo.votre-domaine.com` par votre sous-domaine réel.

**2. Changer les variables** dans la section `app.environment` :

| Variable           | Valeur                        | Description                                  |
| ------------------ | ----------------------------- | -------------------------------------------- |
| `JWT_SECRET`     | Une chaîne aléatoire longue | Clé de signature des tokens JWT             |
| `LICENCE_SECRET` | Votre secret de licence       | Déjà défini, conservez-le                 |
| `LICENCE_KEY`    | Votre clé de licence         | Laissez vide pour le mode interne            |
| `DB_PASSWORD`    | Mot de passe MySQL fort       | Doit correspondre à `MYSQL_ROOT_PASSWORD` |

Changer également dans la section `mysql.environment` :

| Variable                | Valeur                                    |
| ----------------------- | ----------------------------------------- |
| `MYSQL_ROOT_PASSWORD` | Le même mot de passe que `DB_PASSWORD` |

> **Important** : Générez un `JWT_SECRET` aléatoire :
>
> ```bash
> openssl rand -hex 32
> ```

---

## 6. Construire et démarrer l'application

```bash
cd /opt/ageo
docker compose up -d --build
```

Cette commande :

1. Compile le frontend React (Vite build)
2. Installe les dépendances backend (npm ci)
3. Démarre MySQL + l'application Node.js

### Vérifier que tout fonctionne

```bash
# Voir les logs
docker compose logs -f app

# Vérifier les conteneurs
docker compose ps
```

Vous devriez voir :

```
[AGEO] ✅ Licence valide
[AGEO] Base de données MySQL prête
[AGEO] Application disponible sur http://localhost:3001
[AGEO] Connexion MySQL établie
```

Traefik route automatiquement le trafic vers l'app et génère le certificat SSL.

---

## 7. Tester l'accès

Depuis un navigateur : `https://ageo.votre-domaine.com` (SSL automatique via Traefik)

- **Email** : `admin@entreprise.com`
- **Mot de passe** : `admin1234`

> ⚠️ **Changez immédiatement le mot de passe admin** après la première connexion (Paramètres → Sécurité).

---

## 8. HTTPS — déjà géré par Traefik

Traefik génère et renouvelle automatiquement les certificats SSL via Let's Encrypt. **Aucune configuration manuelle nécessaire.**

- HTTP → HTTPS : redirection automatique
- Certificats : générés à la première requête
- Renouvellement : automatique (avant expiration)

> Si vous voulez tester sans domaine (SSL auto-signé), décommentez la ligne `acme.caserver` (staging) dans `/opt/traefik/docker-compose.yml`.

---

## 9. Ajouter un autre projet sur le même VPS

Pour héberger une autre application Docker :

1. Créer un `docker-compose.yml` pour le nouveau projet
2. Le connecter au réseau `traefik-proxy`
3. Ajouter les labels Traefik avec un autre sous-domaine

Exemple :
```yaml
services:
  app2:
    build: .
    networks:
      - default
      - traefik-proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app2.rule=Host(`app2.votre-domaine.com`)"
      - "traefik.http.routers.app2.entrypoints=websecure"
      - "traefik.http.routers.app2.tls.certresolver=letsencrypt"
      - "traefik.http.services.app2.loadbalancer.server.port=3000"

networks:
  traefik-proxy:
    name: traefik-proxy
    external: true
```

Démarrer : `docker compose up -d` — Traefik détecte automatiquement le nouveau conteneur et génère le SSL.

---

## 10. Sécuriser l'installation

### 10.1 Pare-feu UFW

```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable
```

> Ne **pas** ouvrir le port 3306 (MySQL) publiquement.

### 10.2 Désactiver la connexion SSH par mot de passe (recommandé)

```bash
# D'abord ajouter votre clé publique SSH
# Puis éditer :
nano /etc/ssh/sshd_config
# Mettre : PasswordAuthentication no
systemctl restart sshd
```

### 10.3 Changer le mot de passe MySQL

Si vous voulez changer le mot de passe MySQL après installation :

```bash
docker exec -it ageo-mysql mysql -u root -pANCIEN_MDP -e "ALTER USER 'root'@'%' IDENTIFIED BY 'NOUVEAU_MDP';"
# Puis mettre à jour DB_PASSWORD dans docker-compose.yml et redémarrer :
docker compose up -d
```

---

## 11. Sauvegardes automatiques

### 11.1 Sauvegarde manuelle

```bash
# Exporter la base de données
docker exec ageo-mysql mysqldump -u root -pVOTRE_MDP ageo > /opt/backups/ageo_$(date +%Y-%m-%d_%H%M).sql

# Sauvegarder les uploads
tar -czf /opt/backups/uploads_$(date +%Y-%m-%d).tar.gz /opt/ageo/server/uploads/
```

### 11.2 Sauvegarde automatique (cron)

```bash
crontab -e
```

Ajouter :

```cron
# Sauvegarde quotidienne à 3h du matin
0 3 * * * docker exec ageo-mysql mysqldump -u root -pVOTRE_MDP ageo > /opt/backups/ageo_$(date +\%Y-\%m-\%d).sql && find /opt/backups -name "ageo_*.sql" -mtime +30 -delete
```

---

## 12. Mise à jour de l'application

```bash
cd /opt/ageo

# Si Git
git pull

# Reconstruire et redémarrer
docker compose up -d --build
```

> Les données MySQL et les uploads sont conservés (volumes Docker persistants).

---

## 13. Commandes utiles

| Action                             | Commande                                                      |
| ---------------------------------- | ------------------------------------------------------------- |
| Voir les logs app                  | `docker compose logs -f app`                                |
| Voir les logs MySQL                | `docker compose logs -f mysql`                              |
| Voir les logs Traefik              | `cd /opt/traefik && docker compose logs -f traefik`        |
| Redémarrer l'app                  | `docker compose restart app`                                |
| Redémarrer Traefik                | `cd /opt/traefik && docker compose restart traefik`        |
| Arrêter tout                      | `docker compose down`                                       |
| Arrêter + supprimer données      | `docker compose down -v`                                    |
| Statut des conteneurs              | `docker compose ps`                                         |
| Accéder au shell du conteneur app | `docker exec -it ageo-app sh`                               |
| Accéder à MySQL                  | `docker exec -it ageo-mysql mysql -u root -pVOTRE_MDP ageo` |

---

## 14. En cas de problème

### L'app ne démarre pas

```bash
docker compose logs app
```

Vérifier :

- MySQL est bien démarré : `docker compose ps mysql`
- Les variables d'environnement sont correctes dans `docker-compose.yml`
- Le port 80 n'est pas déjà utilisé : `ss -tlnp | grep :80`
- Le port 443 n'est pas déjà utilisé : `ss -tlnp | grep :443`
- Traefik est bien démarré : `cd /opt/traefik && docker compose ps`
- Le domaine pointe bien vers le VPS : `dig ageo.votre-domaine.com`

### Erreur de connexion MySQL

```bash
# Tester la connexion MySQL
docker exec ageo-mysql mysql -u root -pVOTRE_MDP -e "SHOW DATABASES;"
```

### Réinitialiser complètement la base

```bash
docker compose down -v          # supprime les volumes (perte de données !)
docker compose up -d --build    # recrée tout
```

---

## Résumé express

```bash
# 1. SSH
ssh root@IP_DU_VPS

# 2. Docker
curl -fsSL https://get.docker.com | sh

# 3. Projet
cd /opt && git clone VOTRE_REPO ageo && cd ageo

# 4. Traefik (reverse proxy + SSL auto)
docker network create traefik-proxy
mkdir -p /opt/traefik/{dynamic,letsencrypt}
cp traefik/docker-compose.yml /opt/traefik/
cp traefik/dynamic/dynamic.yml /opt/traefik/dynamic/
nano /opt/traefik/docker-compose.yml   # email + domaine
cd /opt/traefik && docker compose up -d

# 5. Configurer AGEO
cd /opt/ageo
nano docker-compose.yml   # domaine + JWT_SECRET + mots de passe

# 6. Démarrer
docker compose up -d --build

# 7. Accéder
https://ageo.votre-domaine.com
```
