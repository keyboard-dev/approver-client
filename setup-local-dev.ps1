# Setup script for local development with keyboard-ai
# This creates a .env.local file in the app's user data directory
# to override the server URL for local development

$userDataPath = "$env:APPDATA\keyboard-ai"
$envLocalPath = Join-Path $userDataPath ".env.local"

# Create directory if it doesn't exist
if (-not (Test-Path $userDataPath)) {
    New-Item -ItemType Directory -Path $userDataPath -Force | Out-Null
    Write-Host "✓ Created directory: $userDataPath"
}

# Create .env.local file
$envContent = "OAUTH_SERVER_URL=http://localhost:4000"
Set-Content -Path $envLocalPath -Value $envContent
Write-Host "✓ Created .env.local at: $envLocalPath"
Write-Host ""
Write-Host "The app will now use http://localhost:4000 for the OAuth server."
Write-Host "To revert to production, delete the file: $envLocalPath"
