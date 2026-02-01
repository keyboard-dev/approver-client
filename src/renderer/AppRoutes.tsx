import { Route, Routes } from 'react-router-dom'
import { AppContent } from './App'
import { ChatPage } from './components/screens/ChatPage'
import { HomeScreen } from './components/screens/HomeScreen'
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
 * - /home : New home screen with integrated navigation (Home, Agentic chat, Flow shortcuts, Task approvals, Settings)
 * - /home/:tab : Home screen with specific tab
 * - /home/:tab/:messageId : Home screen with specific tab and message context
 * - /messages/:messageId : Message detail view (Security Evaluation Request)
 * - /chat : Chat interface (legacy, redirects to home/agentic-chat)
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
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/home/:tab" element={<HomeScreen />} />
        <Route path="/home/:tab/:messageId" element={<HomeScreen />} />
        <Route path="/messages/:messageId" element={<MessageDetailScreen />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:messageId" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/:tab" element={<SettingsScreen />} />
      </Route>
    </Routes>
  )
}
