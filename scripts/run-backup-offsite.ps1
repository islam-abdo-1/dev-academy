$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "exports\backups"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "backup-task.log"
$node = (Get-Command node.exe).Source
$env:BACKUP_INCLUDE_HF = "0"
& $node (Join-Path $PSScriptRoot "backup-offsite.mjs") *>> $log
exit $LASTEXITCODE
