import { NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const threadId = url.searchParams.get('threadId') || 'TEST_THREAD_123';
  
  try {
    console.log('=== Debug Mastra Memory Structure ===');
    
    // Get the V1Agent
    const agent = mastra.getAgent('V1Agent');
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    
    // Get the agent's memory
    const memory = agent.getMemory();
    if (!memory) {
      return NextResponse.json({ error: 'Agent memory not configured' }, { status: 404 });
    }
    
    console.log(`\n=== Querying thread: ${threadId} ===`);
    
    // Query messages
    const { messages } = await memory.query({
      threadId,
      selectBy: {
        last: 10,
      },
    });
    
    console.log(`\n=== Found ${messages.length} messages ===`);
    
    const debugData = {
      threadId,
      messageCount: messages.length,
      messages: messages.map((message: any, index: number) => {
        const debugMessage = {
          index,
          role: message.role,
          contentType: typeof message.content,
          messageKeys: Object.keys(message),
          hasToolCalls: !!message.toolCalls,
          toolCallsCount: message.toolCalls ? message.toolCalls.length : 0,
          content: message.content,
          toolCalls: message.toolCalls || [],
        };
        
        // Log each message for console inspection
        console.log(`\n--- Message ${index} ---`);
        console.log('Role:', message.role);
        console.log('Content type:', typeof message.content);
        console.log('Message keys:', Object.keys(message));
        console.log('Has toolCalls:', !!message.toolCalls);
        
        if (message.toolCalls) {
          console.log('Tool calls:', message.toolCalls.length);
          message.toolCalls.forEach((toolCall: any, i: number) => {
            console.log(`  Tool ${i}:`, {
              toolName: toolCall.toolName,
              hasArgs: !!toolCall.args,
              argKeys: toolCall.args ? Object.keys(toolCall.args) : 'null'
            });
            
            // Check specifically for updateWorkingMemory
            if (toolCall.toolName === 'updateWorkingMemory' && toolCall.args) {
              console.log('  *** FOUND updateWorkingMemory ***');
              console.log('  Args:', toolCall.args);
            }
          });
        }
        
        return debugMessage;
      })
    };
    
    return NextResponse.json(debugData);
    
  } catch (error) {
    console.error('Error querying memory:', error);
    return NextResponse.json({ 
      error: 'Failed to query memory', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}