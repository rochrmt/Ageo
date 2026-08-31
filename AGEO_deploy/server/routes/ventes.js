'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

const LINE_TOTAL = 'lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)'

function rangeStart(periode) {
  switch (periode) {
    case 'semaine':   return 'DATEADD(DAY, -7, GETDATE())'
    case 'trimestre': return 'DATEADD(MONTH, -3, GETDATE())'
    case 'annee':     return 'DATEADD(YEAR, -1, GETDATE())'
    case 'mois':
    default:          return 'DATEADD(MONTH, -1, GETDATE())'
  }
}

// GET /api/ventes?periode=mois
router.get('/', async (req, res) => {
  const periode = ['semaine', 'mois', 'trimestre', 'annee'].includes(req.query.periode)
    ? req.query.periode : 'mois'
  const start = rangeStart(periode)

  try {
    const stats = await db.getOne(
      `SELECT
         ISNULL(SUM(${LINE_TOTAL}), 0) AS ca,
         COUNT(DISTINCT cmd.id) AS commandes,
         COUNT(DISTINCT cmd.client_id) AS clients
       FROM commandes cmd
       JOIN lignes_commande lc ON lc.commande_id = cmd.id
      WHERE cmd.statut = 'livree' AND cmd.date_commande >= ${start}`,
    )

    const panier = stats.commandes > 0 ? stats.ca / stats.commandes : 0

    const evolution = await db.getAll(
      `SELECT FORMAT(cmd.date_commande, 'yyyy-MM-dd') AS jour,
              ISNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM commandes cmd
         JOIN lignes_commande lc ON lc.commande_id = cmd.id
        WHERE cmd.statut = 'livree' AND cmd.date_commande >= ${start}
        GROUP BY FORMAT(cmd.date_commande, 'yyyy-MM-dd')
        ORDER BY jour`,
    )

    res.json({
      periode,
      ca:          stats.ca,
      commandes:   stats.commandes,
      clients:     stats.clients,
      panier_moyen: Math.round(panier),
      evolution,
    })
  } catch (err) {
    console.error('[AGEO] ventes GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement des ventes' })
  }
})

module.exports = router
