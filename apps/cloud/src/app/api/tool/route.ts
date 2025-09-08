import { NextRequest, NextResponse } from 'next/server';
import { NodeVM } from 'vm2';
import { z } from 'zod';

// Force Node.js runtime for VM2 compatibility
export const runtime = 'nodejs';

const ToolExecutionSchema = z.object({
  toolName: z.string().min(1).max(100),
  toolCode: z.string().min(1).max(50000), // 50KB limit for tool code
  parameters: z.any(),
  organizationId: z.string().min(1),
  sessionId: z.string().optional(),
  timeout: z.number().min(1000).max(30000).default(10000), // 1-30 seconds
});

type ToolExecutionRequest = z.infer<typeof ToolExecutionSchema>;

/**
 * POST /api/tool
 * Execute a single tool function in a secure VM2 sandbox
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request
    const body = await request.json();
    const validatedRequest = ToolExecutionSchema.parse(body);
    
    const { toolName, toolCode, parameters, organizationId, sessionId, timeout } = validatedRequest;

    console.log(`[TOOL-EXECUTE] Starting execution for tool: ${toolName} (org: ${organizationId})`);

    // Create secure VM2 sandbox
    const vm = new NodeVM({
      console: 'redirect', // Capture console output
      timeout: timeout,
      eval: false, // Disable eval()
      wasm: false, // Disable WebAssembly
      fixAsync: true,
      require: {
        // Allow specific Node.js modules
        external: [
          'crypto', 
          'util', 
          'path',
          'url',
          'querystring',
          'buffer',
          'zlib'
        ],
        // Block filesystem and network modules
        builtin: ['*'],
        root: './node_modules/',
        mock: {
          fs: {}, // Mock filesystem access
          net: {}, // Mock network access
          http: {}, // Mock HTTP access
          https: {}, // Mock HTTPS access
          child_process: {} // Mock child process
        }
      },
      sandbox: {
        // Provide safe globals
        Buffer: Buffer,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        // Add safe JSON methods
        JSON: JSON,
        Math: Math,
        Date: Date,
        console: console
      }
    });

    let consoleOutput: string[] = [];
    
    // Capture console output
    vm.on('console.log', (...args) => {
      consoleOutput.push(`[LOG] ${args.map(arg => String(arg)).join(' ')}`);
    });
    vm.on('console.error', (...args) => {
      consoleOutput.push(`[ERROR] ${args.map(arg => String(arg)).join(' ')}`);
    });
    vm.on('console.warn', (...args) => {
      consoleOutput.push(`[WARN] ${args.map(arg => String(arg)).join(' ')}`);
    });

    try {
      // Execute the tool function
      const executionCode = `
        // Define the tool function
        ${toolCode}
        
        // Execute with parameters and return result
        (function() {
          if (typeof ${toolName} !== 'function') {
            throw new Error('Tool function "${toolName}" is not defined or not a function');
          }
          
          const params = ${JSON.stringify(parameters)};
          const result = ${toolName}(params);
          
          // Handle both sync and async results
          if (result && typeof result.then === 'function') {
            return result;
          } else {
            return result;
          }
        })();
      `;

      console.log(`[TOOL-EXECUTE] Executing tool ${toolName} with timeout ${timeout}ms`);
      
      const result = await vm.run(executionCode);
      
      const executionTime = Date.now() - startTime;
      
      console.log(`[TOOL-EXECUTE] Tool ${toolName} completed in ${executionTime}ms`);
      
      return NextResponse.json({
        success: true,
        result: result,
        executionTime,
        consoleOutput: consoleOutput.length > 0 ? consoleOutput : undefined
      });

    } catch (vmError: any) {
      const executionTime = Date.now() - startTime;
      
      console.error(`[TOOL-EXECUTE] Tool ${toolName} failed:`, vmError.message);
      
      // Categorize different types of VM errors
      let errorType = 'EXECUTION_ERROR';
      if (vmError.message?.includes('timeout')) {
        errorType = 'TIMEOUT_ERROR';
      } else if (vmError.message?.includes('memory')) {
        errorType = 'MEMORY_ERROR';
      } else if (vmError.message?.includes('not defined')) {
        errorType = 'FUNCTION_NOT_FOUND';
      }

      return NextResponse.json({
        success: false,
        error: vmError.message,
        errorType,
        executionTime,
        consoleOutput: consoleOutput.length > 0 ? consoleOutput : undefined
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[TOOL-EXECUTE] Request failed:', error);

    // Return error in consistent format
    if (error.issues) {
      return NextResponse.json({
        success: false,
        error: `Validation error: ${error.issues.map((i: any) => i.message).join(', ')}`,
        errorType: 'VALIDATION_ERROR'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      errorType: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

/**
 * GET /api/tool
 * Health check endpoint for tool execution service
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'lightfast-tool-executor',
    status: 'healthy',
    runtime: 'nodejs',
    features: {
      vm2Sandbox: true,
      timeoutSupport: true,
      consoleCapture: true,
      moduleRestrictions: true
    },
    limits: {
      maxTimeout: 30000,
      maxCodeSize: 50000,
      allowedModules: ['crypto', 'util', 'path', 'url', 'querystring', 'buffer', 'zlib']
    },
    timestamp: new Date().toISOString()
  });
}