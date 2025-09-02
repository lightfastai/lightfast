import { createServerFileRoute } from '@tanstack/react-start/server'
import { json } from '@tanstack/react-start'
import { fetchRequestHandler } from 'lightfast/server/adapters/fetch'
import { InMemoryMemory } from 'lightfast/memory'
import { AgentLoaderService } from '../../server/agent-loader'

// Singleton memory instance for development
// This ensures conversation history persists during the dev session
let devMemory: InMemoryMemory | null = null

function getDevMemory(): InMemoryMemory {
  if (!devMemory) {
    devMemory = new InMemoryMemory()
    console.info('🧠 Created in-memory storage for development')
  }
  return devMemory
}

/**
 * Streaming endpoint for agent interactions
 * 
 * POST /api/stream
 * Body: {
 *   agentId: string
 *   sessionId: string
 *   messages: UIMessage[]
 * }
 * 
 * GET /api/stream?agentId=xxx&sessionId=xxx
 * Returns session history
 */
export const ServerRoute = createServerFileRoute('/api/stream')
  .methods({
    GET: async ({ request }) => {
      const url = new URL(request.url)
      const agentId = url.searchParams.get('agentId')
      const sessionId = url.searchParams.get('sessionId')
      
      if (!agentId || !sessionId) {
        return json(
          {
            success: false,
            error: 'Missing parameters',
            message: 'Both agentId and sessionId are required',
          },
          { status: 400 }
        )
      }
      
      console.info(`📥 GET /api/stream?agentId=${agentId}&sessionId=${sessionId}`)
      
      try {
        // Get memory instance
        const memory = getDevMemory()
        
        // Check if session exists and get messages
        const session = await memory.getSession(sessionId)
        const messages = await memory.getMessages(sessionId)
        
        return json({
          success: true,
          data: {
            agentId,
            sessionId,
            session: session || { resourceId: 'dev-user' },
            messageCount: messages.length,
            messages: messages,
          }
        })
      } catch (error) {
        console.error('❌ Error in GET handler:', error)
        return json(
          {
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }
    },
    
    POST: async ({ request }) => {
      try {
        // Parse request body to get agentId and sessionId
        const body = await request.json()
        
        // Support both direct format and AI SDK format (which nests in body.body)
        const agentId = body.agentId || body.body?.agentId
        const sessionId = body.sessionId || body.body?.sessionId
        let messages = body.messages || []
        
        if (!agentId || !sessionId) {
          return json(
            {
              success: false,
              error: 'Missing parameters',
              message: 'Both agentId and sessionId are required in request body',
            },
            { status: 400 }
          )
        }
        
        console.info(`📤 POST /api/stream [${agentId}/${sessionId}]`)
        
        // Load agent using the loader service
        const agentLoader = AgentLoaderService.getInstance()
        const agent = await agentLoader.getAgent(agentId)
        
        if (!agent) {
          const availableAgentIds = await agentLoader.getAgentIds()
          
          if (availableAgentIds.length === 0) {
            return json(
              {
                success: false,
                error: 'No agents configured',
                message: 'Please ensure lightfast.config.ts is properly configured with at least one agent.',
              },
              { status: 500 }
            )
          }
          
          console.warn(`⚠️ Agent "${agentId}" not found. Available agents:`, availableAgentIds)
          return json(
            {
              success: false,
              error: 'Agent not found',
              message: `No agent with ID "${agentId}" found. Available agents: ${availableAgentIds.join(', ')}`,
            },
            { status: 404 }
          )
        }
        
        console.info(`🤖 Using agent: ${agentId}`)
        
        // Get memory instance
        const memory = getDevMemory()
        
        // Convert AI SDK messages format to Lightfast format if needed
        // AI SDK uses { role, content, id } while Lightfast uses { role, parts, id }
        const lightfastMessages = messages.map((msg: any) => {
          if (msg.content && !msg.parts) {
            // Convert from AI SDK format
            return {
              role: msg.role,
              parts: [{ type: 'text', text: msg.content }],
              id: msg.id || crypto.randomUUID(),
            }
          }
          // Already in Lightfast format
          return msg
        })
        
        // Create a new request with the messages in the expected format
        const streamRequest = new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({ messages: lightfastMessages }),
        })
        
        // Use fetchRequestHandler to handle the streaming
        // This will internally use streamChat and handle all the protocol details
        const response = await fetchRequestHandler({
          agent,
          sessionId,
          memory,
          req: streamRequest,
          resourceId: 'dev-user', // Fixed user ID for development
          enableResume: true,
          generateId: () => crypto.randomUUID(),
          createRequestContext: (req) => ({
            // Add any request context needed for development
            userAgent: req.headers.get('user-agent') || 'dev-server',
            origin: req.headers.get('origin') || 'http://localhost:3000',
          }),
          onError({ error }) {
            console.error(`❌ Agent Error [${agentId}/${sessionId}]:`, error)
          },
          onStreamStart() {
            console.info(`🚀 Stream started [${agentId}/${sessionId}]`)
          },
          onStreamComplete() {
            console.info(`✅ Stream completed [${agentId}/${sessionId}]`)
          },
        })
        
        return response
      } catch (error) {
        console.error('❌ Error in POST handler:', error)
        
        // Check if it's already a Response (from fetchRequestHandler)
        if (error instanceof Response) {
          return error
        }
        
        return json(
          {
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
          },
          { status: 500 }
        )
      }
    },
    
    DELETE: async ({ request }) => {
      const url = new URL(request.url)
      const agentId = url.searchParams.get('agentId')
      const sessionId = url.searchParams.get('sessionId')
      
      if (!sessionId) {
        return json(
          {
            success: false,
            error: 'Missing sessionId',
            message: 'sessionId is required to clear a session',
          },
          { status: 400 }
        )
      }
      
      console.info(`🗑️ DELETE /api/stream?sessionId=${sessionId}`)
      
      try {
        // Clear session from memory (useful for testing)
        const memory = getDevMemory()
        
        // Create a new session to effectively clear the old one
        await memory.createSession({
          sessionId,
          resourceId: 'dev-user',
          context: { cleared: true }
        })
        
        return json({
          success: true,
          message: `Session ${sessionId} cleared`,
        })
      } catch (error) {
        console.error('❌ Error in DELETE handler:', error)
        return json(
          {
            success: false,
            error: 'Failed to clear session',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }
    },
  })