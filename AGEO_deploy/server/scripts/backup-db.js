// ============================================================
//  Sauvegarde automatique de la base SQL Server (ageo)
//  Usage : node scripts/backup-db.js
// ============================================================

const sql = require('mssql')
const fs = require('fs')
const path = require('path')

// ── Configuration ──────────────────────────────────────────
const config = {
  server: 'SERVEURRMT',
  port: 63813,
  database: 'ageo',
  user: 'sa',
  password: '123456',
  options: { encrypt: false, trustServerCertificate: true },
}

// Dossier de sauvegarde (modifiable)
const backupDir = 'C:\\Backups'

// Nombre de jours de rétention (les .bak plus anciens sont supprimés)
const retentionDays = 30

// ── Exécution ──────────────────────────────────────────────
async function main() {
  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
    console.log(`Dossier créé : ${backupDir}`)
  }

  // Nom du fichier avec date
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
  const fileName = `${config.database}_${dateStr}.bak`
  const fullPath = path.join(backupDir, fileName)

  // Connexion à SQL Server
  console.log(`Sauvegarde de '${config.database}' en cours...`)
  const pool = await sql.connect(config)

  // Lancer la sauvegarde
  const sqlCmd = `BACKUP DATABASE [${config.database}] TO DISK = '${fullPath.replace(/\\/g, '\\\\')}' WITH FORMAT, INIT, NAME = '${config.database} - Sauvegarde complete'`
  await pool.request().query(sqlCmd)
  await pool.close()

  // Vérifier que le fichier existe
  if (fs.existsSync(fullPath)) {
    const sizeMB = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2)
    console.log(`Sauvegarde OK : ${fullPath} (${sizeMB} MB)`)
  } else {
    console.log("ERREUR : le fichier de sauvegarde n'a pas été créé")
    process.exit(1)
  }

  // Nettoyer les anciennes sauvegardes
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const files = fs.readdirSync(backupDir).filter((f) => f.startsWith(`${config.database}_`) && f.endsWith('.bak'))
  for (const f of files) {
    const filePath = path.join(backupDir, f)
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.unlinkSync(filePath)
      console.log(`Ancienne sauvegarde supprimée : ${f}`)
    }
  }

  console.log('Terminé.')
}

main().catch((err) => {
  console.error('ERREUR :', err.message)
  process.exit(1)
})
