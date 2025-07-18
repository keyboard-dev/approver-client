# OAuth Provider Setup Guide

This guide shows you how to set up OAuth providers for the approver app.

## Environment Variables

Create a `.env` file in the root directory with the following configuration:

```bash
# OAuth Provider Configuration

# Google OAuth Configuration
# Get these from: https://console.developers.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# GitHub OAuth Configuration  
# Get these from: https://github.com/settings/developers
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Microsoft OAuth Configuration
# Get these from: https://portal.azure.com/
MICROSOFT_CLIENT_ID=your_microsoft_client_id_here

# Encryption keys for secure token storage
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_32_byte_hex_key_here
CODE_ENCRYPTION_KEY=your_32_byte_hex_key_here

# Legacy OAuth Server (optional)
OAUTH_SERVER_URL=https://api.keyboard.dev

# Development mode - skip authentication (for testing)
SKIP_AUTH=false
```

## Provider Setup Instructions

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API and Gmail API (if needed)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Choose "Desktop application" as the application type
6. Add `http://localhost:8082/callback` to the redirect URIs
7. Copy both the Client ID and Client Secret to your `.env` file

### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: Your app name
   - Homepage URL: Your app URL
   - Authorization callback URL: `http://localhost:8082/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Fill in the application details:
   - Name: Your app name
   - Supported account types: Choose appropriate option
   - Redirect URI: `http://localhost:8082/callback`
5. Copy the Application (client) ID to your `.env` file

## Encryption Keys

Generate secure encryption keys for token storage:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CODE_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

1. Start the application
2. Go to Settings → OAuth Providers
3. Click "Connect" on any configured provider
4. Complete the OAuth flow in your browser
5. Your tokens will be securely stored and encrypted locally
6. Use "Copy Token" to get access tokens for API calls

## Technical Details

- **OAuth Callback Server**: Runs on `http://localhost:8082/callback`
- **WebSocket Server**: Runs on `http://localhost:8080` (separate from OAuth)
- **Custom Protocol**: No longer needed - uses localhost HTTP callbacks
- **Security**: PKCE flow with state validation to prevent CSRF attacks

## Features

- **Multiple Providers**: Support for Google, GitHub, Microsoft, and more
- **Secure Storage**: Tokens are encrypted and stored locally
- **Auto Refresh**: Tokens are automatically refreshed when expired
- **PKCE Support**: Uses PKCE for enhanced security where supported
- **Scoped Access**: Each provider requests specific scopes needed for functionality
- **Beautiful Success Pages**: User-friendly OAuth completion pages

## Troubleshooting

- Make sure redirect URIs are correctly configured as `http://localhost:8082/callback` in your OAuth apps
- Check that all required environment variables are set
- Verify encryption keys are 32 bytes (64 hex characters)
- Check console logs for detailed error messages
- Ensure port 8082 is not blocked by firewall
- If you see "invalid_request" errors, double-check the redirect URI configuration 