import { createRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import { router } from './router'

const root = createRoot(document.getElementById('root')!)
root.render(<StartClient router={router} />)