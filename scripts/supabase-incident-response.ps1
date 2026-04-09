param(
    [switch]$CreateTicket
)

$ErrorActionPreference = "Stop"

function Get-EnvMap([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Environment file not found: $Path"
    }

    $map = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2) { continue }
        $map[$parts[0].Trim()] = $parts[1].Trim()
    }
    return $map
}

function Invoke-Step([string]$Title, [scriptblock]$Action) {
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
    try {
        & $Action
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

$envFile = Join-Path $PSScriptRoot "..\.env.local"
$envMap = Get-EnvMap $envFile

if (-not $envMap.ContainsKey("ACCESS_TOKEN")) {
    throw "ACCESS_TOKEN is missing from .env.local"
}

if (-not $envMap.ContainsKey("VITE_SUPABASE_URL")) {
    throw "VITE_SUPABASE_URL is missing from .env.local"
}

if (-not $envMap.ContainsKey("VITE_SUPABASE_ANON_KEY")) {
    throw "VITE_SUPABASE_ANON_KEY is missing from .env.local"
}

$env:SUPABASE_ACCESS_TOKEN = $envMap["ACCESS_TOKEN"]
$projectUrl = $envMap["VITE_SUPABASE_URL"].TrimEnd("/")
$anonKey = $envMap["VITE_SUPABASE_ANON_KEY"]
$projectRef = [System.Uri]$projectUrl | ForEach-Object { $_.Host.Split(".")[0] }

Write-Host "Project ref: $projectRef" -ForegroundColor Yellow
Write-Host "Project url: $projectUrl" -ForegroundColor Yellow

Invoke-Step "Project status" {
    npx supabase projects list -o json
}

Invoke-Step "Physical backups" {
    npx supabase backups list --project-ref $projectRef -o json
}

Invoke-Step "REST health probe" {
    curl.exe --max-time 20 -H "apikey: $anonKey" -H "Authorization: Bearer $anonKey" "$projectUrl/rest/v1/customers?select=id&limit=1"
}

Invoke-Step "Auth settings probe" {
    curl.exe --max-time 20 -H "apikey: $anonKey" "$projectUrl/auth/v1/settings"
}

Invoke-Step "Storage health probe" {
    curl.exe --max-time 20 "$projectUrl/storage/v1/health"
}

Invoke-Step "Long-running queries" {
    npx supabase inspect db long-running-queries --linked --debug
}

Invoke-Step "Blocking queries" {
    npx supabase inspect db blocking --linked --debug
}

Invoke-Step "Database locks" {
    npx supabase inspect db locks --linked --debug
}

Invoke-Step "Database stats" {
    npx supabase inspect db db-stats --linked --debug
}

if ($CreateTicket) {
    Invoke-Step "Create Supabase support ticket from failing inspect command" {
        npx supabase inspect db long-running-queries --linked --debug --create-ticket
    }
}
