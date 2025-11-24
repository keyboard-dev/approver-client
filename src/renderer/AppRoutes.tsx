import { Route, Routes } from 'react-router-dom'
import { AppContent } from './App'
import { ChatPage } from './components/screens/ChatPage'
import { MessageDetailScreen } from './components/screens/MessageDetailScreen'
import { SettingsScreen } from './components/screens/settings/SettingsScreen'
import { Layout } from './Layout'

/**
 * AppRoutes - Central routing configuration for the application
 *
 * This file defines all application routes following React Router v6 best practices.
 * Routes are separated from App.tsx for better organization and maintainability.
 *
 * Layout Pattern:
 * - All routes are wrapped in a Layout component that provides the global header and frame
 * - Layout uses React Router's Outlet to render child route content
 *
 * Current routes:
 * - / : Main view (message list or current message)
 * - /messages/:messageId : Message detail view (Security Evaluation Request)
 * - /chat : Chat interface
 * - /chat/:messageId : Chat interface with approval message context
 * - /settings : Settings with default tab
 * - /settings/:tab : Settings with specific tab (WebSocket, Security, Notifications, Connectors, Advanced)
 *
 * For migration guide and future routes, see ROUTER_MIGRATION.md
 */
export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<AppContent />} />
        <Route path="/messages/:messageId" element={<MessageDetailScreen />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:messageId" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/:tab" element={<SettingsScreen />} />
      </Route>
    </Routes>
  )
}
