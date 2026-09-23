param([ValidateRange(1024, 65535)][int]$Port = 3017)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'stop-astra-runtime.ps1') -Port $Port | Out-Null

foreach ($taskName in 'ASTRA-Agent', 'ASTRA-Ollama') {
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  }
}

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ASTRA.url'
if (Test-Path -LiteralPath $shortcutPath -PathType Leaf) {
  Remove-Item -LiteralPath $shortcutPath -Force
}

Write-Output 'Autostart ASTRA dan pintasan desktop sudah dilepas. File proyek dan model tidak dihapus.'
