import { transform } from 'esbuild';

/**
 * Agent metadata extracted from AST
 */
export interface AgentASTMetadata {
  name: string;
  description?: string;
  tools: string[];
  models: string[];
  variableName: string;
}

/**
 * Agent definition found in AST
 */
export interface AgentDefinition {
  id: string;
  variableName: string;
  metadata: AgentASTMetadata;
}

/**
 * Parse code using esbuild and extract agent information
 * This is a lighter alternative to TypeScript Compiler API
 */
export function extractAgentDefinitionsFromCode(code: string): AgentDefinition[] {
  try {
    // Use regex-based parsing as a pragmatic alternative to full AST parsing
    // This avoids the TypeScript bundling issues while still being more reliable than the old regex
    const definitions: AgentDefinition[] = [];
    
    // Find agents object
    const agentsObjectMatch = code.match(/agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!agentsObjectMatch) {
      return [];
    }
    
    const agentsContent = agentsObjectMatch[1];
    
    // Extract agent IDs and their variable references
    // Only match top-level properties, not nested ones
    const agentPropertyRegex = /(?:^|,)\s*(?:([a-zA-Z_$][a-zA-Z0-9_$-]*)|['"]([^'"]+)['"])\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*|createAgent\d*\s*\()/gm;
    let match: RegExpExecArray | null;
    
    while ((match = agentPropertyRegex.exec(agentsContent)) !== null) {
      const agentId = match[1] || match[2]; // Either unquoted or quoted property name
      let variableName = match[3]; // The variable reference or createAgent call
      
      if (agentId && variableName) {
        // Handle inline createAgent calls
        if (variableName.startsWith('createAgent')) {
          variableName = `${agentId}Agent`; // Use fallback name for inline definitions
        }
        
        const metadata = extractAgentMetadataFromCode(code, agentId, variableName);
        definitions.push({
          id: agentId,
          variableName,
          metadata
        });
      }
    }
    
    return definitions;
  } catch (error) {
    console.warn('Failed to extract agent definitions:', error);
    return [];
  }
}

/**
 * Extract agent metadata from code using enhanced regex patterns
 */
function extractAgentMetadataFromCode(code: string, agentId: string, variableName: string): AgentASTMetadata {
  const metadata: AgentASTMetadata = {
    name: agentId,
    tools: [],
    models: [],
    variableName
  };

  // Find the agent definition (either variable declaration or inline)
  const agentDefRegex = new RegExp(
    `(?:const|let|var)\\s+${variableName}\\s*=\\s*createAgent\\d*\\s*\\([\\s\\S]*?\\}\\s*\\)`,
    'g'
  );
  
  let agentDefMatch = code.match(agentDefRegex);
  
  // If not found as variable, look for inline definition
  if (!agentDefMatch) {
    const inlineRegex = new RegExp(
      `${agentId}\\s*:\\s*createAgent\\d*\\s*\\([\\s\\S]*?\\}\\s*\\)`,
      'g'
    );
    agentDefMatch = code.match(inlineRegex);
  }
  
  if (!agentDefMatch) {
    return metadata;
  }
  
  const agentDefinition = agentDefMatch[0];
  
  // Extract description
  const descriptionMatch = agentDefinition.match(/(?:description|system)\s*:\s*["'`]([^"'`]*?)["'`]/);
  if (descriptionMatch) {
    metadata.description = descriptionMatch[1];
  }
  
  // Extract models (including gateway calls)
  const modelMatches = [
    ...agentDefinition.matchAll(/model\s*:\s*["'`]([^"'`]+)["'`]/g),
    ...agentDefinition.matchAll(/gateway\d*\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)
  ];
  
  for (const match of modelMatches) {
    if (match[1] && !metadata.models.includes(match[1])) {
      metadata.models.push(match[1]);
    }
  }
  
  // Extract tools from tools object (ignore commented-out tools)
  const toolsMatch = agentDefinition.match(/(?:^|[^/])tools\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  if (toolsMatch) {
    const toolsContent = toolsMatch[1];
    
    // Check if the tools definition is commented out by looking at the preceding context
    const fullMatch = toolsMatch[0];
    const toolsIndex = agentDefinition.indexOf(fullMatch);
    
    // Find the start of the line containing the tools definition
    let lineStart = toolsIndex;
    while (lineStart > 0 && agentDefinition[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // Extract the line content before the tools definition to check for comments
    const lineBeforeTools = agentDefinition.substring(lineStart, toolsIndex).trim();
    
    // Skip if the line starts with // or is within a comment block
    if (!lineBeforeTools.startsWith('//') && !lineBeforeTools.includes('//')) {
      const toolPropertyRegex = /(?:^|,)\s*(?:([a-zA-Z_$][a-zA-Z0-9_$]*)|['"]([^'"]+)['"])\s*:/gm;
      let toolMatch: RegExpExecArray | null;
      
      while ((toolMatch = toolPropertyRegex.exec(toolsContent)) !== null) {
        const toolName = toolMatch[1] || toolMatch[2];
        if (toolName && !metadata.tools.includes(toolName)) {
          metadata.tools.push(toolName);
        }
      }
    }
  }
  
  return metadata;
}

/**
 * Extract agent IDs from compiled code (enhanced regex version)
 */
export function extractAgentIds(code: string): string[] {
  try {
    const agentsObjectMatch = code.match(/agents\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!agentsObjectMatch) {
      return [];
    }
    
    const agentsContent = agentsObjectMatch[1];
    const agentIds: string[] = [];
    
    // Use a balance-aware approach to find top-level properties
    // Track depth to avoid nested properties
    let depth = 0;
    let currentSegment = '';
    
    for (let i = 0; i < agentsContent.length; i++) {
      const char = agentsContent[i];
      
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      } else if (char === ',' && depth === 0) {
        // Process current segment at top level
        if (currentSegment.trim()) {
          const match = currentSegment.match(/^\s*(?:([a-zA-Z_$][a-zA-Z0-9_$-]*)|['"]([^'"]+)['"])\s*:/);
          if (match) {
            const agentId = match[1] || match[2];
            if (agentId && !agentIds.includes(agentId)) {
              agentIds.push(agentId);
            }
          }
        }
        currentSegment = '';
        continue;
      }
      
      currentSegment += char;
    }
    
    // Process the final segment
    if (currentSegment.trim()) {
      const match = currentSegment.match(/^\s*(?:([a-zA-Z_$][a-zA-Z0-9_$-]*)|['"]([^'"]+)['"])\s*:/);
      if (match) {
        const agentId = match[1] || match[2];
        if (agentId && !agentIds.includes(agentId)) {
          agentIds.push(agentId);
        }
      }
    }
    
    return agentIds;
  } catch (error) {
    console.warn('Failed to extract agent IDs:', error);
    return [];
  }
}

/**
 * Check if code contains agent definitions with createAgent calls
 */
export function hasValidAgentDefinitions(code: string): boolean {
  const agentIds = extractAgentIds(code);
  if (agentIds.length === 0) {
    return false;
  }
  
  // Check if there are any createAgent calls in the code
  const createAgentRegex = /createAgent\d*\s*\(/g;
  const createAgentCalls = code.match(createAgentRegex);
  
  return createAgentCalls !== null && createAgentCalls.length > 0;
}