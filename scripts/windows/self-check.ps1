param(
  [string]$BaseUrl = "http://127.0.0.1:3017",
  [int]$TimeoutMs = 10000,
  [string]$Output
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
Push-Location $repoRoot
try {
  $argsList = @(
    "run",
    "release:self-check",
    "--",
    "--base",
    $BaseUrl,
    "--timeout-ms",
    $TimeoutMs
  )

  if ($Output) {
    $argsList += @("--output", $Output)
  }

  & $npm @argsList
  if ($LASTEXITCODE -ne 0) {
    throw "ASTRA readiness self-check failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
