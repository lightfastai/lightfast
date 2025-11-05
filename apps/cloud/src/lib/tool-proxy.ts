import { z } from 'zod';
import { createTool } from 'lightfast/tool';
import { ToolDefinition } from './bundle-parser';
import type { ToolFactorySet, ToolFactory } from 'lightfast/tool';
import type { RuntimeContext } from 'lightfast/server/adapters/types';

/**
 * Create Lightfast ToolFactory functions that proxy execution to secure /api/tool endpoint
 */
export function createProxiedTools(
  toolDefinitions: Record<string, ToolDefinition>,
  organizationId: string,
  sessionId: string,
  baseUrl?: string
): ToolFactorySet<RuntimeContext> {
  const toolFactories: ToolFactorySet<RuntimeContext> = {};
  
  for (const [toolName, toolDef] of Object.entries(toolDefinitions)) {
    // Convert JSON Schema to Zod schema for input parameters
    const inputSchema = toolDef.parameters?.type === 'object' 
      ? z.object(
          Object.entries(toolDef.parameters?.properties || {}).reduce((acc, [key, prop]: [string, any]) => {
            // Convert JSON schema properties to Zod schema
            if (prop.type === 'string') {
              acc[key] = z.string();
            } else if (prop.type === 'number') {
              acc[key] = z.number();
            } else if (prop.type === 'boolean') {
              acc[key] = z.boolean();
            } else {
              acc[key] = z.any();
            }
            return acc;
          }, {} as Record<string, z.ZodType>)
        )
      : z.object({}); // Default empty schema
    
    // Create a proper Lightfast ToolFactory using createTool
    toolFactories[toolName] = createTool<RuntimeContext, typeof inputSchema>({
      description: toolDef.description || `Tool: ${toolName}`,
      inputSchema,
      execute: async (parameters: z.infer<typeof inputSchema>, context: RuntimeContext) => {
          console.log(`[TOOL-PROXY] Executing tool ${toolName} with params:`, parameters);
          console.log(`[TOOL-PROXY] Runtime context:`, { 
            sessionId: context.sessionId, 
            resourceId: context.resourceId 
          });
          
          try {
            // Determine the base URL for the API call
            const apiUrl = baseUrl 
              ? `${baseUrl}/api/tool`
              : `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:4104'}/api/tool`;

            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                toolName,
                toolCode: toolDef.implementation,
                parameters,
                organizationId: context.resourceId, // Use resourceId from runtime context
                sessionId: context.sessionId, // Use sessionId from runtime context
                timeout: 15000 // 15 second timeout for tool execution
              })
            });

            const result = await response.json();

            if (!result.success) {
              console.error(`[TOOL-PROXY] Tool ${toolName} failed:`, result.error);
              throw new Error(`Tool execution failed: ${result.error}`);
            }

            console.log(`[TOOL-PROXY] Tool ${toolName} completed in ${result.executionTime}ms`);
            
            // Log console output if available
            if (result.consoleOutput && result.consoleOutput.length > 0) {
              console.log(`[TOOL-PROXY] Tool ${toolName} console output:`, result.consoleOutput);
            }

            return result.result;

          } catch (error: any) {
            console.error(`[TOOL-PROXY] Failed to execute tool ${toolName}:`, error.message);
            
            // Provide helpful error messages
            if (error.message?.includes('fetch')) {
              throw new Error(`Tool execution service unavailable: ${error.message}`);
            } else if (error.message?.includes('timeout')) {
              throw new Error(`Tool execution timed out: ${toolName}`);
            } else {
              throw new Error(`Tool execution failed: ${error.message}`);
            }
          }
        }
      });
  }

  return toolFactories;
}

/**
 * Extract tool code from a bundle for a specific tool
 * This is a simplified version - in reality we'd use AST analysis
 */
export function extractToolCode(bundleCode: string, toolName: string): string {
  // Simple regex-based extraction for now
  // In production, we'd use proper AST analysis
  
  // Look for function declarations
  const functionPattern = new RegExp(
    `function\\s+${toolName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`,
    'g'
  );
  
  // Look for const/let/var declarations with arrow functions
  const arrowPattern = new RegExp(
    `(?:const|let|var)\\s+${toolName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{[\\s\\S]*?\\}`,
    'g'
  );
  
  // Look for const/let/var declarations with function expressions
  const functionExprPattern = new RegExp(
    `(?:const|let|var)\\s+${toolName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`,
    'g'
  );

  let match = bundleCode.match(functionPattern);
  if (match) {
    return match[0];
  }

  match = bundleCode.match(arrowPattern);
  if (match) {
    return match[0];
  }

  match = bundleCode.match(functionExprPattern);
  if (match) {
    return match[0];
  }

  throw new Error(`Tool function '${toolName}' not found in bundle`);
}

/**
 * Validate tool parameters against a schema (basic validation)
 */
export function validateToolParameters(parameters: any, schema: any): boolean {
  // Basic validation - in production we'd use a proper JSON schema validator
  if (!schema || !schema.properties) {
    return true; // No schema to validate against
  }

  if (schema.required && Array.isArray(schema.required)) {
    for (const requiredField of schema.required) {
      if (!(requiredField in parameters)) {
        throw new Error(`Missing required parameter: ${requiredField}`);
      }
    }
  }

  return true;
}