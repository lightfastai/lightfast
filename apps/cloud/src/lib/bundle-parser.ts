import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface AgentConfig {
  name: string;
  system: string;
  model: string;
  tools?: Record<string, ToolDefinition>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  implementation: string; // Source code of the tool function
}

export interface LightfastConfig {
  agents: Record<string, AgentConfig>;
  metadata?: {
    name?: string;
    version?: string;
    description?: string;
  };
}

/**
 * Safely parse a Lightfast bundle to extract agent configuration
 * without executing any user code
 */
export function parseAgentBundle(bundleCode: string): LightfastConfig {
  try {
    // Parse the JavaScript code into an AST
    const ast = parse(bundleCode, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: ['typescript', 'jsx']
    });

    let lightfastConfig: LightfastConfig = { agents: {} };
    const toolImplementations = new Map<string, string>();

    // Walk the AST to find patterns
    traverse(ast, {
      // Find function declarations that could be tools
      FunctionDeclaration(path) {
        if (path.node.id?.name) {
          const functionCode = bundleCode.substring(
            path.node.start || 0, 
            path.node.end || bundleCode.length
          );
          toolImplementations.set(path.node.id.name, functionCode);
        }
      },

      // Find variable declarations with arrow functions (tools)
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init))
        ) {
          const functionCode = bundleCode.substring(
            path.node.start || 0,
            path.node.end || bundleCode.length
          );
          toolImplementations.set(path.node.id.name, functionCode);
        }
      },

      // Find createAgent() and createLightfast() calls
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee) && path.node.arguments.length > 0) {
          const calleeName = path.node.callee.name;
          
          if (calleeName === 'createAgent') {
            const configArg = path.node.arguments[0];
            if (t.isObjectExpression(configArg)) {
              const agentConfig = extractAgentConfig(configArg, toolImplementations);
              if (agentConfig) {
                // We'll need to determine the agent name from context
                // For now, use the name property or generate one
                const agentName = agentConfig.name || 'agent';
                lightfastConfig.agents[agentName] = agentConfig;
              }
            }
          } else if (calleeName === 'createLightfast') {
            const configArg = path.node.arguments[0];
            if (t.isObjectExpression(configArg)) {
              const config = extractLightfastConfig(configArg, toolImplementations);
              if (config) {
                lightfastConfig = { ...lightfastConfig, ...config };
              }
            }
          }
        }
      },

      // Find module.exports assignments
      AssignmentExpression(path) {
        if (
          t.isMemberExpression(path.node.left) &&
          t.isIdentifier(path.node.left.object) &&
          path.node.left.object.name === 'module' &&
          t.isIdentifier(path.node.left.property) &&
          path.node.left.property.name === 'exports'
        ) {
          // Handle module.exports = createLightfast(...)
          if (t.isCallExpression(path.node.right)) {
            const callExpr = path.node.right;
            if (
              t.isIdentifier(callExpr.callee) &&
              callExpr.callee.name === 'createLightfast' &&
              callExpr.arguments.length > 0
            ) {
              const configArg = callExpr.arguments[0];
              if (t.isObjectExpression(configArg)) {
                const config = extractLightfastConfig(configArg, toolImplementations);
                if (config) {
                  lightfastConfig = { ...lightfastConfig, ...config };
                }
              }
            }
          }
        }
      }
    });

    return lightfastConfig;
  } catch (error) {
    throw new Error(`Failed to parse bundle: ${error.message}`);
  }
}

function extractAgentConfig(
  objectExpr: t.ObjectExpression,
  toolImplementations: Map<string, string>
): AgentConfig | null {
  const config: Partial<AgentConfig> = {};

  for (const prop of objectExpr.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

    const key = prop.key.name;
    const value = prop.value;

    switch (key) {
      case 'name':
        if (t.isStringLiteral(value)) {
          config.name = value.value;
        }
        break;
      case 'system':
        if (t.isStringLiteral(value)) {
          config.system = value.value;
        }
        break;
      case 'model':
        config.model = extractModelValue(value);
        break;
      case 'tools':
        if (t.isObjectExpression(value)) {
          config.tools = extractTools(value, toolImplementations);
        }
        break;
    }
  }

  // Validate required fields
  if (config.name && config.system && config.model) {
    return config as AgentConfig;
  }

  return null;
}

function extractLightfastConfig(
  objectExpr: t.ObjectExpression,
  toolImplementations: Map<string, string>
): Partial<LightfastConfig> | null {
  const config: Partial<LightfastConfig> = {};

  for (const prop of objectExpr.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

    const key = prop.key.name;
    const value = prop.value;

    switch (key) {
      case 'agents':
        if (t.isObjectExpression(value)) {
          config.agents = extractAgentsObject(value, toolImplementations);
        }
        break;
      case 'metadata':
        if (t.isObjectExpression(value)) {
          config.metadata = extractMetadata(value);
        }
        break;
    }
  }

  return config;
}

function extractAgentsObject(
  objectExpr: t.ObjectExpression,
  toolImplementations: Map<string, string>
): Record<string, AgentConfig> {
  const agents: Record<string, AgentConfig> = {};

  for (const prop of objectExpr.properties) {
    if (!t.isObjectProperty(prop)) continue;

    let agentName: string;
    if (t.isIdentifier(prop.key)) {
      agentName = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      agentName = prop.key.value;
    } else {
      continue;
    }

    // Handle direct agent objects or createAgent() calls
    let agentConfig: AgentConfig | null = null;

    if (t.isCallExpression(prop.value)) {
      // createAgent() call
      if (
        t.isIdentifier(prop.value.callee) &&
        prop.value.callee.name === 'createAgent' &&
        prop.value.arguments.length > 0
      ) {
        const configArg = prop.value.arguments[0];
        if (t.isObjectExpression(configArg)) {
          agentConfig = extractAgentConfig(configArg, toolImplementations);
        }
      }
    } else if (t.isObjectExpression(prop.value)) {
      // Direct agent object literal
      agentConfig = extractAgentConfig(prop.value, toolImplementations);
    } else if (t.isIdentifier(prop.value)) {
      // Reference to a variable (e.g., myAgent)
      // We'd need to look up the variable definition
      // For now, skip these
    }

    if (agentConfig) {
      agents[agentName] = agentConfig;
    }
  }

  return agents;
}

function extractModelValue(value: t.Expression): string {
  if (t.isStringLiteral(value)) {
    return value.value;
  }

  if (t.isCallExpression(value)) {
    // Handle gateway('model-name') calls
    if (
      t.isIdentifier(value.callee) &&
      value.callee.name === 'gateway' &&
      value.arguments.length > 0
    ) {
      const modelArg = value.arguments[0];
      if (t.isStringLiteral(modelArg)) {
        return modelArg.value;
      }
    }
  }

  // Default fallback
  return 'gpt-4o-mini';
}

function extractTools(
  objectExpr: t.ObjectExpression,
  toolImplementations: Map<string, string>
): Record<string, ToolDefinition> {
  const tools: Record<string, ToolDefinition> = {};

  for (const prop of objectExpr.properties) {
    if (!t.isObjectProperty(prop)) continue;

    let toolName: string;
    if (t.isIdentifier(prop.key)) {
      toolName = prop.key.name;
    } else if (t.isStringLiteral(prop.key)) {
      toolName = prop.key.value;
    } else {
      continue;
    }

    // Get the tool implementation
    const implementation = toolImplementations.get(toolName) || '';

    // For now, create a basic tool definition
    // In a real implementation, we'd extract more metadata
    tools[toolName] = {
      name: toolName,
      description: `Tool: ${toolName}`,
      parameters: {}, // Would need more sophisticated extraction
      implementation
    };
  }

  return tools;
}

function extractMetadata(objectExpr: t.ObjectExpression): Record<string, string> {
  const metadata: Record<string, string> = {};

  for (const prop of objectExpr.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

    const key = prop.key.name;
    if (t.isStringLiteral(prop.value)) {
      metadata[key] = prop.value.value;
    }
  }

  return metadata;
}