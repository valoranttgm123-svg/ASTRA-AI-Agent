param(
    [string]$BaseUrl = "http://127.0.0.1:3000",
    [string]$NodesFile = ""
)

$ErrorActionPreference = "Stop"

$base = $BaseUrl.TrimEnd("/")
$statusUri = "$base/api/agent"
$headers = @{ "x-astra-client" = "1" }

if (-not $NodesFile) {
    if ($env:ASTRA_COMPUTER_NODES_FILE) {
        $NodesFile = $env:ASTRA_COMPUTER_NODES_FILE
    } else {
        $NodesFile = ".astra/computer-nodes.json"
    }
}

if (-not (Test-Path -LiteralPath $NodesFile -PathType Leaf)) {
    throw "Private computer node registry not found: $NodesFile"
}

$config = Get-Content -LiteralPath $NodesFile -Raw | ConvertFrom-Json
if ([int]$config.version -ne 1) {
    throw "Computer node registry must use version 1."
}

$trusted = @($config.nodes | Where-Object {
    $_.trusted -eq $true -and [string]$_.transport -eq "SSH"
})

if ($trusted.Count -eq 0) {
    throw "No trusted SSH computer nodes are registered."
}

Write-Host "Checking ASTRA multi-PC runtime at $statusUri ..." -ForegroundColor Cyan
$status = Invoke-RestMethod -Uri $statusUri -Method GET -Headers $headers

if ([bool]$status.permissions.requireApproval) {
    throw "Multi-PC Owner Mode validation requires ASTRA_REQUIRE_APPROVAL=false."
}
if (-not [bool]$status.permissions.allowShell) {
    throw "Multi-PC Owner Mode validation requires ASTRA_ALLOW_SHELL=true."
}

$computerDetail = [string]$status.features.computer.detail
if ($computerDetail -notmatch "owner exec=READY") {
    throw "computer.owner.exec is not READY. Current detail: $computerDetail"
}

foreach ($node in $trusted) {
    $nodeId = [string]$node.id
    if (-not $nodeId) {
        throw "Trusted SSH node has no id."
    }

    $safeMarkerId = ($nodeId -replace '[^A-Za-z0-9]', '_').ToUpperInvariant()
    $marker = "ASTRA_REMOTE_OWNER_${safeMarkerId}_OK"

    Write-Host "Validating trusted node $nodeId ..." -ForegroundColor Cyan
    $body = @{
        message  = "@$nodeId powershell: Write-Output $marker"
        mode     = "execute"
        approved = $false
        provider = "auto"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri $statusUri -Method POST -Headers $headers -ContentType "application/json" -Body $body

    if (-not $result.ok -or [string]$result.state -ne "completed") {
        throw "Remote Owner Mode failed for node $nodeId`: $($result.message)"
    }
    if ([string]$result.brain.provider -ne "routing_only") {
        throw "Node $nodeId unexpectedly used provider '$($result.brain.provider)'."
    }
    if ([int]$result.brain.context.memoryEntries -ne 0) {
        throw "Node $nodeId unexpectedly loaded memory."
    }
    if ($null -ne $result.brain.plan) {
        throw "Node $nodeId unexpectedly created a planner plan."
    }
    if ([string]$result.message -notmatch [regex]::Escape($marker)) {
        throw "Node $nodeId did not return its expected marker."
    }
    if ([string]$result.message -notmatch '\(SSH\)') {
        throw "Node $nodeId did not report SSH transport evidence."
    }

    Write-Host "PASS $nodeId - routing_only / SSH / no memory / no planner" -ForegroundColor Green
}

$unknownId = "astra-unknown-node"
$unknownMarker = "ASTRA_UNKNOWN_NODE_MUST_NOT_RUN"
$unknownBody = @{
    message  = "@$unknownId powershell: Write-Output $unknownMarker"
    mode     = "execute"
    approved = $false
    provider = "auto"
} | ConvertTo-Json

Write-Host "Checking unknown-node fail-closed behavior ..." -ForegroundColor Cyan
$unknown = Invoke-RestMethod -Uri $statusUri -Method POST -Headers $headers -ContentType "application/json" -Body $unknownBody

if ($unknown.ok -or [string]$unknown.state -eq "completed") {
    throw "Unknown node unexpectedly completed. Silent fallback protection failed."
}
if ([string]$unknown.message -match [regex]::Escape($unknownMarker)) {
    throw "Unknown-node marker appeared in output. A command may have executed unexpectedly."
}

Write-Host "PASS unknown-node fail-closed" -ForegroundColor Green
Write-Host "ASTRA multi-PC direct Owner Mode validation: PASS" -ForegroundColor Green
