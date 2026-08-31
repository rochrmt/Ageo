'use strict'
const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

const isAdmin = (req) => ['admin', 'super_admin'].includes(req.user?.role)

// ── Réglages clé/valeur ──────────────────────────────────────────────────────

async function upsertSetting(cle, valeur) {
  const v = valeur == null ? null : String(valeur)
  const exists = await db.getOne('SELECT 1 AS f FROM parametres WHERE cle = ?', [cle])
  if (exists) await db.run('UPDATE parametres SET valeur = ? WHERE cle = ?', [v, cle])
  else await db.run('INSERT INTO parametres (cle, valeur) VALUES (?, ?)', [cle, v])
}

// GET /api/parametres
router.get('/', async (_req, res) => {
  try {
    const rows = await db.getAll('SELECT cle, valeur FROM parametres')
    const obj = {}
    for (const r of rows) obj[r.cle] = r.valeur
    res.json(obj)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des paramètres' })
  }
})

// PUT /api/parametres  (objet clé/valeur)
router.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body || {})
    for (const [cle, valeur] of entries) await upsertSetting(cle, valeur)
    await log(req, { module: 'Paramètres', action: 'Modification', description: 'Paramètres mis à jour' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[AGEO] parametres PUT:', err.message)
    res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres" })
  }
})

// ── Catégories de produits ───────────────────────────────────────────────────

router.get('/categories', async (_req, res) => {
  try {
    const rows = await db.getAll(
      `SELECT c.id, c.nom,
              (SELECT COUNT(*) FROM produits p WHERE p.categorie_id = c.id) AS nb_produits
         FROM categories c ORDER BY c.nom`,
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des catégories' })
  }
})

router.post('/categories', async (req, res) => {
  const { nom } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Nom obligatoire' })
  try {
    const id = await db.insert('INSERT INTO categories (nom) OUTPUT INSERTED.id VALUES (?)', [nom.trim()])
    res.status(201).json({ id, nom: nom.trim() })
  } catch (err) {
    res.status(400).json({ error: 'Cette catégorie existe déjà' })
  }
})

router.put('/categories/:id', async (req, res) => {
  const { nom } = req.body || {}
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Nom obligatoire' })
  try {
    await db.run('UPDATE categories SET nom = ? WHERE id = ?', [nom.trim(), req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: 'Cette catégorie existe déjà' })
  }
})

router.delete('/categories/:id', async (req, res) => {
  try {
    await db.run('UPDATE produits SET categorie_id = NULL WHERE categorie_id = ?', [req.params.id])
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

// ── Utilisateurs (Sécurité) ──────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  try {
    const rows = await db.getAll(
      `SELECT id, username, nom, role, poste, actif, permissions, last_login, created_at
         FROM users ORDER BY id`,
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des utilisateurs' })
  }
})

router.post('/users', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  const { username, nom, password, role, poste, permissions } = req.body || {}
  if (!username || !nom || !password) {
    return res.status(400).json({ error: 'Identifiant, nom et mot de passe obligatoires' })
  }
  try {
    const hash = bcrypt.hashSync(password, 10)
    const perms = Array.isArray(permissions) ? JSON.stringify(permissions) : null
    const id = await db.insert(
      `INSERT INTO users (username, nom, password_hash, role, poste, permissions)
       OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?)`,
      [username, nom, hash, role || 'user', poste || null, perms],
    )
    await log(req, { module: 'Utilisateurs', action: 'Création', description: `Utilisateur créé : ${nom}` })
    res.status(201).json({ id })
  } catch (err) {
    res.status(400).json({ error: 'Cet identifiant est déjà utilisé' })
  }
})

router.put('/users/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  const { nom, role, poste, permissions, actif, password } = req.body || {}
  try {
    const target = await db.getOne('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' })
    if (target.role === 'super_admin' && role && role !== 'super_admin') {
      return res.status(400).json({ error: 'Le super administrateur ne peut pas être rétrogradé' })
    }

    const perms = Array.isArray(permissions) ? JSON.stringify(permissions) : target.permissions
    await db.run(
      `UPDATE users SET nom = ?, role = ?, poste = ?, permissions = ?, actif = ? WHERE id = ?`,
      [nom ?? target.nom, role ?? target.role, poste !== undefined ? (poste || null) : target.poste, perms,
       actif == null ? target.actif : actif, req.params.id],
    )
    if (password) {
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?',
        [bcrypt.hashSync(password, 10), req.params.id])
    }
    await log(req, { module: 'Utilisateurs', action: 'Modification', description: `Utilisateur modifié : ${nom || target.nom}` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' })
  }
})

router.delete('/users/:id', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  try {
    const target = await db.getOne('SELECT role FROM users WHERE id = ?', [req.params.id])
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' })
    if (target.role === 'super_admin') {
      return res.status(400).json({ error: 'Le super administrateur ne peut pas être supprimé' })
    }
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id])
    await log(req, { module: 'Utilisateurs', action: 'Suppression', description: `Utilisateur #${req.params.id} supprimé` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

// POST /api/parametres/password  (changer SON mot de passe)
router.post('/password', async (req, res) => {
  const { ancien, nouveau } = req.body || {}
  if (!ancien || !nouveau) return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' })
  try {
    const user = await db.getOne('SELECT * FROM users WHERE id = ?', [req.user.id])
    if (!user || !bcrypt.compareSync(ancien, user.password_hash)) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' })
    }
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?',
      [bcrypt.hashSync(nouveau, 10), req.user.id])
    await log(req, { module: 'Sécurité', action: 'Mot de passe', description: 'Mot de passe modifié' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' })
  }
})

// GET /api/parametres/database  (statistiques base de données)
router.get('/database', async (_req, res) => {
  try {
    const clients = await db.getOne('SELECT COUNT(*) AS total, SUM(CASE WHEN actif=1 THEN 1 ELSE 0 END) AS actifs FROM clients')
    const produits = await db.getOne('SELECT COUNT(*) AS total, SUM(CASE WHEN actif=1 THEN 1 ELSE 0 END) AS actifs FROM produits')
    const categories = await db.getOne('SELECT COUNT(*) AS n FROM categories')
    const commandes = await db.getOne("SELECT COUNT(*) AS total, SUM(CASE WHEN statut='livree' THEN 1 ELSE 0 END) AS livrees FROM commandes")
    const lignes = await db.getOne('SELECT ISNULL(SUM(quantite),0) AS n FROM lignes_commande')
    const ca = await db.getOne(
      `SELECT ISNULL(SUM(lc.quantite*lc.prix_unitaire*(1-lc.remise/100.0)),0) AS ca
         FROM lignes_commande lc JOIN commandes cmd ON cmd.id=lc.commande_id WHERE cmd.statut='livree'`,
    )
    const dates = await db.getOne('SELECT MIN(date_commande) AS premiere, MAX(date_commande) AS derniere FROM commandes')
    res.json({
      clients: { total: clients.total, actifs: clients.actifs || 0 },
      produits: { total: produits.total, actifs: produits.actifs || 0 },
      categories: categories.n,
      commandes: { total: commandes.total, livrees: commandes.livrees || 0 },
      lignes_commande: lignes.n,
      ca_livre: ca.ca,
      premiere_commande: dates.premiere,
      derniere_commande: dates.derniere,
    })
  } catch (err) {
    console.error('[AGEO] parametres database:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des statistiques' })
  }
})

module.exports = router
