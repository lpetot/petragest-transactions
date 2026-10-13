# Remplace les images provisoires de la charte par les vraies, prises dans l'atelier de Laetitia.
# Copie seulement 4 fichiers (logo sable, logo navy, emblème, portrait de Catherine) vers public\assets.
# Rien n'est écrit dans l'atelier.
#
#   powershell -ExecutionPolicy Bypass -File scripts\importer-charte.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\importer-charte.ps1 -Source "C:\chemin\vers\petra-gest-assets"

param([string]$Source = '')

$ErrorActionPreference = 'Stop'
$racine = Split-Path -Parent $PSScriptRoot
$cible = Join-Path $racine 'public\assets'
$fichiers = @('pg-logo-sable.png', 'pg-logo-navy.png', 'pg-embleme-navy.png', 'personne-catherine.jpg')

# Emplacements habituels du dossier d'images Petra Gest de l'atelier.
$candidats = @()
if ($Source) { $candidats += $Source }
$suffixe = 'atelier-crea\creations\petra-gest-assets'
if ($env:OneDriveCommercial) { $candidats += (Join-Path $env:OneDriveCommercial "Documents\$suffixe") }
if ($env:OneDrive) { $candidats += (Join-Path $env:OneDrive "Documents\$suffixe") }
$candidats += (Join-Path $env:USERPROFILE "Documents\$suffixe")
$candidats += (Join-Path $env:USERPROFILE "MAVEX\Laetitia PETOT - Arsenal Royal - Documents\Documents\$suffixe")

$dossier = $candidats | Where-Object { Test-Path (Join-Path $_ 'pg-logo-sable.png') } | Select-Object -First 1
if (-not $dossier) {
    Write-Host "Dossier des images Petra Gest introuvable. Indiquez-le avec -Source." -ForegroundColor Yellow
    Write-Host "Emplacements essayés :"; $candidats | ForEach-Object { Write-Host "  $_" }
    exit 1
}
Write-Host "Source : $dossier"
foreach ($f in $fichiers) {
    $src = Join-Path $dossier $f
    if (-not (Test-Path $src)) { Write-Host "  $f : absent de la source, image provisoire conservée" -ForegroundColor Yellow; continue }
    # Copie d'abord vers un fichier temporaire : en cas d'échec, l'image en place n'est pas touchée.
    $temp = Join-Path $cible ($f + '.import')
    try {
        Copy-Item -LiteralPath $src -Destination $temp -Force
        if ((Get-Item $temp).Length -lt 100) { throw 'fichier vide' }
        Move-Item -LiteralPath $temp -Destination (Join-Path $cible $f) -Force
        Write-Host "  $f : copié"
    } catch {
        if (Test-Path $temp) { Remove-Item -LiteralPath $temp -Force }
        Write-Host "  $f : copie impossible ($($_.Exception.Message)). OneDrive est-il lancé ?" -ForegroundColor Yellow
    }
}
Write-Host "Terminé. Rechargez les pages (Ctrl + F5)."
