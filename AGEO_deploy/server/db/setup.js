'use strict'
const bcrypt = require('bcryptjs')
const sql = require('mssql')
const db = require('./database')

// ── Création de la base si absente (utile pour Docker / première install) ────

async function ensureDatabase() {
  const masterConfig = {
    server:   process.env.DB_SERVER   || 'localhost',
    database: 'master',
    user:     process.env.DB_USER     || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt:                process.env.DB_ENCRYPT    !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    },
  }
  if (process.env.DB_PORT) {
    masterConfig.port = parseInt(process.env.DB_PORT)
    masterConfig.server = (masterConfig.server || '').split('\\')[0]
  }
  const dbName = process.env.DB_NAME || 'ageo'
  let pool
  try {
    pool = new sql.ConnectionPool(masterConfig)
    await pool.connect()
    const result = await pool.request()
      .input('name', sql.NVarChar, dbName)
      .query('SELECT name FROM sys.databases WHERE name = @name')
    if (result.recordset.length === 0) {
      await pool.request().query(`CREATE DATABASE [${dbName}]`)
      console.log(`[AGEO] Base de données '${dbName}' créée`)
    }
  } finally {
    if (pool) await pool.close()
  }
}

// ── Création des tables (idempotente) ─────────────────────────────────────────

async function createTables() {
  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'categories')
    BEGIN
      CREATE TABLE categories (
        id  INT IDENTITY(1,1) PRIMARY KEY,
        nom NVARCHAR(255) NOT NULL,
        CONSTRAINT UQ_categories_nom UNIQUE (nom)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'clients')
    BEGIN
      CREATE TABLE clients (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        code       NVARCHAR(50)  NOT NULL,
        nom        NVARCHAR(255) NOT NULL,
        email      NVARCHAR(255),
        telephone  NVARCHAR(50),
        adresse    NVARCHAR(MAX),
        ville      NVARCHAR(100),
        actif      INT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_clients_code UNIQUE (code)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'produits')
    BEGIN
      CREATE TABLE produits (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        code         NVARCHAR(50)  NOT NULL,
        nom          NVARCHAR(255) NOT NULL,
        description  NVARCHAR(MAX),
        categorie_id INT,
        prix_ht      FLOAT NOT NULL DEFAULT 0,
        tva          FLOAT DEFAULT 20,
        stock        INT   DEFAULT 0,
        stock_min    INT   DEFAULT 5,
        actif        INT   DEFAULT 1,
        created_at   DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_produits_code UNIQUE (code),
        CONSTRAINT fk_produits_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commandes')
    BEGIN
      CREATE TABLE commandes (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        numero         NVARCHAR(50) NOT NULL,
        client_id      INT NOT NULL,
        date_commande  DATE DEFAULT CAST(GETDATE() AS DATE),
        date_livraison DATE,
        statut         NVARCHAR(50) DEFAULT 'en_attente',
        notes          NVARCHAR(MAX),
        created_at     DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_commandes_numero UNIQUE (numero),
        CONSTRAINT fk_commandes_client FOREIGN KEY (client_id) REFERENCES clients(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'lignes_commande')
    BEGIN
      CREATE TABLE lignes_commande (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        commande_id   INT   NOT NULL,
        produit_id    INT   NOT NULL,
        quantite      INT   NOT NULL DEFAULT 1,
        prix_unitaire FLOAT NOT NULL,
        remise        FLOAT DEFAULT 0,
        CONSTRAINT fk_lc_commande FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
        CONSTRAINT fk_lc_produit  FOREIGN KEY (produit_id)  REFERENCES produits(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
    BEGIN
      CREATE TABLE users (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        username      NVARCHAR(100) NOT NULL,
        nom           NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(MAX) NOT NULL,
        role          NVARCHAR(50)  NOT NULL DEFAULT 'user',
        actif         INT NOT NULL DEFAULT 1,
        permissions   NVARCHAR(MAX),
        last_login    DATETIME,
        created_at    DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_users_username UNIQUE (username)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions_caisse')
    BEGIN
      CREATE TABLE sessions_caisse (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        date_ouverture    DATETIME DEFAULT GETDATE(),
        date_fermeture    DATETIME,
        montant_ouverture FLOAT DEFAULT 0,
        montant_fermeture FLOAT,
        statut            NVARCHAR(20) DEFAULT 'ouverte',
        notes             NVARCHAR(MAX),
        created_at        DATETIME DEFAULT GETDATE()
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions_caisse')
    BEGIN
      CREATE TABLE transactions_caisse (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        session_id       INT NOT NULL,
        date_transaction DATETIME DEFAULT GETDATE(),
        montant          FLOAT NOT NULL,
        mode_paiement    NVARCHAR(50) DEFAULT 'especes',
        reference        NVARCHAR(MAX),
        notes            NVARCHAR(MAX),
        produits         NVARCHAR(MAX),
        type             NVARCHAR(20) DEFAULT 'encaissement',
        facture_id       INT,
        CONSTRAINT fk_tc_session FOREIGN KEY (session_id) REFERENCES sessions_caisse(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'factures')
    BEGIN
      CREATE TABLE factures (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        numero        NVARCHAR(50) NOT NULL,
        client_id     INT,
        commande_id   INT,
        date_emission DATE DEFAULT CAST(GETDATE() AS DATE),
        date_echeance DATE,
        statut        NVARCHAR(20) DEFAULT 'brouillon',
        total_ht      FLOAT DEFAULT 0,
        taux_tva      FLOAT DEFAULT 0,
        total_ttc     FLOAT DEFAULT 0,
        montant_paye  FLOAT DEFAULT 0,
        notes         NVARCHAR(MAX),
        created_at    DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_factures_numero UNIQUE (numero),
        CONSTRAINT fk_factures_client   FOREIGN KEY (client_id)   REFERENCES clients(id),
        CONSTRAINT fk_factures_commande FOREIGN KEY (commande_id) REFERENCES commandes(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'lignes_facture')
    BEGIN
      CREATE TABLE lignes_facture (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        facture_id    INT   NOT NULL,
        description   NVARCHAR(MAX) NOT NULL,
        quantite      FLOAT DEFAULT 1,
        prix_unitaire FLOAT DEFAULT 0,
        remise        FLOAT DEFAULT 0,
        total         FLOAT DEFAULT 0,
        CONSTRAINT fk_lf_facture FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
      )
    END
  `)

  // Contrats & abonnements clients
  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'contrats')
    BEGIN
      CREATE TABLE contrats (
        id                 INT IDENTITY(1,1) PRIMARY KEY,
        reference          NVARCHAR(50)  NOT NULL,
        client_id          INT NOT NULL,
        type               NVARCHAR(20)  DEFAULT 'contrat',   -- contrat | abonnement
        intitule           NVARCHAR(255) NOT NULL,
        montant            FLOAT DEFAULT 0,
        periodicite        NVARCHAR(20)  DEFAULT 'mensuel',   -- mensuel|trimestriel|semestriel|annuel|unique
        date_debut         DATE DEFAULT CAST(GETDATE() AS DATE),
        date_fin           DATE,
        prochaine_echeance DATE,
        jours_relance      INT DEFAULT 7,
        statut             NVARCHAR(20)  DEFAULT 'actif',     -- actif|suspendu|termine|resilie
        notes              NVARCHAR(MAX),
        created_at         DATETIME DEFAULT GETDATE(),
        updated_at         DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_contrats_reference UNIQUE (reference),
        CONSTRAINT fk_contrats_client FOREIGN KEY (client_id) REFERENCES clients(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'contrats_paiements')
    BEGIN
      CREATE TABLE contrats_paiements (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        contrat_id    INT NOT NULL,
        montant       FLOAT DEFAULT 0,
        date_paiement DATE DEFAULT CAST(GETDATE() AS DATE),
        mode          NVARCHAR(50),
        notes         NVARCHAR(MAX),
        created_at    DATETIME DEFAULT GETDATE(),
        CONSTRAINT fk_cp_contrat FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE CASCADE
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'parametres')
    BEGIN
      CREATE TABLE parametres (
        cle    NVARCHAR(100) PRIMARY KEY,
        valeur NVARCHAR(MAX)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'departements')
    BEGIN
      CREATE TABLE departements (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        nom        NVARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_departements_nom UNIQUE (nom)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'employes')
    BEGIN
      CREATE TABLE employes (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        matricule     NVARCHAR(50)  NOT NULL,
        nom           NVARCHAR(255) NOT NULL,
        prenom        NVARCHAR(255),
        poste         NVARCHAR(255),
        departement   NVARCHAR(100),
        telephone     NVARCHAR(50),
        email         NVARCHAR(255),
        date_embauche DATE,
        salaire       FLOAT DEFAULT 0,
        actif         INT NOT NULL DEFAULT 1,
        created_at    DATETIME DEFAULT GETDATE(),
        updated_at    DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_employes_matricule UNIQUE (matricule)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'conges')
    BEGIN
      CREATE TABLE conges (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        employe_id  INT NOT NULL,
        type        NVARCHAR(50)  NOT NULL DEFAULT 'conge_paye',
        date_debut  DATE NOT NULL,
        date_fin    DATE NOT NULL,
        nb_jours    INT,
        motif       NVARCHAR(MAX),
        statut      NVARCHAR(20) NOT NULL DEFAULT 'en_attente',
        notes       NVARCHAR(MAX),
        created_at  DATETIME DEFAULT GETDATE(),
        CONSTRAINT fk_conges_employe FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE CASCADE
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bulletins_paie')
    BEGIN
      CREATE TABLE bulletins_paie (
        id                        INT IDENTITY(1,1) PRIMARY KEY,
        employe_id                INT NOT NULL,
        mois                      NVARCHAR(7) NOT NULL,
        salaire_base              FLOAT DEFAULT 0,
        primes                    FLOAT DEFAULT 0,
        deductions                FLOAT DEFAULT 0,
        net                       FLOAT DEFAULT 0,
        prime_rendement           FLOAT DEFAULT 0,
        prime_anciennete          FLOAT DEFAULT 0,
        autres_primes             FLOAT DEFAULT 0,
        autres_primes_libelle     NVARCHAR(255),
        avance_salaire            FLOAT DEFAULT 0,
        retenue_absence           FLOAT DEFAULT 0,
        nb_jours_absence          INT DEFAULT 0,
        autres_deductions         FLOAT DEFAULT 0,
        autres_deductions_libelle NVARCHAR(255),
        statut                    NVARCHAR(20) NOT NULL DEFAULT 'en_attente',
        date_paiement             DATE,
        notes                     NVARCHAR(MAX),
        created_at                DATETIME DEFAULT GETDATE(),
        CONSTRAINT UQ_bulletin_employe_mois UNIQUE (employe_id, mois),
        CONSTRAINT fk_bp_employe FOREIGN KEY (employe_id) REFERENCES employes(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'documents_employes')
    BEGIN
      CREATE TABLE documents_employes (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        employe_id   INT NOT NULL,
        nom_fichier  NVARCHAR(255) NOT NULL,
        nom_original NVARCHAR(255) NOT NULL,
        type_mime    NVARCHAR(100),
        taille       INT,
        categorie    NVARCHAR(50) NOT NULL DEFAULT 'autre',
        created_at   DATETIME DEFAULT GETDATE(),
        CONSTRAINT fk_docs_employe FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE CASCADE
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'journal_activites')
    BEGIN
      CREATE TABLE journal_activites (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        date_action     DATETIME DEFAULT GETDATE(),
        utilisateur_id  INT,
        utilisateur_nom NVARCHAR(150),
        module          NVARCHAR(50)  NOT NULL,
        action          NVARCHAR(50)  NOT NULL,
        description     NVARCHAR(MAX),
        details         NVARCHAR(MAX),
        ip              NVARCHAR(45)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'petite_caisse')
    BEGIN
      CREATE TABLE petite_caisse (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        nom          NVARCHAR(100) NOT NULL DEFAULT 'Petite Caisse',
        solde        FLOAT DEFAULT 0,
        plafond      FLOAT DEFAULT 0,
        actif        INT NOT NULL DEFAULT 1,
        created_at   DATETIME DEFAULT GETDATE(),
        updated_at   DATETIME DEFAULT GETDATE()
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions_petite_caisse')
    BEGIN
      CREATE TABLE transactions_petite_caisse (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        petite_caisse_id INT NOT NULL,
        date_transaction DATETIME DEFAULT GETDATE(),
        montant          FLOAT NOT NULL,
        type             NVARCHAR(20) NOT NULL DEFAULT 'depense',
        categorie        NVARCHAR(100),
        beneficiaire     NVARCHAR(255),
        reference        NVARCHAR(MAX),
        notes            NVARCHAR(MAX),
        session_caisse_id INT,
        created_at       DATETIME DEFAULT GETDATE(),
        CONSTRAINT fk_tpc_pc FOREIGN KEY (petite_caisse_id) REFERENCES petite_caisse(id) ON DELETE CASCADE,
        CONSTRAINT fk_tpc_session FOREIGN KEY (session_caisse_id) REFERENCES sessions_caisse(id)
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'rapports_employes')
    BEGIN
      CREATE TABLE rapports_employes (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NOT NULL,
        employe_nom     NVARCHAR(150) NOT NULL,
        titre           NVARCHAR(255) NOT NULL,
        periode         NVARCHAR(100),
        description     NVARCHAR(MAX),
        nom_fichier     NVARCHAR(255) NOT NULL,
        nom_original    NVARCHAR(255) NOT NULL,
        type_mime       NVARCHAR(100),
        taille          BIGINT DEFAULT 0,
        date_upload     DATETIME DEFAULT GETDATE(),
        lu_admin        INT DEFAULT 0,
        date_lecture    DATETIME
      )
    END
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_re_user' AND object_id = OBJECT_ID('rapports_employes'))
      CREATE INDEX idx_re_user ON rapports_employes (user_id)
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_tpc_date' AND object_id = OBJECT_ID('transactions_petite_caisse'))
      CREATE INDEX idx_tpc_date ON transactions_petite_caisse (date_transaction)
  `)

  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_journal_date' AND object_id = OBJECT_ID('journal_activites'))
      CREATE INDEX idx_journal_date ON journal_activites (date_action)
  `)
  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_journal_module' AND object_id = OBJECT_ID('journal_activites'))
      CREATE INDEX idx_journal_module ON journal_activites (module)
  `)
  await db.exec(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_journal_user' AND object_id = OBJECT_ID('journal_activites'))
      CREATE INDEX idx_journal_user ON journal_activites (utilisateur_id)
  `)
}

// ── Migrations (colonnes ajoutées progressivement) ───────────────────────────

async function addColIfMissing(table, col, type) {
  const exists = await db.getOne(
    'SELECT 1 AS found FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col],
  )
  if (!exists) {
    await db.exec(`ALTER TABLE [${table}] ADD [${col}] ${type}`)
  }
}

async function runMigrations() {
  // Départements par défaut
  const { n } = await db.getOne('SELECT COUNT(*) AS n FROM departements')
  if (n === 0) {
    for (const nom of ['Direction', 'Finance', 'Commercial', 'Technique', 'RH', 'Logistique', 'Informatique', 'Juridique']) {
      await db.exec(`INSERT INTO departements (nom) VALUES ('${nom}')`)
    }
    console.log('[AGEO] Migration : départements par défaut insérés')
  }

  // Petite caisse par défaut
  const { npc } = await db.getOne('SELECT COUNT(*) AS npc FROM petite_caisse')
  if (npc === 0) {
    await db.exec(`INSERT INTO petite_caisse (nom, solde, plafond, actif) VALUES ('Petite Caisse', 0, 50000, 1)`)
    console.log('[AGEO] Migration : petite caisse par défaut créée')
  }

  // Colonnes bulletins_paie (déjà dans CREATE TABLE, mais on garde pour bases existantes)
  for (const [col, type] of [
    ['prime_rendement',           'FLOAT DEFAULT 0'],
    ['prime_anciennete',          'FLOAT DEFAULT 0'],
    ['autres_primes',             'FLOAT DEFAULT 0'],
    ['autres_primes_libelle',     'NVARCHAR(255)'],
    ['avance_salaire',            'FLOAT DEFAULT 0'],
    ['retenue_absence',           'FLOAT DEFAULT 0'],
    ['nb_jours_absence',          'INT DEFAULT 0'],
    ['autres_deductions',         'FLOAT DEFAULT 0'],
    ['autres_deductions_libelle', 'NVARCHAR(255)'],
  ]) {
    await addColIfMissing('bulletins_paie', col, type)
  }

  // Colonnes diverses
  await addColIfMissing('users',               'permissions',  'NVARCHAR(MAX) NULL')
  await addColIfMissing('transactions_caisse', 'type',         "NVARCHAR(20) DEFAULT 'encaissement'")
  await addColIfMissing('transactions_caisse', 'facture_id',   'INT NULL')
  await addColIfMissing('factures',            'montant_paye', 'FLOAT DEFAULT 0')
  await addColIfMissing('clients',             'type',         "NVARCHAR(20) DEFAULT 'client'")
  await addColIfMissing('commandes',           'statut_paiement', "NVARCHAR(20) DEFAULT 'impayee'")
  await addColIfMissing('transactions_caisse', 'commande_id',  'INT NULL')

  // Colonnes documents (bon de livraison / facture proforma / facture définitive)
  for (const [col, type] of [
    ['type_document',        "NVARCHAR(30) DEFAULT 'facture_definitive'"],
    ['client_nom_libre',     'NVARCHAR(255) NULL'],
    ['client_adresse_libre', 'NVARCHAR(MAX) NULL'],
    ['objet',                'NVARCHAR(MAX) NULL'],
    ['signature_auto',       'INT DEFAULT 0'],
    ['conditions_reglement', 'NVARCHAR(255) NULL'],
    ['mode_reglement',       'NVARCHAR(100) NULL'],
    ['delai_livraison',      'NVARCHAR(100) NULL'],
    ['duree_garantie',       'NVARCHAR(100) NULL'],
    ['montant_tva',          'FLOAT DEFAULT 0'],
    ['remise_globale',       'FLOAT DEFAULT 0'],
    ['avance',               'FLOAT DEFAULT 0'],
    ['reste_a_payer',        'FLOAT DEFAULT 0'],
  ]) {
    await addColIfMissing('factures', col, type)
  }
  for (const [col, type] of [
    ['reference',     'NVARCHAR(100) NULL'],
    ['qte_commandee', 'FLOAT DEFAULT 0'],
    ['qte_livree',    'FLOAT DEFAULT 0'],
    ['main_oeuvre',   'FLOAT DEFAULT 0'],
  ]) {
    await addColIfMissing('lignes_facture', col, type)
  }

  // Premier admin → super_admin
  const hasSA = await db.getOne("SELECT id FROM users WHERE role = 'super_admin'")
  if (!hasSA) {
    const firstAdmin = await db.getOne("SELECT TOP (1) id FROM users WHERE role = 'admin' ORDER BY id")
    if (firstAdmin) {
      await db.run("UPDATE users SET role = 'super_admin' WHERE id = ?", [firstAdmin.id])
      console.log('[AGEO] Migration : premier administrateur promu super administrateur')
    }
  }

  // Colonne poste pour les utilisateurs (comptable, caissier, commercial, etc.)
  await addColIfMissing('users', 'poste', "NVARCHAR(50) NULL")
}

// ── Données de démonstration ──────────────────────────────────────────────────

async function seedData() {
  const { n } = await db.getOne('SELECT COUNT(*) AS n FROM users')
  if (n > 0) return

  const hash = bcrypt.hashSync('admin1234', 10)
  await db.run(
    "INSERT INTO users (username, nom, password_hash, role) VALUES (?, ?, ?, 'super_admin')",
    ['admin', 'Administrateur', hash],
  )
  console.log('[AGEO] Compte super_admin créé → identifiant: admin / mot de passe: admin1234')

  const { cnt } = await db.getOne('SELECT COUNT(*) AS cnt FROM clients')
  if (cnt > 0) return

  console.log('[AGEO] Initialisation des données de démonstration...')

  for (const nom of ['Informatique', 'Bureautique', 'Mobilier', 'Fournitures', 'Services']) {
    await db.run('INSERT INTO categories (nom) VALUES (?)', [nom])
  }

  const catRows = await db.getAll('SELECT id, nom FROM categories')
  const catIds  = Object.fromEntries(catRows.map((r) => [r.nom, r.id]))

  const clients = [
    ['CLT-001', 'Tech Solutions SA',  'contact@techsolutions.fr',  '01 23 45 67 89', '12 rue de la Paix',     'Paris'],
    ['CLT-002', 'Bureau Plus SARL',   'info@bureauplus.fr',        '02 34 56 78 90', '45 avenue Victor Hugo', 'Lyon'],
    ['CLT-003', 'InfoSys Corp',       'admin@infosys.fr',          '03 45 67 89 01', '8 rue des Lilas',       'Marseille'],
    ['CLT-004', 'Digital Agency',     'hello@digitalagency.fr',    '04 56 78 90 12', '23 bd Haussmann',       'Paris'],
    ['CLT-005', 'MédiaGroup SA',      'contact@mediagroup.fr',     '05 67 89 01 23', '17 rue Gambetta',       'Bordeaux'],
    ['CLT-006', 'FormaTech SARL',     'info@formatech.fr',         '01 78 90 12 34', '56 avenue de la Gare',  'Nantes'],
    ['CLT-007', 'ConseilPro',         'contact@conseilpro.fr',     '02 89 01 23 45', '3 impasse des Fleurs',  'Toulouse'],
    ['CLT-008', 'DataCorp SA',        'admin@datacorp.fr',         '03 90 12 34 56', '99 rue de la République','Strasbourg'],
    ['CLT-009', 'WebFactory',         'hello@webfactory.fr',       '04 01 23 45 67', '14 allée des Roses',    'Lille'],
    ['CLT-010', 'CloudSoft SARL',     'info@cloudsoft.fr',         '05 12 34 56 78', '78 rue du Port',        'Nice'],
  ]
  for (const [code, nom, email, telephone, adresse, ville] of clients) {
    await db.run(
      'INSERT INTO clients (code, nom, email, telephone, adresse, ville) VALUES (?, ?, ?, ?, ?, ?)',
      [code, nom, email, telephone, adresse, ville],
    )
  }

  const produits = [
    ['PRD-001','Ordinateur Portable Pro',        'Intel i7, 16 Go RAM, SSD 512 Go',           catIds['Informatique'],  899.00,20, 25,5],
    ['PRD-002','Souris sans fil ergonomique',    'Bluetooth 5.0, 3 boutons programmables',    catIds['Informatique'],   29.90,20, 80,10],
    ['PRD-003','Clavier mécanique rétroéclairé', 'Switches Cherry MX Red',                    catIds['Informatique'],   89.00,20, 45,8],
    ['PRD-004','Écran 27" 4K IPS',               '144 Hz, HDR400, HDMI + DisplayPort',        catIds['Informatique'],  449.00,20, 18,4],
    ['PRD-005','Imprimante laser couleur',        'Recto-verso auto, Wi-Fi, A4',               catIds['Bureautique'],   349.00,20, 12,3],
    ['PRD-006','Chaise ergonomique',              'Réglable, soutien lombaire ajustable',      catIds['Mobilier'],      299.00,20, 20,5],
    ['PRD-007','Bureau assis-debout électrique',  'Plateau 140×70 cm, finition chêne',         catIds['Mobilier'],      599.00,20,  8,2],
    ['PRD-008','Rame papier A4 500 feuilles',     '80 g/m², blanc extra',                      catIds['Fournitures'],     4.90,20,200,20],
    ['PRD-009','Stylos bille lot de 10',           'Bleu, pointe fine 0,7 mm',                  catIds['Fournitures'],    3.50,20,150,15],
    ['PRD-010','Formation Microsoft 365',          '2 jours en présentiel, certifiante',        catIds['Services'],      490.00,20,999,0],
    ['PRD-011','Contrat maintenance poste',        'Contrat annuel par poste de travail',       catIds['Services'],      199.00,20,999,0],
    ['PRD-012','Serveur NAS 4 baies',              '8 To, RAID 5, accès réseau Gigabit',       catIds['Informatique'],  799.00,20,  6,2],
    ['PRD-013','Webcam HD 1080p',                  'Microphone intégré, USB-C, 30 FPS',        catIds['Informatique'],   59.90,20, 35,8],
    ['PRD-014','Casque audio sans fil',            'Réduction de bruit active, 30 h autonomie',catIds['Informatique'],  149.00,20, 22,5],
    ['PRD-015','Carnet A4 200 pages',              '200 pages, ligné, couverture souple',      catIds['Fournitures'],     5.90,20,120,10],
  ]
  for (const [code, nom, description, categorie_id, prix_ht, tva, stock, stock_min] of produits) {
    await db.run(
      'INSERT INTO produits (code, nom, description, categorie_id, prix_ht, tva, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [code, nom, description, categorie_id, prix_ht, tva, stock, stock_min],
    )
  }

  const cmdData = [
    { num:'CMD-001', client:1, date:'2026-06-25', statut:'livree',     lignes:[[1,2,899,0],[2,3,29.9,5]] },
    { num:'CMD-002', client:2, date:'2026-06-25', statut:'en_cours',   lignes:[[5,1,349,10]] },
    { num:'CMD-003', client:3, date:'2026-06-24', statut:'en_attente', lignes:[[4,2,449,0],[13,5,59.9,0]] },
    { num:'CMD-004', client:4, date:'2026-06-24', statut:'livree',     lignes:[[2,10,29.9,5],[3,2,89,0]] },
    { num:'CMD-005', client:5, date:'2026-06-23', statut:'annulee',    lignes:[[6,3,299,0]] },
    { num:'CMD-006', client:1, date:'2026-06-22', statut:'livree',     lignes:[[12,1,799,0]] },
    { num:'CMD-007', client:6, date:'2026-06-21', statut:'livree',     lignes:[[10,5,490,0]] },
    { num:'CMD-008', client:7, date:'2026-06-20', statut:'livree',     lignes:[[11,3,199,0]] },
    { num:'CMD-009', client:3, date:'2026-06-19', statut:'en_cours',   lignes:[[1,5,899,5]] },
    { num:'CMD-010', client:8, date:'2026-06-18', statut:'livree',     lignes:[[7,2,599,0]] },
    { num:'CMD-011', client:9, date:'2026-05-30', statut:'livree',     lignes:[[4,1,449,0],[14,2,149,0]] },
    { num:'CMD-012', client:2, date:'2026-05-20', statut:'livree',     lignes:[[8,50,4.9,0],[9,20,3.5,0]] },
    { num:'CMD-013', client:1, date:'2026-05-10', statut:'livree',     lignes:[[1,3,899,5],[3,3,89,0]] },
    { num:'CMD-014', client:4, date:'2026-04-28', statut:'livree',     lignes:[[6,5,299,10]] },
    { num:'CMD-015', client:5, date:'2026-04-15', statut:'livree',     lignes:[[10,2,490,0]] },
    { num:'CMD-016', client:6, date:'2026-03-22', statut:'livree',     lignes:[[11,8,199,0]] },
    { num:'CMD-017', client:7, date:'2026-03-10', statut:'livree',     lignes:[[2,20,29.9,0],[3,5,89,0]] },
    { num:'CMD-018', client:8, date:'2026-02-25', statut:'livree',     lignes:[[1,1,899,0],[13,3,59.9,0]] },
    { num:'CMD-019', client:9, date:'2026-02-14', statut:'livree',     lignes:[[7,1,599,0]] },
    { num:'CMD-020', client:10,date:'2026-01-30', statut:'livree',     lignes:[[12,1,799,0],[4,1,449,0]] },
  ]

  await db.transaction(async (tq) => {
    for (const { num, client, date, statut, lignes } of cmdData) {
      const cmdId = await tq.insert(
        'INSERT INTO commandes (numero, client_id, date_commande, statut) OUTPUT INSERTED.id VALUES (?, ?, ?, ?)',
        [num, client, date, statut],
      )
      for (const [prodId, qty, prix, remise] of lignes) {
        await tq.run(
          'INSERT INTO lignes_commande (commande_id, produit_id, quantite, prix_unitaire, remise) VALUES (?, ?, ?, ?, ?)',
          [cmdId, prodId, qty, prix, remise],
        )
      }
    }
  })

  console.log('[AGEO] Données de démonstration insérées avec succès.')
}

// ── Public API ────────────────────────────────────────────────────────────────

async function initialize() {
  await ensureDatabase()
  await createTables()
  await runMigrations()
  await seedData()
  console.log('[AGEO] Base de données SQL Server prête')
}

db.initialize = initialize
module.exports = db
