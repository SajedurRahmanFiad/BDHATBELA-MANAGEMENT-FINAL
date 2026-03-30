# PowerShell script to deploy all CarryBee Edge Functions

Write-Host "Deploying CarryBee Edge Functions..." -ForegroundColor Cyan
Write-Host ""

# Require an access token from environment instead of hardcoding secrets in repo
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "SUPABASE_ACCESS_TOKEN is not set. Please export it before running this script." -ForegroundColor Red
    exit 1
}

$functions = @(
    "carrybee-cities",
    "carrybee-zones",
    "carrybee-areas",
    "carrybee-order-details",
    "courier-sync-statuses"
)

foreach ($functionName in $functions) {
    Write-Host ("Deploying {0}..." -f $functionName) -ForegroundColor Yellow
    npx supabase functions deploy $functionName
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("Failed to deploy {0}" -f $functionName) -ForegroundColor Red
    } else {
        Write-Host ("[OK] {0} deployed" -f $functionName) -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "All Edge Functions Deployed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your Edge Functions are now live:" -ForegroundColor Green
foreach ($functionName in $functions) {
    Write-Host ("  - https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/{0}" -f $functionName)
}
Write-Host ""
