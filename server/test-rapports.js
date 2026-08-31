require('dotenv').config()
const db = require('./db/database')

async function test() {
  try {
    await db.getOne('SELECT 1 AS ok')
    console.log('DB OK')

    // Test synthese
    const caLivre = await db.getOne(
      `SELECT ISNULL(SUM(lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)), 0) AS ca
         FROM commandes cmd JOIN lignes_commande lc ON lc.commande_id = cmd.id
        WHERE cmd.statut = 'livree' AND YEAR(cmd.date_commande) = ?`,
      [2026],
    )
    console.log('synthese ca_livre:', caLivre)

    const mensuel = await db.getAll(
      `SELECT MONTH(cmd.date_commande) AS mois, ISNULL(SUM(lc.quantite * lc.prix_unitaire * (1 - lc.remise / 100.0)), 0) AS ca
         FROM commandes cmd JOIN lignes_commande lc ON lc.commande_id = cmd.id
        WHERE cmd.statut = 'livree' AND YEAR(cmd.date_commande) = ?
        GROUP BY MONTH(cmd.date_commande) ORDER BY mois`,
      [2026],
    )
    console.log('synthese mensuel:', JSON.stringify(mensuel))

    // Test stock
    const stock = await db.getAll(
      `SELECT p.code, p.nom, p.stock, p.stock_min, p.prix_ht,
              (p.stock * p.prix_ht) AS valeur,
              CASE WHEN p.stock <= p.stock_min THEN 1 ELSE 0 END AS alerte,
              cat.nom AS categorie_nom
         FROM produits p
         LEFT JOIN categories cat ON cat.id = p.categorie_id
        WHERE p.actif = 1
        ORDER BY alerte DESC, p.nom`,
    )
    console.log('stock count:', stock.length, 'first:', JSON.stringify(stock[0]))

    process.exit(0)
  } catch (e) {
    console.error('ERR:', e.message)
    console.error(e.stack)
    process.exit(1)
  }
}

test()
