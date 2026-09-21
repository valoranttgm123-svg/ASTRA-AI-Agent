param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$selfCheck = Join-Path $PSScriptRoot "self-check.ps1"
. (Join-Path $PSScriptRoot "private-evidence-output.ps1")

function Assert-True {
  param(
    [Parameter(Mandatory = $true)]
    [bool]$Condition,

    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

$agentTask = Get-ScheduledTask -TaskName "ASTRA-Agent" -ErrorAction SilentlyContinue
$ollamaTask = Get-ScheduledTask -TaskName "ASTRA-Ollama" -ErrorAction SilentlyContinue

Assert-True -Condition ($null -ne $agentTask) -Message "ASTRA-Agent scheduled task tidak ditemukan."
Assert-True -Condition ($null -ne $ollamaTask) -Message "ASTRA-Ollama scheduled task tidak ditemukan."

$agentAction = @($agentTask.Actions)[0]
$ollamaAction = @($ollamaTask.Actions)[0]
$expectedPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$expectedAstraScript = Join-Path $PSScriptRoot "run-astra.ps1"
$expectedOllamaScript = Join-Path $PSScriptRoot "run-ollama.ps1"

Assert-True -Condition ($null -ne $agentAction) -Message "ASTRA-Agent tidak memiliki action."
Assert-True -Condition ($null -ne $ollamaAction) -Message "ASTRA-Ollama tidak memiliki action."
Assert-True -Condition ([string]$agentAction.Execute -ieq $expectedPowerShell) -Message "ASTRA-Agent action tidak memakai Windows PowerShell sistem."
Assert-True -Condition ([string]$ollamaAction.Execute -ieq $expectedPowerShell) -Message "ASTRA-Ollama action tidak memakai Windows PowerShell sistem."
Assert-True -Condition ([string]$agentAction.Arguments -match [regex]::Escape($expectedAstraScript)) -Message "ASTRA-Agent action tidak menunjuk runner ASTRA dari repository aktif."
Assert-True -Condition ([string]$agentAction.Arguments -match ("-Port\s+" + [regex]::Escape($Port.ToString()))) -Message "ASTRA-Agent action tidak menggunakan port yang divalidasi."
Assert-True -Condition ([string]$ollamaAction.Arguments -match [regex]::Escape($expectedOllamaScript)) -Message "ASTRA-Ollama action tidak menunjuk runner Ollama dari repository aktif."
Assert-True -Condition ([string]$agentTask.Principal.RunLevel -eq "Limited") -Message "ASTRA-Agent tidak memakai RunLevel Limited."
Assert-True -Condition ([string]$ollamaTask.Principal.RunLevel -eq "Limited") -Message "ASTRA-Ollama tidak memakai RunLevel Limited."
Assert-True -Condition ([string]$agentTask.State -ne "Disabled") -Message "ASTRA-Agent scheduled task disabled."
Assert-True -Condition ([string]$ollamaTask.State -ne "Disabled") -Message "ASTRA-Ollama scheduled task disabled."

$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "ASTRA.url"
Assert-True -Condition (Test-Path -LiteralPath $shortcutPath -PathType Leaf) -Message "Desktop shortcut ASTRA.url tidak ditemukan."
$shortcutContent = Get-Content -LiteralPath $shortcutPath -Raw
$expectedUrl = "URL=http://127.0.0.1:$Port/"
Assert-True -Condition ($shortcutContent -match [regex]::Escape($expectedUrl)) -Message "ASTRA.url tidak menunjuk loopback URL yang diharapkan."

$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
Assert-True -Condition ($listeners.Count -gt 0) -Message "Tidak ada listener ASTRA pada port $Port."

$nonLoopback = @($listeners | Where-Object {
  $_.LocalAddress -ne "127.0.0.1" -and
  $_.LocalAddress -ne "::1"
})
Assert-True -Condition ($nonLoopback.Count -eq 0) -Message "Ditemukan listener non-loopback pada port ASTRA."

& $selfCheck -BaseUrl "http://127.0.0.1:$Port" | Out-Null

$privateRoot = Initialize-AstraPrivateEvidenceDirectory -RepoRoot $repoRoot -Area "readiness"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$evidencePath = Resolve-AstraPrivateEvidenceFile -RepoRoot $repoRoot -Area "readiness" -FileName "windows-release-validation-$timestamp.json"

$evidence = [ordered]@{
  SchemaVersion = 1
  CapturedAt = (Get-Date).ToUniversalTime().ToString("o")
  LocalInstallChecksPassed = $true
  ReleaseVerdict = "NOT_EVALUATED"
  Port = $Port
  ListenerAddresses = @($listeners | ForEach-Object { [string]$_.LocalAddress })
  StartupTasks = [ordered]@{
    AstraAgent = [ordered]@{
      State = [string]$agentTask.State
      RunLevel = [string]$agentTask.Principal.RunLevel
      Script = "run-astra.ps1"
    }
    AstraOllama = [ordered]@{
      State = [string]$ollamaTask.State
      RunLevel = [string]$ollamaTask.Principal.RunLevel
      Script = "run-ollama.ps1"
    }
  }
  DesktopShortcut = [ordered]@{
    Present = $true
    Url = "http://127.0.0.1:$Port/"
  }
  PendingReleaseGates = @(
    "Phase 14 target-PC Automation approval/STOP validation",
    "MEM-X real Sonor/Graphify/Obsidian validation",
    "Phase 16 target runtime/browser measurements",
    "Phase 17 real scenarios including Emergency STOP"
  )
}

$evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $evidencePath -Encoding UTF8

[pscustomobject]@{
  LocalInstallChecksPassed = $true
  EvidencePath = $evidencePath
  ReleaseVerdict = "NOT_EVALUATED"
  AstraUrl = "http://127.0.0.1:$Port/"
}
