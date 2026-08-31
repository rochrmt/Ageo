'use strict'
const express = require('express')
const db = require('../db/database')
const { log } = require('../utils/journal')

const router = express.Router()

function recompute(b) {
  const primes =
    (Number(b.prime_rendement) || 0) +
    (Number(b.prime_anciennete) || 0) +
    (Number(b.autres_primes) || 0)
  const deductions =
    (Number(b.avance_salaire) || 0) +
    (Number(b.retenue_absence) || 0) +
    (Number(b.autres_deductions) || 0)
  const brut = (Number(b.salaire_base) || 0) + primes
  const net = brut - deductions
  return { primes, deductions, net }
}

// GET /api/paie?mois=YYYY-MM
router.get('/', async (req, res) => {
  const mois = req.query.mois || new Date().toISOString().slice(0, 7)
  try {
    const rows = await db.getAll(
      `SELECT bp.*, e.nom AS employe_nom, e.prenom AS employe_prenom, e.poste AS employe_poste
         FROM bulletins_paie bp JOIN employes e ON e.id = bp.employe_id
        WHERE bp.mois = ? ORDER BY e.nom`,
      [mois],
    )
    res.json(rows)
  } catch (err) {
    console.error('[AGEO] paie GET:', err.message)
    res.status(500).json({ error: 'Erreur lors du chargement de la paie' })
  }
})

// POST /api/paie/generer  { mois }
router.post('/generer', async (req, res) => {
  const { mois } = req.body || {}
  if (!mois) return res.status(400).json({ error: 'Mois obligatoire (YYYY-MM)' })
  try {
    const employes = await db.getAll('SELECT * FROM employes WHERE actif = 1')
    let crees = 0
    for (const e of employes) {
      const exists = await db.getOne(
        'SELECT id FROM bulletins_paie WHERE employe_id = ? AND mois = ?', [e.id, mois],
      )
      if (exists) continue
      const salaire = Number(e.salaire) || 0
      await db.run(
        `INSERT INTO bulletins_paie (employe_id, mois, salaire_base, primes, deductions, net, statut)
         VALUES (?, ?, ?, 0, 0, ?, 'en_attente')`,
        [e.id, mois, salaire, salaire],
      )
      crees++
    }
    await log(req, { module: 'Personnel', action: 'Paie', description: `Génération paie ${mois} (${crees})` })
    res.json({ ok: true, crees })
  } catch (err) {
    console.error('[AGEO] paie generer:', err.message)
    res.status(500).json({ error: 'Erreur lors de la génération de la paie' })
  }
})

// PUT /api/paie/:id
router.put('/:id', async (req, res) => {
  try {
    const current = await db.getOne('SELECT * FROM bulletins_paie WHERE id = ?', [req.params.id])
    if (!current) return res.status(404).json({ error: 'Bulletin introuvable' })

    const merged = { ...current, ...req.body }
    const { primes, deductions, net } = recompute(merged)

    await db.run(
      `UPDATE bulletins_paie SET
         salaire_base = ?, prime_rendement = ?, prime_anciennete = ?, autres_primes = ?,
         autres_primes_libelle = ?, avance_salaire = ?, retenue_absence = ?, nb_jours_absence = ?,
         autres_deductions = ?, autres_deductions_libelle = ?, primes = ?, deductions = ?, net = ?,
         notes = ?
       WHERE id = ?`,
      [Number(merged.salaire_base) || 0, Number(merged.prime_rendement) || 0,
       Number(merged.prime_anciennete) || 0, Number(merged.autres_primes) || 0,
       merged.autres_primes_libelle || null, Number(merged.avance_salaire) || 0,
       Number(merged.retenue_absence) || 0, Number(merged.nb_jours_absence) || 0,
       Number(merged.autres_deductions) || 0, merged.autres_deductions_libelle || null,
       primes, deductions, net, merged.notes || null, req.params.id],
    )
    const updated = await db.getOne('SELECT * FROM bulletins_paie WHERE id = ?', [req.params.id])
    res.json(updated)
  } catch (err) {
    console.error('[AGEO] paie PUT:', err.message)
    res.status(500).json({ error: 'Erreur lors de la mise à jour du bulletin' })
  }
})

// PUT /api/paie/:id/payer
router.put('/:id/payer', async (req, res) => {
  try {
    await db.run(
      "UPDATE bulletins_paie SET statut = 'paye', date_paiement = CURDATE() WHERE id = ?",
      [req.params.id],
    )
    await log(req, { module: 'Personnel', action: 'Paie', description: `Bulletin #${req.params.id} payé` })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du paiement' })
  }
})

// DELETE /api/paie/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM bulletins_paie WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' })
  }
})

module.exports = router
