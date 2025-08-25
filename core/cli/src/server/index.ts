import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ServerOptions {
  port: number
  host: string
}

export async function startDevServer(options: ServerOptions) {
  const app = new Hono()

  // Serve static files from client build
  // __dirname is dist when built, so client is at dist/client
  const clientPath = path.join(__dirname, 'client')
  
  // Serve assets (JS, CSS, etc.)
  app.use('/assets/*', serveStatic({ 
    root: clientPath
  }))

  // Serve index.html for the root path and any non-API routes (SPA routing)
  app.get('/', serveStatic({ 
    path: path.join(clientPath, 'index.html')
  }))

  // API Routes
  app.get('/api/status', (c) => {
    return c.json({ 
      status: 'running',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    })
  })

  // Agent routes (placeholder for now)
  app.get('/api/agents', (c) => {
    return c.json({
      agents: [],
      total: 0
    })
  })

  app.get('/api/executions', (c) => {
    return c.json({
      executions: [],
      total: 0
    })
  })

  app.get('/api/resources', (c) => {
    return c.json({
      sandbox: { available: 0, total: 0 },
      browser: { available: 0, total: 0 }
    })
  })

  // Start server
  return serve({
    fetch: app.fetch,
    port: options.port,
    hostname: options.host
  })
}