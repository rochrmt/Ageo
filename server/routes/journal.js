'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

// GET /api/journal?module=&action=&q=&limit=100
router.get('/', async (req, res) => {
  const { module, action, q } = req.query
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500)

  const where = []
  const params = []
  if (module) { where.push('module = ?'); params.push(module) }
  if (action) { where.push('action = ?'); params.push(action) }
  if (q) {
    where.push('(description LIKE ? OR utilisateur_nom LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const rows = await db.getAll(
      `SELECT * FROM journal_activites ${whereSql}
        ORDER BY date_action DESC, id DESC
        LIMIT ${limit}`,
      params,
    )

    // Statistiques d'en-tête
    const stats = await db.getOne(
      `SELECT
         (SELECT COUNT(*) FROM journal_activites
           WHERE DATE(date_action) = CURDATE()) AS aujourdhui,
         (SELECT COUNT(*) FROM journal_activites
           WHERE date_action >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND module = 'Authentification') AS auth_7j,
         (SELECT COUNT(*) FROM journal_activites
           WHERE date_action >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND module = 'Clients') AS clients_7j,
         (SELECT COUNT(*) FROM journal_activites
           WHERE date_action >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND module = 'Personnel') AS personnel_7j`,
    )

    // Modules distincts pour les filtres
    const modules = await db.getAll('SELECT DISTINCT module FROM journal_activites ORDER BY module')

    res.json({ evenements: rows, stats, modules: modules.map((m) => m.module) })
  } catch (err) {
    console.error('[AGEO] journal GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement du journal' })
  }
})

module.exports = router
