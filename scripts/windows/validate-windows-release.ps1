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

$agentTasks = @(Get-ScheduledTask -TaskName "ASTRA-Agent" -ErrorAction SilentlyContinue)
$ollamaTasks = @(Get-ScheduledTask -TaskName "ASTRA-Ollama" -ErrorAction SilentlyContinue)

Assert-True -Condition ($agentTasks.Count -eq 1) -Message "ASTRA-Agent scheduled task harus ada tepat satu."
Assert-True -Condition ($ollamaTasks.Count -eq 1) -Message "ASTRA-Ollama scheduled task harus ada tepat satu."

$agentTask = $agentTasks[0]
$ollamaTask = $ollamaTasks[0]
$agentActions = @($agentTask.Actions)
$ollamaActions = @($ollamaTask.Actions)
$agentTriggers = @($agentTask.Triggers)
$ollamaTriggers = @($ollamaTask.Triggers)

Assert-True -Condition ($agentActions.Count -eq 1) -Message "ASTRA-Agent harus memiliki tepat satu action."
Assert-True -Condition ($ollamaActions.Count -eq 1) -Message "ASTRA-Ollama harus memiliki tepat satu action."
Assert-True -Condition ($agentTriggers.Count -eq 1) -Message "ASTRA-Agent harus memiliki tepat satu trigger."
Assert-True -Condition ($ollamaTriggers.Count -eq 1) -Message "ASTRA-Ollama harus memiliki tepat satu trigger."

$agentAction = $agentActions[0]
$ollamaAction = $ollamaActions[0]
$agentTrigger = $agentTriggers[0]
$ollamaTrigger = $ollamaTriggers[0]
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$expectedPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$expectedAstraScript = Join-Path $PSScriptRoot "run-astra.ps1"
$expectedOllamaScript = Join-Path $PSScriptRoot "run-ollama.ps1"
$expectedAstraArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$expectedAstraScript`" -Port $Port"
$expectedOllamaArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$expectedOllamaScript`""

Assert-True -Condition ([string]$agentTask.TaskPath -eq "\") -Message "ASTRA-Agent harus berada pada root Task Scheduler."
Assert-True -Condition ([string]$ollamaTask.TaskPath -eq "\") -Message "ASTRA-Ollama harus berada pada root Task Scheduler."
Assert-True -Condition ([string]$agentTask.Principal.UserId -ieq $currentUser) -Message "ASTRA-Agent principal tidak cocok dengan user Windows aktif."
Assert-True -Condition ([string]$ollamaTask.Principal.UserId -ieq $currentUser) -Message "ASTRA-Ollama principal tidak cocok dengan user Windows aktif."
Assert-True -Condition ([string]$agentTask.Principal.LogonType -eq "Interactive") -Message "ASTRA-Agent tidak memakai Interactive logon."
Assert-True -Condition ([string]$ollamaTask.Principal.LogonType -eq "Interactive") -Message "ASTRA-Ollama tidak memakai Interactive logon."
Assert-True -Condition ([string]$agentTask.Principal.RunLevel -eq "Limited") -Message "ASTRA-Agent tidak memakai RunLevel Limited."
Assert-True -Condition ([string]$ollamaTask.Principal.RunLevel -eq "Limited") -Message "ASTRA-Ollama tidak memakai RunLevel Limited."
Assert-True -Condition ([string]$agentTrigger.CimClass.CimClassName -eq "MSFT_TaskLogonTrigger") -Message "ASTRA-Agent trigger bukan logon trigger."
Assert-True -Condition ([string]$ollamaTrigger.CimClass.CimClassName -eq "MSFT_TaskLogonTrigger") -Message "ASTRA-Ollama trigger bukan logon trigger."
Assert-True -Condition ([string]$agentTrigger.UserId -ieq $currentUser) -Message "ASTRA-Agent logon trigger tidak cocok dengan user Windows aktif."
Assert-True -Condition ([string]$ollamaTrigger.UserId -ieq $currentUser) -Message "ASTRA-Ollama logon trigger tidak cocok dengan user Windows aktif."
Assert-True -Condition ([string]$agentAction.Execute -ieq $expectedPowerShell) -Message "ASTRA-Agent action tidak memakai Windows PowerShell sistem."
Assert-True -Condition ([string]$ollamaAction.Execute -ieq $expectedPowerShell) -Message "ASTRA-Ollama action tidak memakai Windows PowerShell sistem."
Assert-True -Condition ([string]$agentAction.Arguments -ieq $expectedAstraArguments) -Message "ASTRA-Agent arguments berbeda dari kontrak installer."
Assert-True -Condition ([string]$ollamaAction.Arguments -ieq $expectedOllamaArguments) -Message "ASTRA-Ollama arguments berbeda dari kontrak installer."
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

$ollamaPort = 11434
$ollamaListeners = @(Get-NetTCPConnection -LocalPort $ollamaPort -State Listen -ErrorAction SilentlyContinue)
Assert-True -Condition ($ollamaListeners.Count -gt 0) -Message "Tidak ada listener Ollama pada port 11434."

$ollamaNonLoopback = @($ollamaListeners | Where-Object {
  $_.LocalAddress -ne "127.0.0.1" -and
  $_.LocalAddress -ne "::1"
})
Assert-True -Condition ($ollamaNonLoopback.Count -eq 0) -Message "Ditemukan listener Ollama non-loopback pada port 11434."

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
  OllamaListenerAddresses = @($ollamaListeners | ForEach-Object { [string]$_.LocalAddress })
  StartupTasks = [ordered]@{
    AstraAgent = [ordered]@{
      State = [string]$agentTask.State
      RunLevel = [string]$agentTask.Principal.RunLevel
      LogonType = [string]$agentTask.Principal.LogonType
      PrincipalMatchesCurrentUser = $true
      TaskPath = [string]$agentTask.TaskPath
      ActionCount = $agentActions.Count
      TriggerType = [string]$agentTrigger.CimClass.CimClassName
      Script = "run-astra.ps1"
    }
    AstraOllama = [ordered]@{
      State = [string]$ollamaTask.State
      RunLevel = [string]$ollamaTask.Principal.RunLevel
      LogonType = [string]$ollamaTask.Principal.LogonType
      PrincipalMatchesCurrentUser = $true
      TaskPath = [string]$ollamaTask.TaskPath
      ActionCount = $ollamaActions.Count
      TriggerType = [string]$ollamaTrigger.CimClass.CimClassName
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
