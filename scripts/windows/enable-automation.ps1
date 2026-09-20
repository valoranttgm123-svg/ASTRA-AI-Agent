param(
  [switch]$Disable,

  [ValidateRange(15, 300)]
  [int]$PollSeconds = 60,

  [ValidateRange(1024, 65535)]
  [int]$Port = 3017
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envPath = Join-Path $repoRoot ".env.local"

function Set-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $line = "$Key=$Value"
  if (-not (Test-Path -LiteralPath $envPath)) {
    New-Item -ItemType File -Path $envPath -Force | Out-Null
  }

  $lines = @(Get-Content -LiteralPath $envPath -ErrorAction SilentlyContinue)
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

  Set-Content -LiteralPath $envPath -Value $updated -Encoding UTF8
}

Set-DotEnvValue "ASTRA_AUTOMATION_ENABLED" "true"
Set-DotEnvValue "ASTRA_AUTOMATION_FILE" ".astra/automations.json"
Set-DotEnvValue "ASTRA_AUTOMATION_SERVICE_ENABLED" $(if ($Disable) { "false" } else { "true" })
Set-DotEnvValue "ASTRA_AUTOMATION_SERVICE_POLL_MS" ([string]($PollSeconds * 1000))

$task = Get-ScheduledTask -TaskName "ASTRA-Agent" -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName "ASTRA-Agent" -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 750
  Start-ScheduledTask -TaskName "ASTRA-Agent"
  Start-Sleep -Seconds 3
} else {
  Write-Warning "ASTRA-Agent scheduled task was not found. Restart the ASTRA server manually for the setting to apply."
}

$mode = if ($Disable) { "DISABLED" } else { "ENABLED" }
Write-Host "ASTRA Automation service: $mode" -ForegroundColor Cyan
Write-Host "Poll interval: $PollSeconds seconds"
Write-Host "Unattended ceiling: Permission Level 0/1 only"
Write-Host "Level 2/3 remain per-occurrence approval gated; Level 4 remains unavailable."

try {
  $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/automation/service" -TimeoutSec 10
  $status.service | Format-List enabled,running,tickActive,pollIntervalMs,lastDetail
} catch {
  Write-Warning "Service status endpoint could not be verified yet: $($_.Exception.Message)"
}
