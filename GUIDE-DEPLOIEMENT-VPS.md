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

> Le port 3001 n'a **pas besoin** d'être ouvert — Nginx fait le proxy en interne.

---

## 3. Transférer le projet sur le VPS

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

## 4. Configurer les variables d'environnement

Éditer le fichier `docker-compose.yml` sur le VPS :

```bash
nano /opt/ageo/docker-compose.yml
```

Changer les valeurs suivantes dans la section `app.environment` :

| Variable | Valeur | Description |
|---|---|---|
| `JWT_SECRET` | Une chaîne aléatoire longue | Clé de signature des tokens JWT |
| `LICENCE_SECRET` | Votre secret de licence | Déjà défini, conservez-le |
| `LICENCE_KEY` | Votre clé de licence | Laissez vide pour le mode interne |
| `DB_PASSWORD` | Mot de passe MySQL fort | Doit correspondre à `MYSQL_ROOT_PASSWORD` |

Changer également dans la section `mysql.environment` :

| Variable | Valeur |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Le même mot de passe que `DB_PASSWORD` |

> **Important** : Générez un `JWT_SECRET` aléatoire :
> ```bash
> openssl rand -hex 32
> ```

---

## 5. Construire et démarrer l'application

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

Nginx est également démarré et proxy les requêtes vers l'app.

---

## 6. Tester l'accès

Depuis un navigateur : `http://IP_DU_VPS` (port 80, via Nginx)

- **Email** : `admin@entreprise.com`
- **Mot de passe** : `admin1234`

> ⚠️ **Changez immédiatement le mot de passe admin** après la première connexion (Paramètres → Sécurité).

---

## 7. Configurer le HTTPS (optionnel, recommandé)

Nginx est déjà inclus dans la stack Docker et sert l'app sur le port 80.
Pour activer HTTPS :

### 7.1 Obtenir des certificats SSL

**Avec Let's Encrypt (gratuit) :**

```bash
# Installer certbot
apt install -y certbot

# Générer le certificat (arrêter temporairement Nginx pour libérer le port 80)
docker compose stop nginx
certbot certonly --standalone -d votre-domaine.com
docker compose start nginx

# Copier les certificats dans le dossier nginx/certs/
cp /etc/letsencrypt/live/votre-domaine.com/fullchain.pem /opt/ageo/nginx/certs/
cp /etc/letsencrypt/live/votre-domaine.com/privkey.pem /opt/ageo/nginx/certs/
```

**Ou auto-signé (pour test) :**

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/ageo/nginx/certs/privkey.pem -out /opt/ageo/nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

### 7.2 Activer le HTTPS dans la config Nginx

```bash
nano /opt/ageo/nginx/nginx.conf
```

- Décommentez le bloc `server` HTTPS (port 443) à la fin du fichier
- Décommentez la ligne `return 301 https://...` dans le bloc HTTP pour forcer la redirection
- Remplacez `votre-domaine.com` par votre domaine réel

### 7.3 Redémarrer Nginx

```bash
docker compose restart nginx
```

L'app est maintenant accessible sur `https://votre-domaine.com`.

### 7.4 Renouvellement automatique Let's Encrypt

```bash
crontab -e
```

Ajouter :
```cron
# Renouvellement mensuel du certificat
0 3 1 * * certbot renew --deploy-hook "cp /etc/letsencrypt/live/votre-domaine.com/*.pem /opt/ageo/nginx/certs/ && docker compose -f /opt/ageo/docker-compose.yml restart nginx"
```

---

## 8. Sécuriser l'installation

### 8.1 Pare-feu UFW

```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable
```

> Ne **pas** ouvrir le port 3306 (MySQL) publiquement.

### 8.2 Désactiver la connexion SSH par mot de passe (recommandé)

```bash
# D'abord ajouter votre clé publique SSH
# Puis éditer :
nano /etc/ssh/sshd_config
# Mettre : PasswordAuthentication no
systemctl restart sshd
```

### 8.3 Changer le mot de passe MySQL

Si vous voulez changer le mot de passe MySQL après installation :

```bash
docker exec -it ageo-mysql mysql -u root -pANCIEN_MDP -e "ALTER USER 'root'@'%' IDENTIFIED BY 'NOUVEAU_MDP';"
# Puis mettre à jour DB_PASSWORD dans docker-compose.yml et redémarrer :
docker compose up -d
```

---

## 9. Sauvegardes automatiques

### 9.1 Sauvegarde manuelle

```bash
# Exporter la base de données
docker exec ageo-mysql mysqldump -u root -pVOTRE_MDP ageo > /opt/backups/ageo_$(date +%Y-%m-%d_%H%M).sql

# Sauvegarder les uploads
tar -czf /opt/backups/uploads_$(date +%Y-%m-%d).tar.gz /opt/ageo/server/uploads/
```

### 9.2 Sauvegarde automatique (cron)

```bash
crontab -e
```

Ajouter :

```cron
# Sauvegarde quotidienne à 3h du matin
0 3 * * * docker exec ageo-mysql mysqldump -u root -pVOTRE_MDP ageo > /opt/backups/ageo_$(date +\%Y-\%m-\%d).sql && find /opt/backups -name "ageo_*.sql" -mtime +30 -delete
```

---

## 10. Mise à jour de l'application

```bash
cd /opt/ageo

# Si Git
git pull

# Reconstruire et redémarrer
docker compose up -d --build
```

> Les données MySQL et les uploads sont conservés (volumes Docker persistants).

---

## 11. Commandes utiles

| Action | Commande |
|---|---|
| Voir les logs app | `docker compose logs -f app` |
| Voir les logs MySQL | `docker compose logs -f mysql` |
| Voir les logs Nginx | `docker compose logs -f nginx` |
| Redémarrer l'app | `docker compose restart app` |
| Redémarrer Nginx | `docker compose restart nginx` |
| Arrêter tout | `docker compose down` |
| Arrêter + supprimer données | `docker compose down -v` |
| Statut des conteneurs | `docker compose ps` |
| Accéder au shell du conteneur app | `docker exec -it ageo-app sh` |
| Accéder à MySQL | `docker exec -it ageo-mysql mysql -u root -pVOTRE_MDP ageo` |

---

## 12. En cas de problème

### L'app ne démarre pas

```bash
docker compose logs app
```

Vérifier :
- MySQL est bien démarré : `docker compose ps mysql`
- Les variables d'environnement sont correctes dans `docker-compose.yml`
- Le port 80 n'est pas déjà utilisé : `ss -tlnp | grep :80`
- Le port 3001 n'est pas déjà utilisé : `ss -tlnp | grep 3001`

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

# 4. Configurer
nano docker-compose.yml   # changer JWT_SECRET, mots de passe

# 5. Démarrer
docker compose up -d --build

# 6. Tester
curl http://localhost/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@entreprise.com","password":"admin1234"}'

# 7. Accéder
http://IP_DU_VPS
```
