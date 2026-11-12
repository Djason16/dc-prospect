# Menu of the project (same idea as the DC Scaffold projects): .\start.ps1, or .\start.ps1 -Action D
# The menu texts are read by the user: in French
param([string]$Action)
$here = $PSScriptRoot
Set-Location $here
function Install-Dependencies { Write-Host 'Installation des dépendances...' -ForegroundColor Cyan; npm install }
$choices = [ordered]@{
    D = @('Développement', 'Lance l''application en mode développement (fenêtre Electron)', { if (-not (Test-Path 'node_modules')) { Install-Dependencies }; npm start })
    M = @('Moteur seul', 'Le moteur sans fenêtre, page sur http://localhost:4747', { if (-not (Test-Path 'node_modules')) { Install-Dependencies }; npm run engine })
    T = @('Tester', 'Vérifie le dossier, la signature, l''envoi, Claude et le registre, sans rien envoyer', { npm run check })
    I = @('Installer', 'npm install (après un git clone ou un paquet ajouté)', { Install-Dependencies })
    B = @('Build', 'Fabrique l''installateur dans dist\ (sans le publier)', { npm run build })
    P = @('Publier', 'Fabrique l''installateur et le met dans le Drive : les PC équipés se mettent à jour (monte d''abord la version dans package.json)', { & (Join-Path $here 'scripts\publish.ps1') })
}
if (-not $Action) {
    Write-Host ''
    Write-Host '  DC PROSPECT' -ForegroundColor Green
    Write-Host ''
    foreach ($k in $choices.Keys) { Write-Host ("  {0}  {1,-14} {2}" -f $k, $choices[$k][0], $choices[$k][1]) }
    Write-Host ''
    $Action = (Read-Host '  Ton choix').ToUpper()
}
if ($choices.Contains($Action)) { & $choices[$Action][2] } else { Write-Host 'Choix inconnu' -ForegroundColor Yellow }
