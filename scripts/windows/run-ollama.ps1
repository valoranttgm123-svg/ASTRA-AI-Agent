$ErrorActionPreference = 'Stop'

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

& $ollama serve
