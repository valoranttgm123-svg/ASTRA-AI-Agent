param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3017,

  [string]$Remote = "origin",

  [string]$Branch = "main",

  [switch]$SkipPull,

  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$git = (Get-Command git.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$installer = Join-Path $PSScriptRoot "install-local.ps1"
$selfCheck = Join-Path $PSScriptRoot "self-check.ps1"
$envLocal = Join-Path $repoRoot ".env.local"
$privateRuntime = Join-Path $repoRoot ".astra"

$hadEnvLocal = Test-Path -LiteralPath $envLocal -PathType Leaf
$hadPrivateRuntime = Test-Path -LiteralPath $privateRuntime -PathType Container

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [string]$FailureMessage = "Native command failed."
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage Exit code: $LASTEXITCODE"
  }
}

Push-Location -LiteralPath $repoRoot
try {
  $currentBranch = (& $git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Tidak dapat membaca branch Git aktif."
  }

  if (-not $SkipPull) {
    $trackedChanges = & $git -C $repoRoot status --porcelain --untracked-files=no
    if ($LASTEXITCODE -ne 0) {
      throw "Tidak dapat membaca status Git."
    }

    if ($trackedChanges) {
      throw "Update dibatalkan karena ada perubahan tracked lokal. Commit/stash perubahan terlebih dahulu."
    }

    if ($currentBranch -ne $Branch) {
      throw "Update dibatalkan: branch aktif '$currentBranch', tetapi update diminta untuk '$Branch'. Pindah branch secara manual terlebih dahulu."
    }

    Invoke-Native -FilePath $git -Arguments @(
      "-C", $repoRoot,
      "pull",
      "--ff-only",
      $Remote,
      $Branch
    ) -FailureMessage "git pull --ff-only gagal."
  }

  $astraTask = Get-ScheduledTask -TaskName "ASTRA-Agent" -ErrorAction SilentlyContinue
  if ($astraTask) {
    Stop-ScheduledTask -TaskName "ASTRA-Agent" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }

  if (-not $SkipBuild) {
    Invoke-Native -FilePath $npm -Arguments @("ci") -FailureMessage "npm ci gagal."
    Invoke-Native -FilePath $npm -Arguments @("run", "build") -FailureMessage "npm run build gagal."
  }

  & $installer -Port $Port -SkipBuild

  if ($hadEnvLocal -and -not (Test-Path -LiteralPath $envLocal -PathType Leaf)) {
    throw ".env.local ada sebelum update tetapi tidak ditemukan setelah update. Update dihentikan."
  }

  if ($hadPrivateRuntime -and -not (Test-Path -LiteralPath $privateRuntime -PathType Container)) {
    throw ".astra ada sebelum update tetapi tidak ditemukan setelah update. Update dihentikan."
  }

  & $selfCheck -BaseUrl "http://127.0.0.1:$Port"

  $commit = (& $git -C $repoRoot rev-parse HEAD).Trim()

  [pscustomobject]@{
    Updated = $true
    Commit = $commit
    Branch = $currentBranch
    AstraUrl = "http://127.0.0.1:$Port/"
    EnvLocalPreserved = (-not $hadEnvLocal) -or (Test-Path -LiteralPath $envLocal -PathType Leaf)
    PrivateRuntimePreserved = (-not $hadPrivateRuntime) -or (Test-Path -LiteralPath $privateRuntime -PathType Container)
    UpdateMode = if ($SkipPull) { "LOCAL_FILES_ONLY" } else { "GIT_FF_ONLY" }
    BuildMode = if ($SkipBuild) { "SKIPPED" } else { "NPM_CI_BUILD" }
  }
}
finally {
  Pop-Location
}
