import { describe, it, expect } from 'vitest';
import {
  extractAgentDefinitionsFromCode,
  extractAgentIds,
  hasValidAgentDefinitions,
  type AgentDefinition,
  type AgentASTMetadata,
} from './esbuild-ast-utils.js';

describe('ESBuild AST Utils', () => {
  describe('extractAgentIds', () => {
    it('should extract agent IDs from agents object', () => {
      const code = `
        export default {
          name: 'test-config',
          agents: {
            assistant: assistantAgent,
            researcher: researcherAgent,
            'data-analyst': dataAnalystAgent
          }
        };
      `;
      
      const agentIds = extractAgentIds(code);
      expect(agentIds).toEqual(['assistant', 'researcher', 'data-analyst']);
    });

    it('should handle empty agents object', () => {
      const code = `
        export default {
          agents: {}
        };
      `;
      
      const agentIds = extractAgentIds(code);
      expect(agentIds).toEqual([]);
    });

    it('should return empty array when no agents object found', () => {
      const code = `
        export default {
          name: 'test-config',
          tools: ['search']
        };
      `;
      
      const agentIds = extractAgentIds(code);
      expect(agentIds).toEqual([]);
    });
  });

  describe('extractAgentDefinitionsFromCode', () => {
    it('should extract agent definitions with metadata', () => {
      const code = `
        import { createAgent, gateway } from 'lightfast';
        
        const assistantAgent = createAgent({
          name: 'Assistant Agent',
          description: 'A helpful AI assistant',
          model: gateway('gpt-4'),
          tools: {
            search: searchTool,
            calculate: calcTool
          }
        });
        
        export default {
          name: 'test-config',
          agents: {
            assistant: assistantAgent
          }
        };
      `;
      
      const definitions = extractAgentDefinitionsFromCode(code);
      
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatchObject({
        id: 'assistant',
        variableName: 'assistantAgent',
        metadata: expect.objectContaining({
          name: 'assistant',
          description: 'A helpful AI assistant',
          models: ['gpt-4'],
          tools: ['search', 'calculate'],
          variableName: 'assistantAgent'
        })
      });
    });

    it('should handle inline agent definitions', () => {
      const code = `
        export default {
          agents: {
            assistant: createAgent({
              name: 'Inline Agent',
              model: 'claude-3',
              system: 'You are a helpful assistant'
            })
          }
        };
      `;
      
      const definitions = extractAgentDefinitionsFromCode(code);
      
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatchObject({
        id: 'assistant',
        variableName: 'assistantAgent',
        metadata: expect.objectContaining({
          name: 'assistant',
          description: 'You are a helpful assistant',
          models: ['claude-3']
        })
      });
    });

    it('should handle multiple agents', () => {
      const code = `
        const agent1 = createAgent({
          name: 'Agent 1',
          model: 'gpt-4'
        });
        
        const agent2 = createAgent2({
          name: 'Agent 2', 
          model: 'claude-3'
        });
        
        export default {
          agents: {
            first: agent1,
            second: agent2
          }
        };
      `;
      
      const definitions = extractAgentDefinitionsFromCode(code);
      
      expect(definitions).toHaveLength(2);
      expect(definitions.map(d => d.id)).toEqual(['first', 'second']);
      expect(definitions.map(d => d.variableName)).toEqual(['agent1', 'agent2']);
    });

    it('should return empty array when no valid agent definitions found', () => {
      const code = `
        export default {
          agents: {
            'malformed': {},
            'invalid': null
          }
        };
      `;
      
      const definitions = extractAgentDefinitionsFromCode(code);
      expect(definitions).toHaveLength(0);
    });
  });

  describe('hasValidAgentDefinitions', () => {
    it('should return true for valid agent definitions', () => {
      const code = `
        const agent = createAgent({
          name: 'Test Agent',
          model: 'gpt-4'
        });
        
        export default {
          agents: {
            test: agent
          }
        };
      `;
      
      expect(hasValidAgentDefinitions(code)).toBe(true);
    });

    it('should return false when no createAgent calls found', () => {
      const code = `
        export default {
          agents: {
            test: {}
          }
        };
      `;
      
      expect(hasValidAgentDefinitions(code)).toBe(false);
    });

    it('should return false when no agents object found', () => {
      const code = `
        const agent = createAgent({
          model: 'gpt-4'
        });
        
        export default {
          name: 'config'
        };
      `;
      
      expect(hasValidAgentDefinitions(code)).toBe(false);
    });

    it('should handle numbered createAgent functions', () => {
      const code = `
        const agent = createAgent5({
          model: 'claude-3'
        });
        
        export default {
          agents: {
            test: agent
          }
        };
      `;
      
      expect(hasValidAgentDefinitions(code)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle complex nested structures', () => {
      const code = `
        const config = {
          metadata: {
            name: 'Complex Config',
            version: '1.0.0'
          },
          agents: {
            'multi-word-agent': createAgent({
              model: gateway2('gpt-4-turbo'),
              tools: {
                'search-tool': searchTool,
                'write-tool': writeTool
              }
            }),
            simpleAgent: createAgent3({
              model: 'claude-3'
            })
          }
        };
        
        export default config;
      `;
      
      const agentIds = extractAgentIds(code);
      expect(agentIds).toEqual(['multi-word-agent', 'simpleAgent']);
      
      const definitions = extractAgentDefinitionsFromCode(code);
      expect(definitions).toHaveLength(2);
      
      const multiWordAgent = definitions.find(d => d.id === 'multi-word-agent');
      expect(multiWordAgent?.metadata.models).toContain('gpt-4-turbo');
      expect(multiWordAgent?.metadata.tools).toEqual(['search-tool', 'write-tool']);
    });

    it('should handle special characters in code', () => {
      const code = `
        export default {
          name: '测试配置 🚀',
          agents: {
            'test-agent': createAgent({
              description: 'Agent with unicode: €£¥',
              model: 'gpt-4'
            })
          }
        };
      `;
      
      const agentIds = extractAgentIds(code);
      expect(agentIds).toEqual(['test-agent']);
      
      const definitions = extractAgentDefinitionsFromCode(code);
      expect(definitions).toHaveLength(1);
      expect(definitions[0]?.metadata.description).toBeDefined();
      if (definitions[0]?.metadata.description) {
        expect(definitions[0].metadata.description).toContain('Agent with unicode: €£¥');
      }
    });
  });
});