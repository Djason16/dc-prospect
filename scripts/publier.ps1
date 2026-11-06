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

# GitHub release with the installer (the file is too big for the repository itself: GitHub refuses files over 100 MB)
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $tag = "v$version"
    $notes = Join-Path $env:TEMP "dc-prospect-$tag.md"
    $journal = Get-Content (Join-Path $racine 'CHANGELOG.md') -Raw
    $debut = $journal.IndexOf("## $version")
    if ($debut -ge 0) { $suite = $journal.IndexOf("`n## ", $debut + 4); $texte = if ($suite -gt 0) { $journal.Substring($debut, $suite - $debut) } else { $journal.Substring($debut) } } else { $texte = "DC Prospect $version" }
    Set-Content $notes $texte -Encoding UTF8
    gh release view $tag *> $null
    if ($LASTEXITCODE -eq 0) { gh release upload $tag (Join-Path $racine "dist\DC-Prospect-Setup-$version.exe") --clobber }
    else { gh release create $tag (Join-Path $racine "dist\DC-Prospect-Setup-$version.exe") --title "DC Prospect $version" --notes-file $notes }
    Write-Host "Release GitHub $tag à jour" -ForegroundColor Green
}
