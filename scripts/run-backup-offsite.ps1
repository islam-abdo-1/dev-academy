$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "exports\backups"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "backup-task.log"
$node = (Get-Command node.exe).Source

$env:BACKUP_INCLUDE_HF = "0"
$env:BACKUP_RESUME = "1"
$env:BACKUP_MEDIA_CONCURRENCY = "6"

$maxAttempts = 2
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  if ($attempt -gt 1) {
    Add-Content -Path $log -Encoding UTF8 -Value "=== retry $attempt/$maxAttempts at $(Get-Date -Format o) ==="
    Start-Sleep -Seconds 300
  }

  & $node (Join-Path $PSScriptRoot "backup-offsite.mjs") *>> $log
  if ($LASTEXITCODE -eq 0) {
    exit 0
  }

  Add-Content -Path $log -Encoding UTF8 -Value "=== attempt $attempt failed with exit $LASTEXITCODE ==="
}

exit 1
