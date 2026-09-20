param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017,

  [switch]$RunSafeTick
)

$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:$Port"

Write-Host "ASTRA Automation validation" -ForegroundColor Cyan
Write-Host "Endpoint: $base"

$service = Invoke-RestMethod -Uri "$base/api/automation/service" -Method Get -TimeoutSec 10
$automation = Invoke-RestMethod -Uri "$base/api/automation" -Method Get -TimeoutSec 10

if (-not $service.service) {
  throw "Automation service status payload is missing."
}
if (-not $automation.available) {
  throw "Automation store is not available: $($automation.detail)"
}

$svc = $service.service
$queue = $automation.queue

Write-Host ""
Write-Host "Service" -ForegroundColor Cyan
[pscustomobject]@{
  Enabled = $svc.enabled
  Running = $svc.running
  TickActive = $svc.tickActive
  PollMs = $svc.pollIntervalMs
  NextTick = $svc.nextTickAt
  Detail = $svc.lastDetail
} | Format-List

Write-Host "Definitions / queue" -ForegroundColor Cyan
[pscustomobject]@{
  Definitions = @($automation.automations).Count
  ReadyReadOnly = if ($queue) { @($queue.ready).Count } else { 0 }
  WaitingApproval = if ($queue) { @($queue.waitingApproval).Count } else { 0 }
  DeferredReadOnly = if ($queue) { $queue.deferredReadyCount } else { 0 }
  DeferredApproval = if ($queue) { $queue.deferredWaitingApprovalCount } else { 0 }
} | Format-List

$unsafeReady = @()
if ($queue) {
  $unsafeReady = @(
    $queue.ready | Where-Object {
      [int]$_.requiredPermissionLevel -gt 1
    }
  )
}
if ($unsafeReady.Count -gt 0) {
  throw "SAFETY FAILURE: queue.ready contains a Level 2+ occurrence."
}

$level4 = @(
  $automation.automations | Where-Object {
    [int]$_.requiredPermissionLevel -ge 4
  }
)
if ($level4.Count -gt 0) {
  throw "SAFETY FAILURE: a Level-4 automation definition was loaded."
}

if ($RunSafeTick) {
  if (-not $svc.enabled) {
    throw "Cannot run a safe tick because the background service opt-in is OFF."
  }

  Write-Host "Running one explicit safe tick..." -ForegroundColor Yellow
  $headers = @{ "x-astra-client" = "1" }
  $body = @{ action = "tick" } | ConvertTo-Json -Compress
  $tick = Invoke-RestMethod -Uri "$base/api/automation/service" -Method Post -ContentType "application/json" -Headers $headers -Body $body -TimeoutSec 120

  Write-Host "Safe tick result" -ForegroundColor Cyan
  $tick.result | ConvertTo-Json -Depth 8
}

Write-Host ""
Write-Host "PASS: Automation safety/status validation completed." -ForegroundColor Green
Write-Host "Unattended ceiling remains Level 0/1. Level 2/3 stay approval-gated; Level 4 is unavailable."
