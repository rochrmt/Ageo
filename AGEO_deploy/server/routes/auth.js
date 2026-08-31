'use strict'
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db/database')
const { JWT_SECRET, JWT_EXPIRES } = require('../config')
const { log } = require('../utils/journal')

const router = express.Router()

function parsePermissions(raw) {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : null
  } catch {
    return null
  }
}

function publicUser(u) {
  const isAdmin = u.role === 'admin' || u.role === 'super_admin'
  return {
    id:          u.id,
    username:    u.username,
    nom:         u.nom,
    role:        u.role,
    poste:       u.poste || null,
    permissions: isAdmin ? null : parsePermissions(u.permissions), // null = accès complet
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' })
  }

  try {
    const user = await db.getOne(
      'SELECT * FROM users WHERE username = ? AND actif = 1',
      [username],
    )
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' })
    }

    await db.run('UPDATE users SET last_login = GETDATE() WHERE id = ?', [user.id])

    const payload = publicUser(user)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    await log({ user: payload, headers: req.headers, socket: req.socket }, {
      module: 'Authentification',
      action: 'Connexion',
      description: `Connexion : ${user.nom}`,
    })

    res.json({ token, user: payload })
  } catch (err) {
    console.error('[AGEO] Erreur login:', err.message)
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' })
  }
})

module.exports = router
