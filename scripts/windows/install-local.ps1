param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017,

  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$preflight = Join-Path $PSScriptRoot "preflight-local.ps1"
& $preflight -Port $Port | Out-Null

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not $SkipBuild) {
  Push-Location -LiteralPath $repoRoot
  try {
    & $npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci gagal.' }
    & $npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build gagal.' }
  } finally {
    Pop-Location
  }
}

$taskSettings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

$ollamaScript = Join-Path $PSScriptRoot 'run-ollama.ps1'
$ollamaAction = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ollamaScript`""
$ollamaTask = New-ScheduledTask -Action $ollamaAction -Trigger $trigger -Settings $taskSettings -Principal $principal
Register-ScheduledTask -TaskName 'ASTRA-Ollama' -InputObject $ollamaTask -Force | Out-Null

$astraScript = Join-Path $PSScriptRoot 'run-astra.ps1'
$astraAction = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$astraScript`" -Port $Port"
$astraTask = New-ScheduledTask -Action $astraAction -Trigger $trigger -Settings $taskSettings -Principal $principal
Register-ScheduledTask -TaskName 'ASTRA-Agent' -InputObject $astraTask -Force | Out-Null

Start-ScheduledTask -TaskName 'ASTRA-Ollama'
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'ASTRA-Agent'

$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'ASTRA.url'
$shortcutContent = "[InternetShortcut]`r`nURL=http://127.0.0.1:$Port/`r`n"
[System.IO.File]::WriteAllText($shortcutPath, $shortcutContent, [System.Text.Encoding]::ASCII)

Start-Sleep -Seconds 3
$astraStatus = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 10
$ollamaStatus = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 10
$automationStatus = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/automation/service" -TimeoutSec 10

[pscustomobject]@{
  AstraUrl = "http://127.0.0.1:$Port/"
  AstraHttpStatus = $astraStatus.StatusCode
  OllamaVersion = $ollamaStatus.version
  DesktopShortcut = $shortcutPath
  StartupTasks = 'ASTRA-Agent, ASTRA-Ollama'
  AutomationEnabled = $automationStatus.service.enabled
  AutomationRunning = $automationStatus.service.running
  AutomationDetail = $automationStatus.service.lastDetail
}
