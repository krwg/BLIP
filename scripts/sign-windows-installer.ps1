# Authenticode-sign BLIP-Setup-*.exe so electron-updater on v1.0.0 accepts the update.
# Requires Windows SDK signtool (or Visual Studio "Desktop development with C++").
#
# Env (do NOT reuse electron-builder CSC_LINK unless you sign during `electron:build`):
#   BLIP_WIN_SIGN_PFX     — path to .pfx
#   BLIP_WIN_SIGN_PASSWORD — pfx password
#
# Usage:
#   .\scripts\sign-windows-installer.ps1 -InstallerPath "dist-electron\BLIP-Setup-1.0.1.exe"
# Then re-upload the signed exe + regenerate latest.yml (npm run electron:build:win publishes both).

param(
  [Parameter(Mandatory = $true)]
  [string] $InstallerPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $InstallerPath)) {
  throw "Installer not found: $InstallerPath"
}

$pfx = $env:BLIP_WIN_SIGN_PFX
$pass = $env:BLIP_WIN_SIGN_PASSWORD
if (-not $pfx) {
  throw 'Set BLIP_WIN_SIGN_PFX and BLIP_WIN_SIGN_PASSWORD (optional post-build sign for v1.0.0 auto-update).'
}

$signtool = @(
  "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe",
  "${env:ProgramFiles}\Windows Kits\10\bin\*\x64\signtool.exe"
) | ForEach-Object { Get-Item $_ -ErrorAction SilentlyContinue } | Sort-Object FullName -Descending | Select-Object -First 1

if (-not $signtool) {
  throw 'signtool.exe not found. Install Windows SDK or VS Build Tools.'
}

$timestamp = 'http://timestamp.digicert.com'
Write-Host "[sign] Using $($signtool.FullName)"
Write-Host "[sign] File: $InstallerPath"

& $signtool.FullName sign /f $pfx /p $pass /tr $timestamp /td sha256 /fd sha256 $InstallerPath

Write-Host '[sign] OK. Re-upload this exe to the GitHub release and replace latest.yml if needed.'
