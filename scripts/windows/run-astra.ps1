param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$nextCli = Join-Path $repoRoot 'node_modules\next\dist\bin\next'

if (-not (Test-Path -LiteralPath $nextCli -PathType Leaf)) {
  throw "ASTRA belum dibangun. Jalankan scripts\windows\install-local.ps1."
}

$existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 3
    if ($response.StatusCode -eq 200 -and $response.Content -match 'ASTRA') {
      exit 0
    }
  } catch {
    throw "Port $Port sudah dipakai proses lain. ASTRA tidak dijalankan."
  }
  throw "Port $Port sudah dipakai layanan yang bukan ASTRA."
}

$env:PORT = $Port.ToString()
Set-Location -LiteralPath $repoRoot
& (Get-Command node.exe -ErrorAction Stop).Source $nextCli start --hostname 127.0.0.1 -p $Port
