#!/bin/bash
# Deployment script for Supabase Edge Function

# Get the Supabase Access Token
echo "========================================"
echo "Supabase Edge Function Deployment"
echo "========================================"
echo ""
echo "To deploy the CarryBee Stores function, you need a Supabase Access Token."
echo ""
echo "Steps to get your Access Token:"
echo "1. Go to https://app.supabase.com"
echo "2. Click on your profile icon (top right)"
echo "3. Go to 'Settings'"
echo "4. Select 'Access Tokens' from the left menu"
echo "5. Click 'Generate new token'"
echo "6. Give it a name and select all permissions"
echo "7. Copy the token"
echo ""
read -p "Paste your Supabase Access Token: " SUPABASE_ACCESS_TOKEN

# Set environment variable
export SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN

# Link the project
echo ""
echo "Linking project..."
npx supabase link --project-ref ozjddzasadgffjjeqntc

# Deploy the function
echo ""
echo "Deploying Edge Function..."
npx supabase functions deploy carrybee-stores

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Your Edge Function is now live at:"
echo "https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-stores"
echo ""
echo "You can now use the Store ID dropdown in Settings with CarryBee API."
