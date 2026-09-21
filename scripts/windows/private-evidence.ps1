$ErrorActionPreference = "Stop"

function Assert-AstraPrivateDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if (-not $item.PSIsContainer) {
    throw "$Label must be a directory."
  }

  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "$Label must not be a symlink, junction, or other reparse point."
  }

  return $item
}

function Initialize-AstraPrivateReadinessDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $repoFull = [System.IO.Path]::GetFullPath($RepoRoot)
  $privateRoot = Join-Path $repoFull ".astra"
  $readinessRoot = Join-Path $privateRoot "readiness"

  if (-not (Test-Path -LiteralPath $privateRoot)) {
    New-Item -ItemType Directory -Path $privateRoot | Out-Null
  }
  Assert-AstraPrivateDirectory -Path $privateRoot -Label "Private .astra root" | Out-Null

  if (-not (Test-Path -LiteralPath $readinessRoot)) {
    New-Item -ItemType Directory -Path $readinessRoot | Out-Null
  }
  Assert-AstraPrivateDirectory -Path $readinessRoot -Label "Private readiness directory" | Out-Null

  $privateFull = [System.IO.Path]::GetFullPath($privateRoot)
  $readinessFull = [System.IO.Path]::GetFullPath($readinessRoot)
  $privatePrefix = $privateFull.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

  if (-not $readinessFull.StartsWith($privatePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Private readiness directory must stay inside .astra."
  }

  return $readinessFull
}

function Get-AstraPrivateReadinessEvidencePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$FileName
  )

  if ([System.IO.Path]::GetFileName($FileName) -ne $FileName) {
    throw "Private evidence file name must not contain path components."
  }

  $readinessRoot = Initialize-AstraPrivateReadinessDirectory -RepoRoot $RepoRoot
  $candidate = Join-Path $readinessRoot $FileName
  $candidateFull = [System.IO.Path]::GetFullPath($candidate)
  $readinessPrefix = $readinessRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

  if (-not $candidateFull.StartsWith($readinessPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Private evidence output must stay inside .astra\readiness."
  }

  if (Test-Path -LiteralPath $candidateFull) {
    $item = Get-Item -LiteralPath $candidateFull -Force -ErrorAction Stop
    if ($item.PSIsContainer) {
      throw "Private evidence output target must be a regular file."
    }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Private evidence output target must not be a symlink, junction, or other reparse point."
    }
  }

  return $candidateFull
}
