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

### 2.4 Ouvrir le port 3001 dans le pare-feu Hostinger

Dans le panel Hostinger → **VPS → Pare-feu / Security** :
- Ajouter une règle TCP **port 3001** (ou configurer un reverse proxy Nginx sur le port 80/443, voir section 8).

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
```

---

## 6. Tester l'accès

Depuis un navigateur : `http://IP_DU_VPS:3001`

- **Email** : `admin@entreprise.com`
- **Mot de passe** : `admin1234`

> ⚠️ **Changez immédiatement le mot de passe admin** après la première connexion (Paramètres → Sécurité).

---

## 7. Configurer le HTTPS avec Nginx (recommandé)

### 7.1 Installer Nginx

```bash
apt install -y nginx
```

### 7.2 Créer la configuration du site

```bash
nano /etc/nginx/sites-available/ageo
```

Contenu :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;  # ou l'IP du VPS

    client_max_body_size 50M;  # Pour les uploads (photos, documents)

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7.3 Activer le site

```bash
ln -s /etc/nginx/sites-available/ageo /etc/nginx/sites-enabled/
nginx -t          # tester la configuration
systemctl reload nginx
```

L'app est maintenant accessible sur `http://votre-domaine.com` (port 80 au lieu de 3001).

### 7.4 Activer HTTPS avec Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d votre-domaine.com
```

Certbot configure automatiquement le HTTPS et le renouvellement du certificat.

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
| Voir les logs | `docker compose logs -f app` |
| Voir les logs MySQL | `docker compose logs -f mysql` |
| Redémarrer l'app | `docker compose restart app` |
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
curl http://localhost:3001/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"admin@entreprise.com","password":"admin1234"}'

# 7. Accéder
http://IP_DU_VPS:3001
```
