param(
  [switch]$Disable,
  [switch]$DangerFullAccess
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot ".env.local"

function Set-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $line = "$Key=$Value"

  if (-not (Test-Path $envPath)) {
    New-Item -ItemType File -Path $envPath -Force | Out-Null
  }

  $lines = @(Get-Content -Path $envPath -ErrorAction SilentlyContinue)
  $pattern = "^" + [Regex]::Escape($Key) + "="
  $found = $false

  $updated = foreach ($existing in $lines) {
    if ($existing -match $pattern) {
      if (-not $found) {
        $found = $true
        $line
      }
    } else {
      $existing
    }
  }

  if (-not $found) {
    $updated += $line
  }

  Set-Content -Path $envPath -Value $updated -Encoding UTF8
}

if ($Disable) {
  Set-DotEnvValue "ASTRA_CODEX_SANDBOX" "read-only"
  Set-DotEnvValue "ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS" "false"
  Set-DotEnvValue "ASTRA_ALLOW_FILE_WRITE" "false"
  Set-DotEnvValue "ASTRA_ALLOW_SHELL" "false"

  Write-Host "ASTRA local execution disabled." -ForegroundColor Yellow
  Write-Host "Restart the Next.js server for the policy change to apply."
  exit 0
}

$codex = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codex) {
  Write-Warning "Codex CLI was not found on PATH. Execution mode will be configured, but ASTRA cannot execute local workspace tasks until Codex CLI is installed/authenticated."
} else {
  Write-Host "Codex CLI detected: $($codex.Source)" -ForegroundColor Green
}

Set-DotEnvValue "ASTRA_CODEX_ENABLED" "true"
Set-DotEnvValue "ASTRA_CODEX_WORKDIR" $repoRoot
Set-DotEnvValue "ASTRA_CODEX_SANDBOX" $(if ($DangerFullAccess) { "danger-full-access" } else { "workspace-write" })
Set-DotEnvValue "ASTRA_CODEX_ALLOW_DANGER_FULL_ACCESS" $(if ($DangerFullAccess) { "true" } else { "false" })

# Local execution permissions.
Set-DotEnvValue "ASTRA_REQUIRE_APPROVAL" "true"
Set-DotEnvValue "ASTRA_ALLOW_FILE_WRITE" "true"
Set-DotEnvValue "ASTRA_ALLOW_SHELL" "true"

# Keep remote side effects and paid cloud blocked by default.
Set-DotEnvValue "ASTRA_ALLOW_EXTERNAL_ACTIONS" "false"
Set-DotEnvValue "ASTRA_ALLOW_PAID_CLOUD" "false"

Write-Host ""
Write-Host "ASTRA local execution enabled." -ForegroundColor Cyan
Write-Host "Workspace: $repoRoot"
Write-Host "Sandbox: $(if ($DangerFullAccess) { 'danger-full-access (no OS workspace boundary)' } else { 'workspace-write' })"
Write-Host "Policy: file-write=ON, shell=ON, approval=REQUIRED, external-actions=OFF, paid-cloud=OFF"
Write-Host ""
Write-Host "Restart ASTRA:" -ForegroundColor Cyan
Write-Host "  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then use the EXECUTE TASK button. SEND remains chat/read-only."
