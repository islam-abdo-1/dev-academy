param(
  [int]$MaxAgeHours = 36
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$destination = if ($env:ONEDRIVE_BACKUP_DIR) {
  $env:ONEDRIVE_BACKUP_DIR
} else {
  "C:\Users\islam\OneDrive\DevAcademyBackups"
}
$alert = Join-Path $destination "BACKUP-ALERT.txt"
$log = Join-Path $root "exports\backups\backup-check.log"

function Write-CheckLog([string]$message) {
  $line = "$(Get-Date -Format o) $message"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $log) | Out-Null
  Add-Content -Path $log -Encoding UTF8 -Value $line
  Write-Host $line
}

if (-not (Test-Path $destination)) {
  Write-CheckLog "FAIL backup directory missing: $destination"
  exit 1
}

$latest = Get-ChildItem $destination -Directory |
  Where-Object { $_.Name -match '^\d{8}_\d{6}$' } |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $latest) {
  $message = "No backup directory found in $destination"
  Write-CheckLog "FAIL $message"
  Set-Content -Path $alert -Encoding UTF8 -Value "$message`nChecked at $(Get-Date -Format o)"
  exit 1
}

$archive = Get-ChildItem $latest.FullName -Filter "*.7z" | Select-Object -First 1
if (-not $archive) {
  $message = "No archive found in $($latest.FullName)"
  Write-CheckLog "FAIL $message"
  Set-Content -Path $alert -Encoding UTF8 -Value "$message`nChecked at $(Get-Date -Format o)"
  exit 1
}

$age = (Get-Date) - $archive.LastWriteTime
if ($age.TotalHours -gt $MaxAgeHours) {
  $message = "Latest backup is $([math]::Round($age.TotalHours, 1)) hours old (limit ${MaxAgeHours}h): $($archive.FullName)"
  Write-CheckLog "FAIL $message"
  Set-Content -Path $alert -Encoding UTF8 -Value "$message`nChecked at $(Get-Date -Format o)"
  exit 1
}

Remove-Item $alert -Force -ErrorAction SilentlyContinue
Write-CheckLog "OK latest backup $($archive.Name) age=$([math]::Round($age.TotalHours, 1))h"
exit 0
