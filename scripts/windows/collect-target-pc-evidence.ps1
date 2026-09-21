param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017,

  [ValidateRange(1, 100)]
  [int]$PerformanceSamples = 10,

  [switch]$IncludePerformance,

  [switch]$IncludeChatPreflight,

  [ValidateSet("auto", "ollama", "codex")]
  [string]$Provider = "auto"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$privateRoot = Join-Path $repoRoot ".astra\readiness"
$baseUrl = "http://127.0.0.1:$Port"
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-EvidenceCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  $started = Get-Date
  try {
    & $Action
    $results.Add([pscustomobject]@{
      Name = $Name
      Status = "PASS"
      DurationMs = [math]::Round(((Get-Date) - $started).TotalMilliseconds, 1)
    })
  }
  catch {
    $results.Add([pscustomobject]@{
      Name = $Name
      Status = "FAIL"
      DurationMs = [math]::Round(((Get-Date) - $started).TotalMilliseconds, 1)
      ErrorType = $_.Exception.GetType().Name
    })
    Write-Warning "$Name failed: $($_.Exception.Message)"
  }
}

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & npm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm exited with code $LASTEXITCODE."
  }
}

New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null

Push-Location -LiteralPath $repoRoot
try {
  Invoke-EvidenceCheck -Name "windows-preflight" -Action {
    & (Join-Path $PSScriptRoot "preflight-local.ps1") -Port $Port
  }

  Invoke-EvidenceCheck -Name "runtime-self-check" -Action {
    & (Join-Path $PSScriptRoot "self-check.ps1") -BaseUrl $baseUrl
  }

  Invoke-EvidenceCheck -Name "windows-release-validator" -Action {
    & (Join-Path $PSScriptRoot "validate-windows-release.ps1") -Port $Port | Out-Host
  }

  Invoke-EvidenceCheck -Name "automation-readonly-status" -Action {
    & (Join-Path $PSScriptRoot "validate-automation.ps1") -Port $Port
  }

  if ($IncludePerformance) {
    Invoke-EvidenceCheck -Name "runtime-performance-readonly" -Action {
      Invoke-Npm -Arguments @(
        "run",
        "perf:runtime",
        "--",
        "--base",
        $baseUrl,
        "--samples",
        $PerformanceSamples.ToString(),
        "--ollama-turns",
        "0"
      )
    }
  }

  if ($IncludeChatPreflight) {
    Invoke-EvidenceCheck -Name "full-system-chat-preflight" -Action {
      Invoke-Npm -Arguments @(
        "run",
        "validate:preflight",
        "--",
        "--base",
        $baseUrl,
        "--provider",
        $Provider
      )
    }
  }
}
finally {
  Pop-Location
}

$commit = "unknown"
try {
  $commit = (& git -C $repoRoot rev-parse HEAD 2>$null).Trim()
}
catch {
  $commit = "unknown"
}

$failed = @($results | Where-Object { $_.Status -ne "PASS" })
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$evidencePath = Join-Path $privateRoot "target-pc-evidence-$timestamp.json"

$evidence = [ordered]@{
  SchemaVersion = 1
  CapturedAt = (Get-Date).ToUniversalTime().ToString("o")
  Commit = $commit
  BaseUrl = $baseUrl
  Port = $Port
  ReadOnlyCollectionPassed = ($failed.Count -eq 0)
  ReleaseVerdict = "NOT_EVALUATED"
  Checks = @($results)
  OptionalChecks = [ordered]@{
    PerformanceIncluded = [bool]$IncludePerformance
    ChatPreflightIncluded = [bool]$IncludeChatPreflight
    ChatProvider = if ($IncludeChatPreflight) { $Provider } else { "not-run" }
  }
  StillRequiresRealManualEvidence = @(
    "Phase 14 Level-2/3 approval behavior and STOP during a real running occurrence",
    "MEM-X real Sonor/Graphify/Obsidian provenance and cancellation validation",
    "Phase 16 browser/Humanoid HIGH FPS and console measurements",
    "Phase 17 approved real-write scenarios where integrations are configured",
    "Phase 17 emergency STOP against a real cancellable task"
  )
}

$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidencePath -Encoding UTF8

[pscustomobject]@{
  ReadOnlyCollectionPassed = ($failed.Count -eq 0)
  EvidencePath = $evidencePath
  ReleaseVerdict = "NOT_EVALUATED"
  FailedChecks = @($failed | ForEach-Object { $_.Name })
} | Format-List

if ($failed.Count -gt 0) {
  throw "Target-PC evidence collection completed with $($failed.Count) failed check(s). Evidence was saved privately."
}
