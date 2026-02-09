# PowerShell script to deploy all CarryBee Edge Functions

Write-Host "Deploying CarryBee Edge Functions..." -ForegroundColor Cyan
Write-Host ""

# Set the access token
$env:SUPABASE_ACCESS_TOKEN = "sbp_23a6f68dd3b0fb611a57d93a28022c5f4595645f"

# Deploy cities function
Write-Host "Deploying carrybee-cities..." -ForegroundColor Yellow
npx supabase functions deploy carrybee-cities
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to deploy carrybee-cities" -ForegroundColor Red
} else {
    Write-Host "✓ carrybee-cities deployed" -ForegroundColor Green
}

Write-Host ""

# Deploy zones function
Write-Host "Deploying carrybee-zones..." -ForegroundColor Yellow
npx supabase functions deploy carrybee-zones
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to deploy carrybee-zones" -ForegroundColor Red
} else {
    Write-Host "✓ carrybee-zones deployed" -ForegroundColor Green
}

Write-Host ""

# Deploy areas function
Write-Host "Deploying carrybee-areas..." -ForegroundColor Yellow
npx supabase functions deploy carrybee-areas
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to deploy carrybee-areas" -ForegroundColor Red
} else {
    Write-Host "✓ carrybee-areas deployed" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "All Edge Functions Deployed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your Edge Functions are now live:" -ForegroundColor Green
Write-Host "  - https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-cities"
Write-Host "  - https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-zones"
Write-Host "  - https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-areas"
Write-Host ""
