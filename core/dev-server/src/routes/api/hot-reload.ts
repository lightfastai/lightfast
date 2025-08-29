import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { createConfigWatcher } from '@lightfastai/compiler'
import { createSSEHandler } from '../../server/hot-reload.js'

// Global watcher instance for the dev server
let watcherInstance: ReturnType<typeof createConfigWatcher> | null = null;
let hotReloadHandler: ReturnType<typeof createSSEHandler> | null = null;

// Initialize watcher if not already running
function getOrCreateWatcher() {
  if (!watcherInstance) {
    watcherInstance = createConfigWatcher({
      baseDir: process.cwd(),
      debounceDelay: 500,
      debug: process.env.NODE_ENV === 'development'
    });
    
    // Start watching
    watcherInstance.start().catch((error) => {
      console.error('[HotReload] Failed to start watcher:', error);
    });
    
    // Create the SSE handler
    hotReloadHandler = createSSEHandler(watcherInstance, {
      debug: process.env.NODE_ENV === 'development'
    });
  }
  
  return { watcher: watcherInstance, handler: hotReloadHandler! };
}

export const ServerRoute = createServerFileRoute('/api/hot-reload')
  .methods({
    GET: async ({ request }) => {
      try {
        const { handler } = getOrCreateWatcher();
        
        // Handle SSE connection
        return handler.handleRequest(request);
        
      } catch (error) {
        console.error('[HotReload] Error in SSE endpoint:', error);
        
        return new Response(
          JSON.stringify({
            error: 'Failed to establish hot reload connection',
            message: error instanceof Error ? error.message : 'Unknown error'
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
    },
    
    POST: async ({ request }) => {
      try {
        const { watcher, handler } = getOrCreateWatcher();
        
        const body = await request.json();
        const { action } = body;
        
        switch (action) {
          case 'force-compile':
            // Force recompilation
            await watcher.forceCompilation();
            return json({ success: true, message: 'Forced compilation started' });
            
          case 'get-info':
            // Get watcher information
            const info = handler.getInfo();
            return json({ success: true, data: info });
            
          default:
            return json(
              { error: 'Unknown action', validActions: ['force-compile', 'get-info'] },
              { status: 400 }
            );
        }
        
      } catch (error) {
        console.error('[HotReload] Error in POST endpoint:', error);
        
        return json(
          {
            error: 'Failed to process hot reload action',
            message: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }
  });