# Pipedream Auto-Refresh Implementation

## Overview

This document describes the automatic refresh functionality that detects when a user completes a Pipedream OAuth connection flow and automatically updates the UI to show the new connection.

## Implementation Details

### Hook: `usePipedream`

**File:** `src/renderer/hooks/usePipedream.ts`

#### Constants

- **Poll Interval:** 3 seconds (`POLL_INTERVAL_MS = 3000`)
  - Industry standard for OAuth callback detection
  - Balances responsiveness with server load

- **Poll Timeout:** 120 seconds (`POLL_TIMEOUT_MS = 120000`)
  - 2 minutes to complete OAuth flow
  - Typical time for users to authenticate and authorize

#### Key Functions

##### `startPolling(appSlug: string)`
Initiates automatic polling when a user clicks "Connect" on a Pipedream app.

**Behavior:**
1. Stores the current accounts list as a baseline
2. Stores the app slug we're waiting for
3. Sets up an interval that calls `listAccounts()` every 3 seconds
4. Compares new accounts against baseline to detect additions
5. Sets up a timeout to stop polling after 2 minutes

##### `checkForNewAccount(newAccounts: PipedreamAccount[])`
Detects if a new account matching the expected app has been added.

**Logic:**
- Compares `newAccounts` against `accountsBeforePollingRef.current`
- Looks for an account where:
  - `app.nameSlug` matches the expected app slug
  - Account ID doesn't exist in the baseline accounts
- Returns `true` if new account found, `false` otherwise

##### `stopPolling()`
Cleans up polling resources.

**Actions:**
1. Clears the polling interval
2. Clears the timeout
3. Resets the connecting app state
4. Logs polling completion

##### `connectApp(appSlug: string)`
Modified to start polling after opening the OAuth link.

**Flow:**
1. Sets `connectingApp` state (shows "Connecting..." in UI)
2. Opens the OAuth link in external browser
3. Calls `startPolling(appSlug)` to begin checking for completion
4. `connectingApp` state persists until polling completes

#### Lifecycle Management

**Cleanup on Unmount:**
```typescript
useEffect(() => {
  return () => {
    stopPolling()
  }
}, [stopPolling])
```

This ensures polling is stopped if:
- User navigates away from the page
- Component unmounts for any reason
- App is closed

## User Experience Flow

```
1. User clicks "Connect" on a Pipedream app
   └─> Button shows "Connecting..." state
   └─> External browser opens with OAuth flow
   └─> Polling starts (every 3 seconds)

2. User completes OAuth in browser
   └─> Pipedream creates the account connection
   └─> Browser may redirect or show success message

3. Next poll (within 3 seconds) detects new account
   └─> Polling stops automatically
   └─> "Connecting..." state clears
   └─> New account appears in "Connected Accounts" list
   └─> No manual refresh needed!

Alternative: User takes too long or abandons flow
   └─> After 120 seconds, polling stops automatically
   └─> "Connecting..." state clears
   └─> User can try again or manually refresh
```

## Benefits

1. **Better UX:** Users see their connection appear automatically within 3 seconds
2. **No Manual Refresh:** Eliminates the need to click the refresh button
3. **Resource Efficient:** Polling stops after success or timeout
4. **Robust Cleanup:** Handles component unmount and navigation
5. **Visual Feedback:** "Connecting..." state persists during entire flow

## Components Using This Feature

Both components automatically benefit from the polling logic through the `usePipedream` hook:

### 1. ConnectedAppsPanel
**File:** `src/renderer/components/screens/settings/panels/ConnectedAppsPanel.tsx`

**Usage:**
```typescript
const { connectApp, connectingApp } = usePipedream()

const handleConnect = async (appSlug: string) => {
  await connectApp(appSlug) // Automatically starts polling
}
```

### 2. ConnectorsContent
**File:** `src/renderer/components/ui/ConnectorsContent.tsx`

**Usage:**
```typescript
const { connectApp, connectingApp } = usePipedream()

const handleConnectPipedream = async (appSlug: string) => {
  await connectApp(appSlug) // Automatically starts polling
}
```

## Technical Notes

### Why Refs Instead of State?

The polling logic uses `useRef` for:
- `pollingIntervalRef` - stores interval ID
- `pollingTimeoutRef` - stores timeout ID
- `pollingAppSlugRef` - stores expected app slug
- `accountsBeforePollingRef` - stores baseline accounts

**Reason:** Avoids dependency issues in `useEffect` and callbacks. These values don't need to trigger re-renders when they change.

### Error Handling

- API errors during polling are logged but don't stop the polling
- Polling continues until success or timeout
- If `openConnectLink` fails, polling is never started

### Multiple Simultaneous Connections

The current implementation supports one connection attempt at a time:
- `pollingAppSlugRef` stores a single app slug
- Starting a new connection while one is in progress replaces the previous polling target
- This matches the UI behavior (one "Connecting..." button at a time)

## Testing the Implementation

### Manual Test Steps

1. **Start the app** and navigate to Settings > Pipedream Integrations
2. **Search for an app** (e.g., "Google Drive")
3. **Click "Connect"** button
   - ✅ Button should show "Connecting..."
   - ✅ External browser should open OAuth flow
4. **Complete OAuth** in the browser
   - ✅ Within 3 seconds, the connected account should appear
   - ✅ "Connecting..." should clear automatically
5. **Test timeout:** Click "Connect" but don't complete OAuth
   - ✅ After 2 minutes, "Connecting..." should clear
6. **Test navigation:** Click "Connect" then navigate away
   - ✅ Polling should stop (check console logs)

### Console Logs

The implementation includes helpful logging:
```
[usePipedream] Starting polling for google-drive...
[usePipedream] Detected new connection for google-drive: {...}
[usePipedream] Stopped polling for new connections
```

Or on timeout:
```
[usePipedream] Starting polling for google-drive...
[usePipedream] Polling timeout reached for google-drive
[usePipedream] Stopped polling for new connections
```

## Future Enhancements

Possible improvements:
1. Show a countdown or progress indicator during polling
2. Add retry logic if API calls fail repeatedly
3. Support multiple simultaneous connection attempts
4. Add user notification when connection succeeds
5. Persist polling state across app restarts (if desired)
