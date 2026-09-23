param(
  [Parameter(Mandatory = $true)][string]$HermesHome,
  [Parameter(Mandatory = $true)][string]$Python
)

$ErrorActionPreference = 'Stop'
$profileRoot = (Resolve-Path -LiteralPath $HermesHome).Path
$pythonPath = (Resolve-Path -LiteralPath $Python).Path
if (-not (Test-Path -LiteralPath (Join-Path $profileRoot 'config.yaml') -PathType Leaf)) {
  throw 'An existing reviewed Hermes profile is required; this runner does not create one.'
}
if (Get-NetTCPConnection -LocalPort 8642 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Hermes port is occupied; refusing a duplicate gateway.'
}
$env:HERMES_HOME = $profileRoot
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
# Official Hermes detached mode absorbs inherited Windows console control events.
# Keep its real console interpreter; pythonw causes descendant console flashes.
$env:HERMES_GATEWAY_DETACHED = '1'
$gateway = Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'hermes_cli.main', 'gateway', 'run') -WindowStyle Hidden -PassThru
$gateway.WaitForExit()
if ($gateway.ExitCode -ne 0) { throw "Hermes gateway exited with code $($gateway.ExitCode)." }
