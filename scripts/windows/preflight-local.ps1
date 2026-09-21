param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$node = Get-Command node.exe -ErrorAction Stop
$npm = Get-Command npm.cmd -ErrorAction Stop
$git = Get-Command git.exe -ErrorAction Stop

$nodeVersionText = (& $node.Source --version).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Tidak dapat membaca versi Node.js."
}

if ($nodeVersionText -match '^v(?<major>\d+)\.') {
  $nodeMajor = [int]$Matches.major
}
else {
  throw "Format versi Node.js tidak dikenali: $nodeVersionText"
}
if ($nodeMajor -lt 20) {
  throw "ASTRA membutuhkan Node.js major 20 atau lebih baru. Terdeteksi: $nodeVersionText"
}

$packageJson = Join-Path $repoRoot "package.json"
$packageLock = Join-Path $repoRoot "package-lock.json"
$gitDir = Join-Path $repoRoot ".git"

if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) {
  throw "package.json tidak ditemukan di repository ASTRA."
}
if (-not (Test-Path -LiteralPath $packageLock -PathType Leaf)) {
  throw "package-lock.json tidak ditemukan di repository ASTRA."
}
if (-not (Test-Path -LiteralPath $gitDir)) {
  throw "Metadata .git tidak ditemukan. Jalankan installer dari checkout ASTRA yang valid."
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$portState = if ($listener) { "LISTENING" } else { "FREE" }

[pscustomobject]@{
  Ready = $true
  Repository = $repoRoot
  NodeVersion = $nodeVersionText
  NodeMajor = $nodeMajor
  NpmPath = $npm.Source
  GitPath = $git.Source
  Port = $Port
  PortState = $portState
  Elevated = $isAdmin
  RequiresAdministrator = $false
  EnvLocalPresent = Test-Path -LiteralPath (Join-Path $repoRoot ".env.local") -PathType Leaf
  PrivateRuntimePresent = Test-Path -LiteralPath (Join-Path $repoRoot ".astra") -PathType Container
}
