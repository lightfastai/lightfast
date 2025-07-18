// Debug script to examine Mastra memory structure
const { mastra } = require('./mastra/index.ts');

async function debugMemory() {
  console.log('=== Debug Mastra Memory Structure ===');
  
  // Get the V1Agent
  const agent = mastra.getAgent('V1Agent');
  if (!agent) {
    console.log('ERROR: Agent not found');
    return;
  }
  
  // Get the agent's memory
  const memory = agent.getMemory();
  if (!memory) {
    console.log('ERROR: Agent memory not configured');
    return;
  }
  
  // Test with our known thread ID
  const threadId = 'TEST_THREAD_123';
  console.log(`\n=== Querying thread: ${threadId} ===`);
  
  try {
    // Get the thread
    const thread = await memory.getThreadById({ threadId });
    console.log('Thread found:', !!thread);
    
    if (thread) {
      console.log('Thread structure:', {
        id: thread.id,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        // Don't log the full thread to avoid too much output
      });
    }
    
    // Query messages
    const { messages } = await memory.query({
      threadId,
      selectBy: {
        last: 10,
      },
    });
    
    console.log(`\n=== Found ${messages.length} messages ===`);
    
    messages.forEach((message, index) => {
      console.log(`\n--- Message ${index} ---`);
      console.log('Role:', message.role);
      console.log('Content type:', typeof message.content);
      console.log('Has toolCalls:', !!message.toolCalls);
      console.log('Content keys:', message.content ? Object.keys(message.content) : 'null');
      
      if (message.content) {
        console.log('Content preview:', JSON.stringify(message.content).substring(0, 200) + '...');
      }
      
      if (message.toolCalls) {
        console.log('Tool calls:', message.toolCalls.length);
        message.toolCalls.forEach((toolCall, i) => {
          console.log(`  Tool ${i}:`, {
            toolName: toolCall.toolName,
            hasArgs: !!toolCall.args,
            argKeys: toolCall.args ? Object.keys(toolCall.args) : 'null'
          });
        });
      }
      
      // Check if content has parts (AI SDK v5 format)
      if (message.content && message.content.parts) {
        console.log('Content parts:', message.content.parts.length);
        message.content.parts.forEach((part, i) => {
          console.log(`  Part ${i}:`, {
            type: part.type,
            hasText: !!part.text,
            textPreview: part.text ? part.text.substring(0, 100) + '...' : 'null'
          });
        });
      }
    });
    
  } catch (error) {
    console.error('Error querying memory:', error);
  }
}

// Run the debug
debugMemory().catch(console.error);