# Builds the installer and puts it in <data folder>\Installation: every PC that uses this data folder is told and updates in one click.
# Before: raise "version" in package.json (e.g. 1.0.1). Called by start.ps1 (P) or: npm run publier
# The data folder is the one chosen in the app (%APPDATA%\prospection-auto\local.json), or Documents\DC Prospect.
$racine = Split-Path $PSScriptRoot -Parent
Set-Location $racine
$version = (Get-Content (Join-Path $racine 'package.json') -Raw | ConvertFrom-Json).version
$local = Join-Path $env:APPDATA 'prospection-auto\local.json'
$donnees = if (Test-Path $local) { (Get-Content $local -Raw | ConvertFrom-Json).dossierDrive } else { $null }
if (-not $donnees) { $donnees = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'DC Prospect' }
$dossier = Join-Path $donnees 'Installation'
npx electron-builder --win nsis
if ($LASTEXITCODE -ne 0) { Write-Host 'Échec de la fabrication' -ForegroundColor Red; exit 1 }
New-Item -ItemType Directory -Force -Path $dossier | Out-Null
Get-ChildItem $dossier -Filter '*.exe' | Remove-Item -Force
Copy-Item (Join-Path $racine "dist\DC-Prospect-Setup-$version.exe") -Destination (Join-Path $dossier 'DC-Prospect-Setup.exe') -Force
@{ version = $version; fichier = 'DC-Prospect-Setup.exe'; date = (Get-Date -Format 'yyyy-MM-dd HH:mm') } | ConvertTo-Json | Set-Content (Join-Path $dossier 'latest.json') -Encoding UTF8
Write-Host "Publié : DC Prospect $version dans $dossier" -ForegroundColor Green
