Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$changes = git status --porcelain
if (-not $changes) {
    Write-Output "No changes to commit."
    exit 0
}

git add -A

$message = if ($args.Count -gt 0 -and $args[0]) {
    $args[0]
} else {
    "Update project files"
}

git commit -m $message
git push origin main

Write-Output "Pushed to origin/main: $message"
