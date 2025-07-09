import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import type { TaskNetworkState } from '../types/task-network-types';

// Schema for the task analyzer agent's output
const taskAnalyzerSchema = z.object({
  taskType: z.enum([
    'computation',
    'data-processing',
    'api-integration',
    'file-operation',
    'analysis',
    'other',
  ]),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  dependencies: z.array(
    z.object({
      type: z.enum(['library', 'api', 'file', 'system-tool', 'data']),
      name: z.string(),
      version: z.string().optional(),
      required: z.boolean(),
    }),
  ),
  executionPlan: z.array(
    z.object({
      step: z.number(),
      description: z.string(),
      script: z.string().optional(),
      dependencies: z.array(z.string()),
    }),
  ),
  estimatedDuration: z.string(),
  riskFactors: z.array(z.string()),
});

export const taskAnalyzerAgent = createAgent<TaskNetworkState>({
  name: 'Task Analyzer',
  description: 'Analyzes computational tasks to understand requirements and create execution plans',
  system: `You are a task analysis expert. Analyze computational tasks and create detailed execution plans.

Focus on:
- Understanding the task requirements
- Identifying necessary dependencies
- Creating step-by-step execution plans
- Assessing complexity and risks
- Generating practical, executable solutions for Node.js environments`,

  tools: [
    createTool({
      name: 'analyze_task',
      description: 'Analyze a computational task and create an execution plan',
      parameters: z.object({
        taskDescription: z.string(),
      }),
      handler: async (params, { network }) => {
        const state = network.state.data;

        try {
          // Store task description in state
          state.taskDescription = params.taskDescription;

          // Create analysis (in production, this would use AI)
          const analysis = {
            taskType: 'computation' as const,
            complexity: 'moderate' as const,
            dependencies: [],
            executionPlan: [
              {
                step: 1,
                description: 'Initialize environment',
                script: 'console.log("Environment initialized");',
                dependencies: [],
              },
            ],
            estimatedDuration: '5 minutes',
            riskFactors: [],
          };

          // Update state
          state.analysis = analysis;
          state.status = 'environment-setup';

          return {
            success: true,
            data: {
              message: `Task analyzed successfully. Type: ${analysis.taskType}, Complexity: ${analysis.complexity}`,
              analysis,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to analyze task: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
  ],
});
