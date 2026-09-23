param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017,

  [ValidateRange(5, 120)]
  [int]$TimeoutSec = 45,

  [ValidateRange(100, 5000)]
  [int]$PollIntervalMs = 500
)

$ErrorActionPreference = "Stop"
$watch = [Diagnostics.Stopwatch]::StartNew()
$lastAstraError = $null
$lastOllamaError = $null
$lastAutomationError = $null

function Get-ProbeBudget {
  # Brain status includes independently bounded provider probes. Three seconds
  # can reject a healthy fallback while an optional provider takes five seconds.
  $remaining = [math]::Floor($TimeoutSec - $watch.Elapsed.TotalSeconds)
  if ($remaining -lt 1) { throw 'Startup health deadline reached.' }
  return [int][math]::Min(15, $remaining)
}

while ($watch.Elapsed.TotalSeconds -lt $TimeoutSec) {
  $astraReady = $false
  $ollamaVersion = $null
  $automationService = $null

  try {
    $astra = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/agent" -TimeoutSec (Get-ProbeBudget)
    $astraReady = $astra.ready -eq $true
    $lastAstraError = $null
  }
  catch {
    $lastAstraError = $_.Exception.Message
  }

  try {
    $ollama = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/version" -TimeoutSec (Get-ProbeBudget)
    if ($ollama.version) {
      $ollamaVersion = [string]$ollama.version
    }
    $lastOllamaError = $null
  }
  catch {
    $lastOllamaError = $_.Exception.Message
  }

  try {
    $automation = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/automation/service" -TimeoutSec (Get-ProbeBudget)
    if ($null -ne $automation.service) {
      $automationService = $automation.service
    }
    $lastAutomationError = $null
  }
  catch {
    $lastAutomationError = $_.Exception.Message
  }

  if ($astraReady -and $ollamaVersion -and $null -ne $automationService) {
    $watch.Stop()
    return [pscustomobject]@{
      Ready = $true
      AstraReady = $true
      OllamaVersion = $ollamaVersion
      AutomationEnabled = $automationService.enabled -eq $true
      AutomationRunning = $automationService.running -eq $true
      AutomationDetail = [string]$automationService.lastDetail
      ElapsedMs = [math]::Round($watch.Elapsed.TotalMilliseconds, 0)
    }
  }

  Start-Sleep -Milliseconds $PollIntervalMs
}

$watch.Stop()
$parts = @()
if ($lastAstraError) { $parts += "ASTRA: $lastAstraError" }
if ($lastOllamaError) { $parts += "Ollama: $lastOllamaError" }
if ($lastAutomationError) { $parts += "Automation: $lastAutomationError" }
$detail = if ($parts.Count -gt 0) { $parts -join " | " } else { "health conditions were not satisfied" }
throw "ASTRA local startup health timeout after $TimeoutSec seconds. $detail"
