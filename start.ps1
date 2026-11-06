# Menu of the project (same idea as the DC Scaffold projects): .\start.ps1, or .\start.ps1 -Action D
param([string]$Action)
$ici = $PSScriptRoot
Set-Location $ici
function Installer { Write-Host 'Installation des dépendances...' -ForegroundColor Cyan; npm install }
$choix = [ordered]@{
    D = @('Développement', 'Lance l''application en mode développement (fenêtre Electron)', { if (-not (Test-Path 'node_modules')) { Installer }; npm start })
    M = @('Moteur seul', 'Le moteur sans fenêtre, page sur http://localhost:4747', { if (-not (Test-Path 'node_modules')) { Installer }; npm run moteur })
    T = @('Tester', 'Vérifie le dossier, la signature, l''envoi, Claude et le registre, sans rien envoyer', { npm run tester })
    I = @('Installer', 'npm install (après un git clone ou un paquet ajouté)', { Installer })
    B = @('Build', 'Fabrique l''installateur dans dist\ (sans le publier)', { npx electron-builder --win nsis })
    P = @('Publier', 'Fabrique l''installateur et le met dans le Drive : les PC équipés se mettent à jour (monte d''abord la version dans package.json)', { & (Join-Path $ici 'scripts\publier.ps1') })
}
if (-not $Action) {
    Write-Host ''
    Write-Host '  DC PROSPECT' -ForegroundColor Green
    Write-Host ''
    foreach ($k in $choix.Keys) { Write-Host ("  {0}  {1,-14} {2}" -f $k, $choix[$k][0], $choix[$k][1]) }
    Write-Host ''
    $Action = (Read-Host '  Ton choix').ToUpper()
}
if ($choix.Contains($Action)) { & $choix[$Action][2] } else { Write-Host 'Choix inconnu' -ForegroundColor Yellow }
