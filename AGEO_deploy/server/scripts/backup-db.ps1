# ============================================================
#  Sauvegarde automatique de la base SQL Server (ageo)
#  Usage : powershell -ExecutionPolicy Bypass -File backup-db.ps1
# ============================================================

# ── Configuration ──────────────────────────────────────────
$Server   = "SERVEURRMT,63813"
$Database = "ageo"
$User     = "sa"
$Password = "123456"

# Dossier de sauvegarde (modifiable)
$BackupDir = "C:\Backups"

# Nombre de jours de rétention (les .bak plus anciens sont supprimés)
$RetentionDays = 30

# ── Exécution ──────────────────────────────────────────────
$Date     = Get-Date -Format "yyyy-MM-dd_HHmm"
$FileName = "${Database}_${Date}.bak"
$FullPath = Join-Path $BackupDir $FileName

# Créer le dossier s'il n'existe pas
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "Dossier cree : $BackupDir"
}

# Lancer la sauvegarde via sqlcmd
Write-Host "Sauvegarde de '$Database' en cours..."
$sql = "BACKUP DATABASE [$Database] TO DISK = '$FullPath' WITH FORMAT, INIT, NAME = '$Database - Sauvegarde complete'"
& sqlcmd -S $Server -U $User -P $Password -Q $sql 2>&1 | ForEach-Object { Write-Host $_ }

if (Test-Path $FullPath) {
    $size = [math]::Round((Get-Item $FullPath).Length / 1MB, 2)
    Write-Host "Sauvegarde OK : $FullPath ($size MB)"
} else {
    Write-Host "ERREUR : le fichier de sauvegarde n'a pas ete cree"
    exit 1
}

# Nettoyer les anciennes sauvegardes
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $BackupDir -Filter "${Database}_*.bak" |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "Ancienne sauvegarde supprimee : $($_.Name)"
    }

Write-Host "Termine."
