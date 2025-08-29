import { createRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import { createRouter } from './router'

const router = createRouter()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}
const root = createRoot(rootElement)
root.render(<StartClient router={router} />)