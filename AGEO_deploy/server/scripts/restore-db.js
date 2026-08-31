// ============================================================
//  Restauration de la base SQL Server (ageo) depuis un .bak
//  Usage : node scripts/restore-db.js "C:\Backups\ageo_2026-07-31_1022.bak"
// ============================================================

const sql = require('mssql')
const fs = require('fs')

// ── Configuration ──────────────────────────────────────────
const config = {
  server: 'SERVEURRMT',
  port: 63813,
  database: 'master',           // On se connecte à 'master' pour restaurer 'ageo'
  user: 'sa',
  password: '123456',
  options: { encrypt: false, trustServerCertificate: true },
}

const targetDatabase = 'ageo'

// ── Exécution ──────────────────────────────────────────────
async function main() {
  // Récupérer le chemin du .bak depuis les arguments
  const bakFile = process.argv[2]
  if (!bakFile) {
    console.log('Usage : node scripts/restore-db.js "C:\\Backups\\ageo_2026-07-31_1022.bak"')
    console.log('')
    console.log('Indiquez le chemin du fichier .bak à restaurer.')
    process.exit(1)
  }

  // Vérifier que le fichier existe
  if (!fs.existsSync(bakFile)) {
    console.log(`ERREUR : le fichier "${bakFile}" n'existe pas`)
    process.exit(1)
  }

  const sizeMB = (fs.statSync(bakFile).size / (1024 * 1024)).toFixed(2)
  console.log(`Fichier de sauvegarde : ${bakFile} (${sizeMB} MB)`)

  // Demander confirmation
  console.log('')
  console.log(`⚠️  ATTENTION : toutes les données actuelles de "${targetDatabase}" seront`)
  console.log('   remplacées par celles de la sauvegarde. Cette action est irréversible.')
  console.log('')

  // Connexion à SQL Server (sur la base 'master')
  console.log(`Connexion à SQL Server...`)
  const pool = await sql.connect(config)

  // 1. Mettre la base en mode single user (pour forcer la déconnexion des autres)
  console.log(`Fermeture des connexions sur "${targetDatabase}"...`)
  await pool.request().query(`ALTER DATABASE [${targetDatabase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`)

  // 2. Restaurer
  const escapedPath = bakFile.replace(/'/g, "''")
  console.log(`Restauration en cours...`)
  await pool.request().query(`RESTORE DATABASE [${targetDatabase}] FROM DISK = '${escapedPath}' WITH REPLACE, RECOVERY`)

  // 3. Remettre en mode multi-utilisateur
  await pool.request().query(`ALTER DATABASE [${targetDatabase}] SET MULTI_USER`)

  await pool.close()

  console.log('')
  console.log(`✅ Restauration terminée : "${targetDatabase}" restaurée depuis ${bakFile}`)
  console.log('   Vous pouvez redémarrer le serveur maintenant.')
}

main().catch(async (err) => {
  console.error('ERREUR :', err.message)
  // Essayer de remettre la base en multi-user en cas d'erreur
  try {
    const pool = await sql.connect(config)
    await pool.request().query(`ALTER DATABASE [${targetDatabase}] SET MULTI_USER`)
    await pool.close()
  } catch {}
  process.exit(1)
})
