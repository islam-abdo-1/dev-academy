#requires -Version 5.1
<#
.SYNOPSIS
  Build and deploy the site to Cloudflare Pages from a clean commit.

.DESCRIPTION
  Refuses to deploy when the working tree has uncommitted changes or the
  current branch is not master, so every production deployment maps to a
  known Git commit. Runs typecheck and build before uploading.

  Requires CLOUDFLARE_API_TOKEN (loaded from the repository .env when the
  variable is not already set).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
      $name = $matches[1]
      $value = $matches[2].Trim().Trim('"').Trim("'")
      if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
      }
    }
  }
}

Import-DotEnv (Join-Path $root ".env")

if (-not $env:CLOUDFLARE_API_TOKEN) {
  throw "CLOUDFLARE_API_TOKEN is not set. Add it to .env or the environment."
}

$branch = git rev-parse --abbrev-ref HEAD
if ($LASTEXITCODE -ne 0) { throw "Not a git repository." }
if ($branch -ne "master") {
  throw "Deploy from master (current branch: $branch). Merge or check out master first."
}

$dirty = git status --porcelain
if ($dirty) {
  throw "Working tree is not clean. Commit or stash these changes first:`n$dirty"
}

$commit = git rev-parse --short HEAD
$subject = git log -1 --pretty=%s
Write-Host "Deploying $commit on $branch - $subject"

Push-Location (Join-Path $root "app")
try {
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw "typecheck failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "build failed" }
} finally {
  Pop-Location
}

Push-Location (Join-Path $root "workers/hf-upload")
try {
  # Run from the Worker directory so the Pages Functions in ./functions are bundled.
  $wranglerArgs = @(
    "wrangler", "pages", "deploy", "../../app/dist",
    "--project-name", "dev-academy",
    "--branch", "main",
    "--commit-hash", $commit,
    "--commit-dirty=false",
    "--commit-message", $subject
  )
  & npx @wranglerArgs
  if ($LASTEXITCODE -ne 0) { throw "wrangler pages deploy failed" }
} finally {
  Pop-Location
}

Write-Host "Deployed $commit to https://dev-academy.pages.dev"
