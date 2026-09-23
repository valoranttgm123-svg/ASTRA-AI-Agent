param(
    [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

$base = $BaseUrl.TrimEnd("/")
$statusUri = "$base/api/agent"
$headers = @{
    "x-astra-client" = "1"
}

Write-Host "Checking ASTRA Computer Agent status at $statusUri ..." -ForegroundColor Cyan
$status = Invoke-RestMethod -Uri $statusUri -Method GET -Headers $headers

$computerDetail = [string]$status.features.computer.detail
if ($computerDetail -notmatch "owner exec=READY") {
    throw "computer.owner.exec is not READY. Current detail: $computerDetail"
}

$probe = "ASTRA_OWNER_DIRECT_OK"
$body = @{
    message  = "powershell: Write-Output $probe"
    mode     = "execute"
    approved = $true
    provider = "auto"
} | ConvertTo-Json

Write-Host "Executing direct Owner Mode probe ..." -ForegroundColor Cyan
$result = Invoke-RestMethod -Uri $statusUri -Method POST -Headers $headers -ContentType "application/json" -Body $body

if (-not $result.ok) {
    throw "Owner Mode probe failed: $($result.message)"
}

if ([string]$result.state -ne "completed") {
    throw "Owner Mode probe did not complete. State: $($result.state)"
}

if ([string]$result.brain.provider -ne "routing_only") {
    throw "Direct path unexpectedly used provider '$($result.brain.provider)'."
}

if ([int]$result.brain.context.memoryEntries -ne 0) {
    throw "Direct path unexpectedly loaded memory."
}

if ($null -ne $result.brain.plan) {
    throw "Direct path unexpectedly created a planner plan."
}

if ([string]$result.message -notmatch [regex]::Escape($probe)) {
    throw "Probe stdout token was not returned by ASTRA."
}

$eventTypes = @($result.brain.events | ForEach-Object { [string]$_.type })
if ($eventTypes -notcontains "tool.started" -or $eventTypes -notcontains "tool.completed") {
    throw "Expected tool.started/tool.completed evidence was not present."
}

Write-Host "ASTRA PC1 Owner Mode direct path: PASS" -ForegroundColor Green
Write-Host "Provider: $($result.brain.provider)"
Write-Host "Memory entries: $($result.brain.context.memoryEntries)"
Write-Host "State: $($result.state)"
Write-Host "Result:"
Write-Host $result.message
