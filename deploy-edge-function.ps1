# Deployment script for Supabase Edge Function (Windows PowerShell)

Write-Host "========================================" -ForegroundColor Green
Write-Host "Supabase Edge Function Deployment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To deploy the CarryBee Stores function, you need a Supabase Access Token." -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps to get your Access Token:"
Write-Host "1. Go to https://app.supabase.com"
Write-Host "2. Click on your profile icon (top right)"
Write-Host "3. Go to 'Settings'"
Write-Host "4. Select 'Access Tokens' from the left menu"
Write-Host "5. Click 'Generate new token'"
Write-Host "6. Give it a name and select all permissions"
Write-Host "7. Copy the token"
Write-Host ""
$AccessToken = Read-Host "Paste your Supabase Access Token"

# Set environment variable
$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Write-Host ""
Write-Host "Linking project..." -ForegroundColor Cyan
npx supabase link --project-ref ozjddzasadgffjjeqntc

if ($LASTEXITCODE -ne 0) {
    Write-Host "Link failed. Please try again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deploying Edge Function..." -ForegroundColor Cyan
npx supabase functions deploy carrybee-stores

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed. Please check the error above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your Edge Function is now live at:" -ForegroundColor Green
Write-Host "https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-stores"
Write-Host ""
Write-Host "You can now use the Store ID dropdown in Settings with CarryBee API." -ForegroundColor Green
