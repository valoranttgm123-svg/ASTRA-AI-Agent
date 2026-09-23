$ErrorActionPreference = 'Stop'

$ollamaPort = 11434
$loopbackHost = '127.0.0.1:11434'

$listeners = @(Get-NetTCPConnection -LocalPort $ollamaPort -State Listen -ErrorAction SilentlyContinue)
$nonLoopback = @($listeners | Where-Object {
  $_.LocalAddress -ne '127.0.0.1' -and
  $_.LocalAddress -ne '::1'
})

if ($nonLoopback.Count -gt 0) {
  throw 'Ollama port 11434 memiliki listener non-loopback. ASTRA menolak memakai Ollama yang terekspos jaringan.'
}

try {
  $response = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 3
  if ($response.version) {
    exit 0
  }
} catch {
  # The local server is not running yet.
}

$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (-not (Test-Path -LiteralPath $ollama -PathType Leaf)) {
  throw 'Ollama tidak ditemukan pada instalasi pengguna Windows.'
}

# ASTRA owns this scheduled-task process boundary and forces Ollama to loopback.
$env:OLLAMA_HOST = $loopbackHost

# Give the server its own hidden console, as with the ASTRA/Hermes runners.
# An inherited console can close while the scheduled task is still needed
# (STATUS_CONTROL_C_EXIT); do not tie the model server to that console lifetime.
$server = Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -PassThru
$server.WaitForExit()
if ($server.ExitCode -ne 0) { throw "Ollama server exited with code $($server.ExitCode)." }
