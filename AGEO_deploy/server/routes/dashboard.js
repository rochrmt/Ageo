'use strict'
const express = require('express')
const db = require('../db/database')

const router = express.Router()

const LINE_TOTAL = 'lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)'

// GET /api/dashboard
router.get('/', async (_req, res) => {
  try {
    // CA du mois courant (commandes livrées)
    const caMois = await db.getOne(
      `SELECT ISNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM lignes_commande lc
         JOIN commandes cmd ON cmd.id = lc.commande_id
        WHERE cmd.statut = 'livree'
          AND YEAR(cmd.date_commande)  = YEAR(GETDATE())
          AND MONTH(cmd.date_commande) = MONTH(GETDATE())`,
    )
    // CA du mois précédent
    const caPrec = await db.getOne(
      `SELECT ISNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM lignes_commande lc
         JOIN commandes cmd ON cmd.id = lc.commande_id
        WHERE cmd.statut = 'livree'
          AND YEAR(cmd.date_commande)  = YEAR(DATEADD(MONTH, -1, GETDATE()))
          AND MONTH(cmd.date_commande) = MONTH(DATEADD(MONTH, -1, GETDATE()))`,
    )

    const commandesActives = await db.getOne(
      "SELECT COUNT(*) AS n FROM commandes WHERE statut IN ('en_attente','en_cours')",
    )
    const clientsActifs = await db.getOne('SELECT COUNT(*) AS n FROM clients WHERE actif = 1')
    const produitsStock = await db.getOne('SELECT ISNULL(SUM(stock), 0) AS n FROM produits WHERE actif = 1')

    // Évolution 6 derniers mois
    const evolution = await db.getAll(
      `SELECT FORMAT(cmd.date_commande, 'yyyy-MM') AS mois,
              ISNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM lignes_commande lc
         JOIN commandes cmd ON cmd.id = lc.commande_id
        WHERE cmd.statut = 'livree'
          AND cmd.date_commande >= DATEADD(MONTH, -5, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        GROUP BY FORMAT(cmd.date_commande, 'yyyy-MM')
        ORDER BY mois`,
    )

    const topClients = await db.getAll(
      `SELECT TOP (5) c.id, c.nom,
              ISNULL(SUM(${LINE_TOTAL}), 0) AS ca
         FROM clients c
         JOIN commandes cmd ON cmd.client_id = c.id AND cmd.statut = 'livree'
         JOIN lignes_commande lc ON lc.commande_id = cmd.id
        GROUP BY c.id, c.nom
        ORDER BY ca DESC`,
    )

    const commandesRecentes = await db.getAll(
      `SELECT TOP (5) cmd.id, cmd.numero, cmd.date_commande, cmd.statut,
              c.nom AS client_nom,
              (SELECT ISNULL(SUM(${LINE_TOTAL}), 0) FROM lignes_commande lc WHERE lc.commande_id = cmd.id) AS montant_ht
         FROM commandes cmd
         LEFT JOIN clients c ON c.id = cmd.client_id
        ORDER BY cmd.date_commande DESC, cmd.id DESC`,
    )

    const prec = caPrec.ca || 0
    const variation = prec === 0 ? (caMois.ca > 0 ? 100 : 0) : ((caMois.ca - prec) / prec) * 100

    res.json({
      ca_mois:            caMois.ca,
      ca_variation:       Math.round(variation * 10) / 10,
      commandes_actives:  commandesActives.n,
      clients_actifs:     clientsActifs.n,
      produits_stock:     produitsStock.n,
      evolution,
      top_clients:        topClients,
      commandes_recentes: commandesRecentes,
    })
  } catch (err) {
    console.error('[AGEO] dashboard GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord' })
  }
})

module.exports = router
