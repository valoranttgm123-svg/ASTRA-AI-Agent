param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$nextCli = Join-Path $repoRoot 'node_modules\next\dist\bin\next'
$ownedPattern = '(?i)(?:^|[\s"])' + [regex]::Escape($nextCli) + '"?\s+start\s+--hostname\s+127\.0\.0\.1\s+-p\s+' + $Port + '(?:\s|$)'
$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
$owned = @()
foreach ($listener in $listeners) {
  if ($listener.LocalAddress -notin @('127.0.0.1', '::1')) {
    throw 'Refusing to stop a non-loopback listener.'
  }
  $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if (-not $candidate -or $candidate.Name -ne 'node.exe' -or $candidate.CommandLine -notmatch $ownedPattern) {
    throw 'Port belongs to a different process or ASTRA checkout; no process was stopped.'
  }
  $owned += $candidate
}

if (Get-ScheduledTask -TaskName 'ASTRA-Agent' -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName 'ASTRA-Agent' -ErrorAction Stop
}
foreach ($candidate in $owned) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($candidate.ProcessId)"
  if (-not $current) { continue }
  if ($current.CreationDate -ne $candidate.CreationDate -or $current.CommandLine -ne $candidate.CommandLine) {
    throw 'Process identity changed during shutdown; refusing a reused PID.'
  }
  Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop
}

$deadline = [DateTime]::UtcNow.AddSeconds(10)
do {
  $remaining = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  if ($remaining.Count -eq 0) { break }
  Start-Sleep -Milliseconds 200
} while ([DateTime]::UtcNow -lt $deadline)
if ($remaining.Count -gt 0) { throw 'ASTRA port is still occupied after bounded shutdown.' }
[pscustomobject]@{ Stopped = $true; Port = $Port; OwnedServersStopped = $owned.Count }
