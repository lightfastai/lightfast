import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

interface ServerOptions {
  port: number
  host: string
}

export async function startDevServer(options: ServerOptions) {
  const app = new Hono()

  // Serve static files
  app.use('/static/*', serveStatic({ root: './dist' }))

  app.get('/', (c) => {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lightfast Dev Server</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 2rem;
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 { color: #333; }
            .status { 
              background: #f0f0f0; 
              padding: 1rem; 
              border-radius: 8px;
              margin: 1rem 0;
            }
            .info { color: #666; }
          </style>
        </head>
        <body>
          <h1>⚡ Lightfast Dev Server</h1>
          <div class="status">
            <p>Server is running successfully!</p>
            <p class="info">Port: ${options.port}</p>
            <p class="info">Host: ${options.host}</p>
          </div>
          <div id="app"></div>
        </body>
      </html>
    `)
  })

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