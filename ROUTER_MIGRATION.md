# React Router Migration Guide

## Overview

This Electron app is in the process of migrating from **state-based navigation** to **React Router**. This document provides guidance for future development and migration efforts.

## Current Status

### Hybrid Approach

We currently use a **hybrid navigation system**:

- **React Router** handles top-level routes (`/` and `/settings/:tab?`)
- **State-based navigation** still manages most UI transitions (messages, modals, etc.)
- Route changes sync with existing state to maintain backward compatibility

### Why MemoryRouter?

We use `MemoryRouter` instead of `BrowserRouter` or `HashRouter` for several Electron-specific reasons:

1. **Protocol Compatibility**: Electron apps use the `file://` protocol, which doesn't work well with `BrowserRouter`'s path-based routing
2. **No URL Bar**: Desktop apps don't have a URL bar, so memory-based routing is more natural
3. **Clean History**: MemoryRouter keeps navigation history in memory, perfect for single-window desktop applications
4. **Better UX**: Avoids URL artifacts that users would never see in a desktop app

## What's Migrated

### ✅ Components Using React Router

1. **App.tsx** (`src/renderer/App.tsx`)
   - Wrapped with `MemoryRouter`
   - Uses `useNavigate()` for `toggleSettings()` and `showMessageList()`
   - Syncs route with `showSettings` state via `useEffect`

2. **SettingsScreen** (`src/renderer/components/screens/settings/SettingsScreen.tsx`)
   - Reads initial tab from URL using `useParams()`
   - Routes: `/settings` → default tab, `/settings/Connectors` → Connectors tab

3. **StatusDisplay** (`src/renderer/components/StatusDisplay.tsx`)
   - Uses `useNavigate()` to navigate to `/settings/Connectors`
   - Provides click-to-navigate for expired connector warnings

## What's NOT Migrated

### ⏳ Components Still Using State-Based Navigation

The following components still use `setState` and callbacks for navigation:

1. **Message Detail Navigation** (in `App.tsx`)
   - `currentMessage` state
   - `showMessageDetail()` function
   - Should migrate to: `/message/:id` route

2. **Share Message Navigation** (in `App.tsx`)
   - `currentShareMessage` state
   - Should migrate to: `/share/:id` route

3. **Prompter Navigation** (in `App.tsx`)
   - `showPrompterOnly` state
   - `openPrompterOnly()` function
   - Should migrate to: `/prompter` route

4. **Onboarding Flow** (in `App.tsx`)
   - Conditional rendering based on `isGitHubConnected`
   - Should migrate to: `/onboarding` route with redirect logic

5. **Settings Tab Switching** (in `SettingsScreen.tsx`)
   - Internal tab switching uses `setActiveTab` state
   - Should update URL when tabs change: `/settings/WebSocket`, `/settings/Security`, etc.

6. **Settings Back Navigation** (in `SettingsScreen.tsx`)
   - Uses `onBack` callback prop
   - Should use `navigate(-1)` or `navigate('/')`

## Migration Strategy

### Principles

1. **Gradual Migration**: Migrate components one at a time as they're modified
2. **Backward Compatibility**: Keep existing state-based logic working during transition
3. **Test Thoroughly**: Electron navigation differs from web, test all flows
4. **Document Changes**: Update this file as you migrate components

### When to Migrate

Migrate a component to React Router when:

- ✅ Adding new navigation features
- ✅ Fixing navigation-related bugs
- ✅ Refactoring existing navigation code
- ✅ Implementing deep linking or state preservation
- ❌ Don't migrate just for the sake of it - prioritize active development areas

## Step-by-Step Migration Guide

### 1. Message Detail View

**Current State:**
```typescript
const [currentMessage, setCurrentMessage] = useState<Message | null>(null)
const showMessageDetail = (message: Message) => {
  setCurrentMessage(message)
}
```

**Migrated:**
```typescript
// In App.tsx - add route
<Route path="/message/:id" element={<MessageDetailView />} />

// In MessageDetailView component
const { id } = useParams<{ id: string }>()
const message = messages.find(m => m.id === id)

// In message list - navigate instead of setState
<Card onClick={() => navigate(`/message/${message.id}`)}>
```

### 2. Settings Tab Switching

**Current State:**
```typescript
const [activeTab, setActiveTab] = useState<TabType>('WebSocket')
<button onClick={() => setActiveTab('Connectors')}>
```

**Migrated:**
```typescript
const navigate = useNavigate()
const { tab } = useParams<{ tab?: string }>()

<button onClick={() => navigate('/settings/Connectors')}>
```

### 3. Settings Back Navigation

**Current State:**
```typescript
export const SettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return <button onClick={onBack}>Back</button>
}
```

**Migrated:**
```typescript
export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Back</button>
}
```

## Routes Reference

### Current Routes

```typescript
/ → Main view (message list or current message)
/settings → Settings with default tab
/settings/:tab → Settings with specific tab (WebSocket, Security, Notifications, Connectors, Advanced)
```

### Proposed Future Routes

```typescript
/ → Message list
/message/:id → Message detail view
/share/:id → Share message detail view
/prompter → Prompter-only view
/onboarding → GitHub connection onboarding
/settings → Settings with default tab
/settings/:tab → Settings with specific tab
```

## Testing Checklist

When migrating a component, test:

- [ ] Direct navigation works (clicking links/buttons)
- [ ] Browser-like back/forward (Electron may support this with MemoryRouter)
- [ ] Deep linking (if app is opened with a specific route)
- [ ] State preservation (does component state persist across navigation?)
- [ ] Error cases (invalid IDs, missing data, etc.)
- [ ] Electron-specific behaviors (window focus, multiple windows, etc.)

## Common Patterns

### Pattern 1: Simple Navigation

```typescript
import { useNavigate } from 'react-router-dom'

const Component = () => {
  const navigate = useNavigate()

  return <button onClick={() => navigate('/settings')}>Settings</button>
}
```

### Pattern 2: Navigation with Parameters

```typescript
import { useNavigate, useParams } from 'react-router-dom'

const Component = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  return <button onClick={() => navigate(`/message/${id}`)}>View</button>
}
```

### Pattern 3: Conditional Navigation

```typescript
const Component = () => {
  const navigate = useNavigate()

  const handleClick = () => {
    if (someCondition) {
      navigate('/path-a')
    } else {
      navigate('/path-b')
    }
  }

  return <button onClick={handleClick}>Go</button>
}
```

### Pattern 4: Programmatic Back Navigation

```typescript
const Component = () => {
  const navigate = useNavigate()

  return <button onClick={() => navigate(-1)}>Back</button>
}
```

### Pattern 5: Route Syncing with State

```typescript
const Component = () => {
  const location = useLocation()
  const [viewState, setViewState] = useState('list')

  useEffect(() => {
    // Sync route changes with state
    if (location.pathname.startsWith('/details')) {
      setViewState('details')
    } else {
      setViewState('list')
    }
  }, [location.pathname])
}
```

## Troubleshooting

### Issue: Navigation doesn't work

**Solution**: Make sure the component is rendered within a Router context:
```typescript
<MemoryRouter>
  <YourComponent />
</MemoryRouter>
```

### Issue: useNavigate() throws error

**Solution**: The component must be a descendant of a Router. Check that you're calling hooks inside the Router tree.

### Issue: Route params are undefined

**Solution**: Ensure the route pattern matches. For `/settings/:tab`, the param is `tab`, not `tabName`.

### Issue: State resets on navigation

**Solution**: Consider using React Context or URL state preservation for data that should persist across routes.

## AI Assistant Reference

### Quick Commands for AI

When working with this codebase, AI assistants should:

1. **Check this file first** before suggesting navigation changes
2. **Prefer React Router** for new navigation features
3. **Maintain backward compatibility** when migrating existing code
4. **Update this document** when migrating components
5. **Test Electron-specific** behaviors (this is not a web app)

### Migration Priority

When asked to add navigation features, prioritize:

1. Use React Router for new features
2. Gradually migrate actively modified components
3. Keep state-based navigation for untouched legacy code
4. Document what you migrate in this file

## Resources

- [React Router Documentation](https://reactrouter.com/)
- [React Router in Electron](https://github.com/electron-userland/electron-react-boilerplate)
- [MemoryRouter API](https://reactrouter.com/en/main/router-components/memory-router)

## Changelog

### 2024-11-08
- ✅ Initial React Router setup with MemoryRouter
- ✅ Migrated: App.tsx top-level navigation
- ✅ Migrated: SettingsScreen initial tab selection
- ✅ Migrated: StatusDisplay expired connector navigation
- 📝 Created this migration guide

---

**Last Updated**: 2024-11-08
**Status**: Hybrid (React Router + State-based)
**Goal**: Full React Router migration over time
