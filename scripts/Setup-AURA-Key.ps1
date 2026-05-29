# ============================================================
# AURA Command Center — One-time API Key Setup
# Run this ONCE to fix the "OpenAI API key not configured" error.
# Right-click this file → "Run with PowerShell"
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  AURA Command Center — API Key Setup" -ForegroundColor Cyan
Write-Host "  =====================================" -ForegroundColor Cyan
Write-Host ""

# ── Read the key from the project .env ──────────────────────────────────────
$projectEnv = "$PSScriptRoot\..\env"
$dotenv     = "$PSScriptRoot\..\.env"

$apiKey = $null

if (Test-Path $dotenv) {
    $lines = Get-Content $dotenv
    foreach ($line in $lines) {
        if ($line -match '^VITE_OPENAI_API_KEY=(.+)$') {
            $apiKey = $Matches[1].Trim()
            break
        }
    }
}

if (-not $apiKey) {
    Write-Host "  Could not read key from .env automatically." -ForegroundColor Yellow
    Write-Host "  Please paste your OpenAI API key below (starts with sk-):" -ForegroundColor Yellow
    $apiKey = Read-Host "  Key"
    $apiKey = $apiKey.Trim()
}

if (-not $apiKey -or -not $apiKey.StartsWith("sk-")) {
    Write-Host "  ERROR: Key looks invalid. Make sure it starts with sk-" -ForegroundColor Red
    pause
    exit 1
}

# ── Write to APPDATA so the installed app can find it ───────────────────────
$configDir = "$env:APPDATA\com.aura.commandcenter"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$envContent = "# AURA config - written by Setup-AURA-Key.ps1`nVITE_OPENAI_API_KEY=$apiKey`nOPENAI_API_KEY=$apiKey`n"
Set-Content -Path "$configDir\.env" -Value $envContent -Encoding UTF8

Write-Host "  [OK] Key written to: $configDir\.env" -ForegroundColor Green

# ── Also set as a permanent Windows user environment variable ────────────────
[System.Environment]::SetEnvironmentVariable("VITE_OPENAI_API_KEY", $apiKey, "User")
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY",       $apiKey, "User")

Write-Host "  [OK] Key set as Windows user environment variable" -ForegroundColor Green
Write-Host ""
Write-Host "  Setup complete!" -ForegroundColor Cyan
Write-Host "  Close AURA and reopen it — voice should work immediately." -ForegroundColor White
Write-Host ""
pause
