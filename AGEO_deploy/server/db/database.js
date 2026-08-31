'use strict'
require('dotenv').config()
const sql = require('mssql')

const config = {
  server:   process.env.DB_SERVER   || 'localhost',
  database: process.env.DB_NAME     || 'ageo',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt:                process.env.DB_ENCRYPT    !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
}

// Si DB_PORT est défini, on cible le port direct (utile si SQL Server Browser n'est pas lancé)
if (process.env.DB_PORT) {
  config.port = parseInt(process.env.DB_PORT)
  // Avec un port explicite, le nom d'instance doit être dans server sans backslash
  // ex: DB_SERVER=PRESIDENCE  DB_PORT=1433
  config.server = (config.server || '').split('\\')[0]
}

let pool = null

async function getPool() {
  if (!pool) {
    const MAX = 6
    for (let i = 1; i <= MAX; i++) {
      try {
        pool = await sql.connect(config)
        console.log('[AGEO] Connexion SQL Server établie')
        return pool
      } catch (err) {
        if (i === MAX) throw err
        console.warn(`[AGEO] SQL Server pas encore prêt (${i}/${MAX}), nouvelle tentative dans 10s...`)
        await new Promise(r => setTimeout(r, 10000))
      }
    }
  }
  return pool
}

// Replace ? placeholders with @p0, @p1, ...
function namedSql(sqlStr) {
  let i = 0
  return sqlStr.replace(/\?/g, () => `@p${i++}`)
}

function addInputs(request, values) {
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      request.input(`p${i}`, sql.NVarChar(sql.MAX), null)
    } else if (typeof v === 'boolean') {
      request.input(`p${i}`, sql.Bit, v ? 1 : 0)
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) request.input(`p${i}`, sql.Int, v)
      else request.input(`p${i}`, sql.Float, v)
    } else {
      request.input(`p${i}`, sql.NVarChar(sql.MAX), String(v))
    }
  })
}

const db = {
  // Returns single row or null
  async getOne(sqlStr, values = []) {
    const p = await getPool()
    const req = p.request()
    addInputs(req, values)
    const result = await req.query(namedSql(sqlStr))
    return result.recordset[0] ?? null
  },

  // Returns array of rows
  async getAll(sqlStr, values = []) {
    const p = await getPool()
    const req = p.request()
    addInputs(req, values)
    const result = await req.query(namedSql(sqlStr))
    return result.recordset
  },

  // Execute without returning rows
  async run(sqlStr, values = []) {
    const p = await getPool()
    const req = p.request()
    addInputs(req, values)
    const result = await req.query(namedSql(sqlStr))
    return { rowsAffected: result.rowsAffected[0] ?? 0 }
  },

  // INSERT ... OUTPUT INSERTED.id — returns the new id
  async insert(sqlStr, values = []) {
    const p = await getPool()
    const req = p.request()
    addInputs(req, values)
    const result = await req.query(namedSql(sqlStr))
    return result.recordset[0]?.id ?? null
  },

  // Raw DDL / multi-statement with no params
  async exec(sqlStr) {
    const p = await getPool()
    await p.request().query(sqlStr)
  },

  // Run fn(tq) inside a transaction; tq mirrors db but uses the transaction connection
  async transaction(fn) {
    const p = await getPool()
    const t = new sql.Transaction(p)
    await t.begin()
    const tq = {
      async getOne(sqlStr, values = []) {
        const req = new sql.Request(t)
        addInputs(req, values)
        const r = await req.query(namedSql(sqlStr))
        return r.recordset[0] ?? null
      },
      async getAll(sqlStr, values = []) {
        const req = new sql.Request(t)
        addInputs(req, values)
        const r = await req.query(namedSql(sqlStr))
        return r.recordset
      },
      async run(sqlStr, values = []) {
        const req = new sql.Request(t)
        addInputs(req, values)
        const r = await req.query(namedSql(sqlStr))
        return { rowsAffected: r.rowsAffected[0] ?? 0 }
      },
      async insert(sqlStr, values = []) {
        const req = new sql.Request(t)
        addInputs(req, values)
        const r = await req.query(namedSql(sqlStr))
        return r.recordset[0]?.id ?? null
      },
    }
    try {
      const result = await fn(tq)
      await t.commit()
      return result
    } catch (err) {
      await t.rollback()
      throw err
    }
  },

  sql,
}

module.exports = db
