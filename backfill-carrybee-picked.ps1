$ErrorActionPreference = "Stop"

function Get-EnvMap {
    param(
        [string]$Path = ".env.local"
    )

    if (-not (Test-Path $Path)) {
        throw "Could not find $Path"
    }

    $map = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^(.*?)=(.*)$') {
            $map[$matches[1]] = $matches[2]
        }
    }

    return $map
}

$envMap = Get-EnvMap
$supabaseUrl = $envMap["VITE_SUPABASE_URL"]
$anonKey = $envMap["VITE_SUPABASE_ANON_KEY"]

if (-not $supabaseUrl -or -not $anonKey) {
    throw "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local"
}

$functionUrl = "$supabaseUrl/functions/v1/courier-sync-statuses"
$headers = @{
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
}

$cursor = $null
$iteration = 0
$totalChecked = 0
$totalUpdated = 0
$statusTotals = @{}

function Get-IntOrZero {
    param(
        $Value
    )

    if ($null -eq $Value -or $Value -eq "") {
        return 0
    }

    return [int]$Value
}

do {
    $iteration++
    $payload = @{
        mode = "backfill"
        limit = 100
    }

    if ($cursor) {
        $payload.cursorCreatedAt = $cursor
    }

    $response = Invoke-RestMethod `
        -Uri $functionUrl `
        -Headers $headers `
        -Method Post `
        -Body ($payload | ConvertTo-Json)

    $data = $response.data
    $checked = Get-IntOrZero $data.checked
    $updated = Get-IntOrZero $data.updated
    $cursor = $data.nextCursorCreatedAt
    $hasMore = [bool]($data.hasMore)

    $totalChecked += $checked
    $totalUpdated += $updated

    if ($data.statusCounts) {
        foreach ($prop in $data.statusCounts.PSObject.Properties) {
            $currentTotal = 0
            if ($statusTotals.ContainsKey($prop.Name)) {
                $currentTotal = Get-IntOrZero $statusTotals[$prop.Name]
            }
            $statusTotals[$prop.Name] = $currentTotal + (Get-IntOrZero $prop.Value)
        }
    }

    Write-Host ("Batch {0}: checked={1}, updated={2}, cursor={3}" -f $iteration, $checked, $updated, $cursor) -ForegroundColor Cyan

    if ($data.errors -and $data.errors.Count -gt 0) {
        Write-Host "Errors in this batch:" -ForegroundColor Yellow
        $data.errors | Select-Object -First 5 | Format-Table | Out-String | Write-Host
    }

    if (-not $hasMore -or -not $cursor) {
        break
    }
} while ($true)

Write-Host ""
Write-Host "CarryBee backfill completed." -ForegroundColor Green
Write-Host ("Total checked: {0}" -f $totalChecked) -ForegroundColor Green
Write-Host ("Total updated: {0}" -f $totalUpdated) -ForegroundColor Green
Write-Host "Status summary:" -ForegroundColor Green
$statusTotals.GetEnumerator() | Sort-Object Name | Format-Table Name, Value | Out-String | Write-Host
