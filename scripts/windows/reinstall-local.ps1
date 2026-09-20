param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017,

  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$uninstaller = Join-Path $PSScriptRoot "uninstall-local.ps1"
$installer = Join-Path $PSScriptRoot "install-local.ps1"
$selfCheck = Join-Path $PSScriptRoot "self-check.ps1"
$envLocal = Join-Path $repoRoot ".env.local"
$privateRuntime = Join-Path $repoRoot ".astra"

$hadEnvLocal = Test-Path -LiteralPath $envLocal -PathType Leaf
$hadPrivateRuntime = Test-Path -LiteralPath $privateRuntime -PathType Container

& $uninstaller
if ($LASTEXITCODE -ne 0) {
  throw "uninstall-local.ps1 gagal."
}

if ($SkipBuild) {
  & $installer -Port $Port -SkipBuild
}
else {
  & $installer -Port $Port
}

if ($LASTEXITCODE -ne 0) {
  throw "install-local.ps1 gagal saat reinstall."
}

if ($hadEnvLocal -and -not (Test-Path -LiteralPath $envLocal -PathType Leaf)) {
  throw ".env.local ada sebelum reinstall tetapi tidak ditemukan setelah reinstall."
}

if ($hadPrivateRuntime -and -not (Test-Path -LiteralPath $privateRuntime -PathType Container)) {
  throw ".astra ada sebelum reinstall tetapi tidak ditemukan setelah reinstall."
}

& $selfCheck -BaseUrl "http://127.0.0.1:$Port"
if ($LASTEXITCODE -ne 0) {
  throw "Readiness self-check gagal setelah reinstall."
}

[pscustomobject]@{
  Reinstalled = $true
  AstraUrl = "http://127.0.0.1:$Port/"
  ProjectFilesDeleted = $false
  ModelFilesDeleted = $false
  EnvLocalPreserved = (-not $hadEnvLocal) -or (Test-Path -LiteralPath $envLocal -PathType Leaf)
  PrivateRuntimePreserved = (-not $hadPrivateRuntime) -or (Test-Path -LiteralPath $privateRuntime -PathType Container)
  BuildMode = if ($SkipBuild) { "SKIPPED" } else { "NPM_CI_BUILD" }
}
