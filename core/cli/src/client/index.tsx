import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// Find the root element
const rootElement = document.getElementById('app')

if (rootElement) {
  // Create React root and render the app
  const root = createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}