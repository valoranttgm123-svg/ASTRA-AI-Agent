param(
    [Parameter(Mandatory = $true)]
    [string[]]$Node,
    [string]$OutputPath = ".astra/computer-nodes.json"
)

$ErrorActionPreference = "Stop"

function Get-SafeSshEffectiveTarget {
    param([string]$Alias)

    $lines = @(& ssh.exe -G $Alias 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "ssh -G failed for alias $Alias."
    }

    $safe = @{}
    foreach ($line in $lines) {
        $text = [string]$line
        if ($text -match "^(hostname|user|port)\s+(.+)$") {
            $safe[$matches[1].ToLowerInvariant()] = $matches[2].Trim()
        }
    }
    return $safe
}

function Invoke-ComputerNameProbe {
    param([string]$Alias)

    $remoteScript = @'
$ErrorActionPreference = "Stop"
$payload = [pscustomobject]@{ computerName = $env:COMPUTERNAME }
$payload | ConvertTo-Json -Compress
'@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remoteScript))
    $remoteCommand = "powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded"

    $output = @(& ssh.exe -T -o BatchMode=yes -o ConnectTimeout=8 -o ConnectionAttempts=1 $Alias $remoteCommand 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        $detail = (($output | ForEach-Object { [string]$_ }) -join " ").Trim()
        if ($detail.Length -gt 500) { $detail = $detail.Substring(0, 500) }
        throw "SSH probe failed with exit code $exitCode. $detail"
    }

    $jsonLine = @($output | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ }) | Select-Object -Last 1
    if (-not $jsonLine) {
        throw "SSH probe returned no structured output."
    }

    try {
        $payload = $jsonLine | ConvertFrom-Json
    } catch {
        throw "SSH probe returned invalid JSON evidence."
    }

    $computerName = [string]$payload.computerName
    if ($computerName -notmatch "^[A-Za-z0-9][A-Za-z0-9-]{0,62}$") {
        throw "Remote COMPUTERNAME is missing or invalid."
    }
    return $computerName
}

$seen = @{}
$verified = @()
$failures = @()

foreach ($mapping in $Node) {
    if ($mapping -notmatch "^([A-Za-z0-9][A-Za-z0-9._-]{0,63})=([A-Za-z0-9][A-Za-z0-9._-]{0,127})$") {
        throw "Invalid -Node mapping '$mapping'. Use node-id=existing-ssh-alias."
    }

    $nodeId = $matches[1].ToLowerInvariant()
    $alias = $matches[2]
    if ($nodeId -eq "local") { throw "Node id local is reserved." }
    if ($seen.ContainsKey($nodeId)) { throw "Duplicate node id: $nodeId" }
    $seen[$nodeId] = $true

    Write-Host "Inspecting $nodeId through existing SSH alias $alias ..." -ForegroundColor Cyan

    try {
        $effective = Get-SafeSshEffectiveTarget -Alias $alias
        $hostName = [string]$effective["hostname"]
        $port = [string]$effective["port"]
        Write-Host "  effective HostName=$hostName Port=$port" -ForegroundColor DarkGray

        $computerName = Invoke-ComputerNameProbe -Alias $alias
        Write-Host "  verified COMPUTERNAME=$computerName" -ForegroundColor Green

        $verified += [pscustomobject]@{
            id = $nodeId
            label = $computerName
            transport = "SSH"
            trusted = $true
            sshAlias = $alias
            expectedComputerName = $computerName
        }
    } catch {
        $message = $_.Exception.Message
        $failures += [pscustomobject]@{ id = $nodeId; alias = $alias; detail = $message }
        Write-Host "  FAILED: $message" -ForegroundColor Red
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "No registry was written because one or more SSH targets failed verification." -ForegroundColor Yellow
    foreach ($failure in $failures) {
        Write-Host "  $($failure.id) [$($failure.alias)]: $($failure.detail)" -ForegroundColor Yellow
    }
    exit 2
}

$parent = Split-Path -Parent $OutputPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}

$document = [ordered]@{ version = 1; nodes = @($verified) }
$json = $document | ConvertTo-Json -Depth 6
Set-Content -LiteralPath $OutputPath -Value $json -Encoding UTF8

Write-Host ""
Write-Host "ASTRA private computer registry written: $OutputPath" -ForegroundColor Green
Write-Host "No password, token, private key, key path, or SSH config body was copied." -ForegroundColor Green
Write-Host "Restart ASTRA-Agent before running validate-multi-pc-owner-mode.ps1." -ForegroundColor Cyan
