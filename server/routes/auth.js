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
    email:       u.email,
    nom:         u.nom,
    role:        u.role,
    poste:       u.poste || null,
    permissions: isAdmin ? null : parsePermissions(u.permissions), // null = accès complet
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  try {
    const user = await db.getOne(
      'SELECT * FROM users WHERE email = ? AND actif = 1',
      [email.trim().toLowerCase()],
    )
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    await db.run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])

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
