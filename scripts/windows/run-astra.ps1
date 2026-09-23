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

$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
$nonLoopback = @($listeners | Where-Object {
  $_.LocalAddress -ne '127.0.0.1' -and
  $_.LocalAddress -ne '::1'
})

if ($nonLoopback.Count -gt 0) {
  throw "Port $Port memiliki listener non-loopback. ASTRA menolak berjalan pada port yang terekspos jaringan."
}

$ipv4Loopback = @($listeners | Where-Object {
  $_.LocalAddress -eq '127.0.0.1'
})

if ($ipv4Loopback.Count -gt 0) {
  try {
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/agent" -TimeoutSec 3
    if (
      $status.ready -eq $true -and
      $null -ne $status.capabilities -and
      $null -ne $status.features
    ) {
      exit 0
    }
  }
  catch {
    # The listener exists but is not a healthy ASTRA status endpoint.
  }

  throw "Port $Port sudah dipakai listener loopback yang bukan ASTRA sehat."
}

$env:PORT = $Port.ToString()
Set-Location -LiteralPath $repoRoot
$server = Start-Process -FilePath (Get-Command node.exe -ErrorAction Stop).Source -ArgumentList ('"' + $nextCli + '" start --hostname 127.0.0.1 -p ' + $Port) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
$server.WaitForExit()
if ($server.ExitCode -ne 0) { throw "ASTRA server exited with code $($server.ExitCode)." }
