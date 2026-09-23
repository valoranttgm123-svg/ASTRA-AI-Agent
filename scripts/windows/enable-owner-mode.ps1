param(
    [string]$RepoPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$envPath = Join-Path $RepoPath ".env.local"

if (-not (Test-Path $envPath)) {
    throw ".env.local not found at $envPath"
}

function Set-DotEnvValue {
    param(
        [string]$Content,
        [string]$Name,
        [string]$Value
    )

    $pattern = "(?m)^\s*" + [regex]::Escape($Name) + "\s*=.*$"
    $line = "$Name=$Value"

    if ([regex]::IsMatch($Content, $pattern)) {
        return [regex]::Replace($Content, $pattern, $line)
    }

    if ($Content.Length -gt 0 -and -not $Content.EndsWith("`n")) {
        $Content += "`r`n"
    }

    return $Content + $line + "`r`n"
}

$content = [System.IO.File]::ReadAllText($envPath)

$content = Set-DotEnvValue $content "ASTRA_COMPUTER_ENABLED" "true"
$content = Set-DotEnvValue $content "ASTRA_OWNER_MODE_ENABLED" "true"
$content = Set-DotEnvValue $content "ASTRA_REQUIRE_APPROVAL" "false"
$content = Set-DotEnvValue $content "ASTRA_ALLOW_SHELL" "true"
$content = Set-DotEnvValue $content "ASTRA_ALLOW_FILE_WRITE" "true"

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $content, $utf8)

Write-Host "ASTRA trusted local Owner Mode enabled in .env.local." -ForegroundColor Green
Write-Host "Computer Agent: enabled"
Write-Host "Owner executor: enabled"
Write-Host "Per-action approval: disabled for configured local execution"
Write-Host "Shell: enabled"
Write-Host "File writes: enabled"
Write-Host ""
Write-Host "Restart ASTRA-Agent before validating Owner Mode." -ForegroundColor Yellow
