// Types for the general-purpose task network

export interface TaskNetworkState {
  chatId: string;
  status: 'analyzing' | 'environment-setup' | 'generating-scripts' | 'executing' | 'complete' | 'error';
  error?: string;
  taskDescription?: string;
  
  // Task analysis results
  analysis?: {
    taskType: 'computation' | 'data-processing' | 'api-integration' | 'file-operation' | 'analysis' | 'other';
    complexity: 'simple' | 'moderate' | 'complex';
    dependencies: Array<{
      type: 'library' | 'api' | 'file' | 'system-tool' | 'data';
      name: string;
      version?: string;
      required: boolean;
    }>;
    executionPlan: Array<{
      step: number;
      description: string;
      script?: string;
      dependencies: string[];
    }>;
    estimatedDuration: string;
    riskFactors: string[];
  };
  
  // Environment setup
  environment?: {
    packageJson: {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    setupScript: string;
    environmentVariables?: Record<string, string>;
    systemRequirements?: string[];
  };
  
  // Generated scripts
  scripts?: {
    scripts: Array<{
      name: string;
      description: string;
      code: string;
      dependencies: string[];
      order: number;
      retryable: boolean;
    }>;
    mainScript: string;
  };
  
  // Execution results
  executionResults?: {
    results: Array<{
      scriptName: string;
      success: boolean;
      output?: string;
      error?: string;
      duration: number;
      retryCount: number;
    }>;
    finalOutput: any;
    summary: string;
    nextSteps?: string[];
  };
}

export interface TaskNetworkInput {
  taskDescription: string;
  chatId: string;
  constraints?: {
    maxExecutionTime?: number;
    allowedDependencies?: string[];
    blockedDependencies?: string[];
    memoryLimit?: string;
  };
}