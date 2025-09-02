import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'
import type { Agent } from 'lightfast/agent'
import type { Lightfast } from 'lightfast/client'
import { TEST_AGENTS } from './test-agents'

/**
 * Service for loading compiled agents from the .lightfast directory
 * This complements the AgentDiscoveryService by loading actual Agent instances
 * rather than just configuration metadata
 */
export class AgentLoaderService {
  private static instance: AgentLoaderService | undefined
  private agentCache: Record<string, Agent<any, any>> | null = null
  private lastLoadTime = 0
  private readonly CACHE_TTL = 1000 // 1 second cache for hot reload
  
  private constructor() {}
  
  static getInstance(): AgentLoaderService {
    AgentLoaderService.instance ??= new AgentLoaderService()
    return AgentLoaderService.instance
  }
  
  /**
   * Load compiled agents from the project
   * Returns actual Agent instances that can be used with fetchRequestHandler
   */
  async loadAgents(): Promise<Record<string, Agent<any, any>>> {
    // Use test agents if flag is set (for dev-server UI development)
    if (process.env.USE_TEST_AGENTS === 'true') {
      console.info('🧪 Using test agents for streaming')
      return TEST_AGENTS as Record<string, Agent<any, any>>
    }
    
    const now = Date.now()
    
    // Return cached agents if still fresh
    if (this.agentCache && (now - this.lastLoadTime) < this.CACHE_TTL) {
      return this.agentCache
    }
    
    try {
      const agents = await this.loadCompiledAgents()
      
      if (agents && Object.keys(agents).length > 0) {
        this.agentCache = agents
        this.lastLoadTime = now
        console.info(`✅ Loaded ${Object.keys(agents).length} agent(s) from compiled config`)
        return agents
      }
      
      console.warn('⚠️ No agents found in compiled config')
      return {}
    } catch (error) {
      console.error('❌ Failed to load agents:', error)
      // Return cached agents if available, even if stale
      return this.agentCache || {}
    }
  }
  
  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<Agent<any, any> | null> {
    const agents = await this.loadAgents()
    return agents[agentId] || null
  }
  
  /**
   * Load agents from the compiled config file
   */
  private async loadCompiledAgents(): Promise<Record<string, Agent<any, any>> | null> {
    const projectRoot = process.env.LIGHTFAST_PROJECT_ROOT || process.cwd()
    const compiledConfigPath = path.join(projectRoot, '.lightfast', 'lightfast.config.mjs')
    
    if (!fs.existsSync(compiledConfigPath)) {
      console.warn(`⚠️ No compiled config found at: ${compiledConfigPath}`)
      console.info('💡 Ensure lightfast.config.ts is properly compiled by the CLI')
      return null
    }
    
    console.info(`📂 Loading agents from: ${compiledConfigPath}`)
    
    try {
      // Create a unique import URL to bypass module cache
      const fileUrl = pathToFileURL(compiledConfigPath).href
      const importUrl = `${fileUrl}?t=${Date.now()}`
      
      // Import the compiled module
      const module = await import(/* @vite-ignore */ importUrl)
      
      // The default export should be a Lightfast instance
      const lightfastInstance = module.default || module.lightfast
      
      if (!lightfastInstance) {
        console.warn('⚠️ No default export found in compiled config')
        return null
      }
      
      // Extract agents based on the type of export
      let agents: Record<string, Agent<any, any>> | null = null
      
      // Check if it's a Lightfast instance with getAgents method
      if (typeof lightfastInstance.getAgents === 'function') {
        agents = lightfastInstance.getAgents()
        console.info('📦 Extracted agents using getAgents() method')
      } 
      // Check for direct agents property
      else if (lightfastInstance.agents && typeof lightfastInstance.agents === 'object') {
        agents = lightfastInstance.agents
        console.info('📦 Extracted agents from agents property')
      }
      // Check for internal _agents property (some implementations)
      else if (lightfastInstance._agents && typeof lightfastInstance._agents === 'object') {
        agents = lightfastInstance._agents
        console.info('📦 Extracted agents from _agents property')
      }
      // Try to get config and extract agents from there
      else if (typeof lightfastInstance.getConfig === 'function') {
        const config = lightfastInstance.getConfig()
        if (config && config.agents) {
          agents = config.agents
          console.info('📦 Extracted agents from getConfig().agents')
        }
      }
      
      // Validate that we have actual Agent instances
      if (agents) {
        const agentEntries = Object.entries(agents)
        
        if (agentEntries.length === 0) {
          console.warn('⚠️ No agents found in the configuration')
          return {}
        }
        
        // Validate each agent has required properties
        for (const [key, agent] of agentEntries) {
          if (!agent || typeof agent !== 'object') {
            console.warn(`⚠️ Agent '${key}' is not a valid object`)
            continue
          }
          
          // Basic validation - check for expected Agent properties
          if (!('name' in agent) || !('model' in agent)) {
            console.warn(`⚠️ Agent '${key}' missing required properties (name, model)`)
          } else {
            console.info(`✅ Loaded agent: ${key} (${agent.name})`)
          }
        }
        
        return agents
      }
      
      console.warn('⚠️ Could not extract agents from the compiled config')
      console.info('💡 Ensure your lightfast.config.ts exports a valid Lightfast instance')
      return null
      
    } catch (error) {
      console.error('❌ Error loading compiled config:', error)
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('Cannot find module')) {
          console.info('💡 The compiled config may have missing dependencies')
          console.info('💡 Try rebuilding with: cli compile')
        } else if (error.message.includes('Unexpected token')) {
          console.info('💡 The compiled config may be corrupted')
          console.info('💡 Try cleaning and rebuilding: cli clean && cli compile')
        }
      }
      
      return null
    }
  }
  
  /**
   * Clear the agent cache
   * Useful for forcing a reload on the next request
   */
  clearCache(): void {
    this.agentCache = null
    this.lastLoadTime = 0
    console.info('🔄 Agent cache cleared')
  }
  
  /**
   * Check if agents are loaded and cached
   */
  hasAgents(): boolean {
    return this.agentCache !== null && Object.keys(this.agentCache).length > 0
  }
  
  /**
   * Get list of available agent IDs
   */
  async getAgentIds(): Promise<string[]> {
    const agents = await this.loadAgents()
    return Object.keys(agents)
  }
}