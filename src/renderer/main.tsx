// Initialize web mode BEFORE React - this sets up window.electronAPI for web
// This import must come first to ensure the API bridge is available
import './web/init'

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
