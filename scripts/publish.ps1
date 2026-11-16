# Builds the installer and puts it in <data folder>\Installation: every PC that uses this data folder is told and updates in one click.
# Before: raise "version" in package.json (e.g. 1.0.1). Called by start.ps1 (P) or: npm run publish
# The data folder is the one chosen in the app (%APPDATA%\prospection-auto\local.json), or Documents\DC Prospect.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$local = Join-Path $env:APPDATA 'prospection-auto\local.json'
$localSettings = if (Test-Path $local) { Get-Content $local -Raw | ConvertFrom-Json } else { $null }
# dossierDrive: name written by a version before 1.2.0
$data = if ($localSettings) { if ($localSettings.dataFolder) { $localSettings.dataFolder } else { $localSettings.dossierDrive } } else { $null }
if (-not $data) { $data = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'DC Prospect' }
$folder = Join-Path $data 'Installation'
# npm run build compiles the TypeScript (out\) then runs electron-builder
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host 'Échec de la fabrication' -ForegroundColor Red; exit 1 }
New-Item -ItemType Directory -Force -Path $folder | Out-Null
Get-ChildItem $folder -Filter '*.exe' | Remove-Item -Force
Copy-Item (Join-Path $root "dist\DC-Prospect-Setup-$version.exe") -Destination (Join-Path $folder 'DC-Prospect-Setup.exe') -Force
# "fichier" too: the copies before 1.2.0 read that name to find the installer and update themselves
@{ version = $version; file = 'DC-Prospect-Setup.exe'; fichier = 'DC-Prospect-Setup.exe'; date = (Get-Date -Format 'yyyy-MM-dd HH:mm') } | ConvertTo-Json | Set-Content (Join-Path $folder 'latest.json') -Encoding UTF8
Write-Host "Publié : DC Prospect $version dans $folder" -ForegroundColor Green

# GitHub release with the installer (the file is too big for the repository itself: GitHub refuses files over 100 MB).
# The macOS and Linux files are added by the workflow .github/workflows/release.yml when the tag v<version> is pushed.
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $tag = "v$version"
    $notesFile = Join-Path $env:TEMP "dc-prospect-$tag.md"
    $changelog = Get-Content (Join-Path $root 'CHANGELOG.md') -Raw
    $start = $changelog.IndexOf("## $version")
    if ($start -ge 0) { $next = $changelog.IndexOf("`n## ", $start + 4); $notes = if ($next -gt 0) { $changelog.Substring($start, $next - $start) } else { $changelog.Substring($start) } } else { $notes = "DC Prospect $version" }
    Set-Content $notesFile $notes -Encoding UTF8
    gh release view $tag *> $null
    if ($LASTEXITCODE -eq 0) { gh release upload $tag (Join-Path $root "dist\DC-Prospect-Setup-$version.exe") --clobber }
    else { gh release create $tag (Join-Path $root "dist\DC-Prospect-Setup-$version.exe") --title "DC Prospect $version" --notes-file $notesFile }
    Write-Host "Release GitHub $tag à jour" -ForegroundColor Green
}
