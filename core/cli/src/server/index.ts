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

  // API Routes (must come before static file serving)
  app.get('/api/status', (c) => {
    return c.json({ 
      status: 'running',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    })
  })

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

  // Serve static files from client build
  // __dirname is dist when built, so client is at dist/client
  const clientPath = path.join(__dirname, 'client')
  
  // Serve static assets (JS, CSS, etc.)
  app.use('/assets/*', serveStatic({ 
    root: clientPath
  }))
  
  // Serve index.html for root and all non-API routes (SPA fallback)
  app.get('*', serveStatic({ 
    path: path.join(clientPath, 'index.html')
  }))

  // Start server
  return serve({
    fetch: app.fetch,
    port: options.port,
    hostname: options.host
  })
}