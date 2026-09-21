function Assert-AstraPrivateDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }

  $item = Get-Item -LiteralPath $Path -Force
  if (-not $item.PSIsContainer) {
    throw "$Label must be a directory."
  }

  $isReparsePoint = (
    ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  )
  if ($isReparsePoint) {
    throw "$Label must not be a symbolic link, junction, or other reparse point."
  }

  return $item.FullName
}

function Initialize-AstraPrivateEvidenceDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [ValidateSet("readiness")]
    [string]$Area = "readiness"
  )

  $repo = (Resolve-Path -LiteralPath $RepoRoot).Path
  $privateRoot = Join-Path $repo ".astra"
  $privateRoot = Assert-AstraPrivateDirectory -Path $privateRoot -Label "Private .astra root"

  $areaRoot = Join-Path $privateRoot $Area
  $areaRoot = Assert-AstraPrivateDirectory -Path $areaRoot -Label "Private evidence directory"

  return $areaRoot
}

function Resolve-AstraPrivateEvidenceFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [ValidateSet("readiness")]
    [string]$Area = "readiness",

    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9][A-Za-z0-9._-]*\.json$")]
    [string]$FileName
  )

  $areaRoot = Initialize-AstraPrivateEvidenceDirectory -RepoRoot $RepoRoot -Area $Area
  $candidate = Join-Path $areaRoot $FileName

  if (Test-Path -LiteralPath $candidate) {
    throw "Private evidence output target must not already exist."
  }

  return $candidate
}
