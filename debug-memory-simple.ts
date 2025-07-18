// Debug script to examine Mastra memory structure
import { mastra } from './mastra/index';

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
    // Query messages
    const { messages } = await memory.query({
      threadId,
      selectBy: {
        last: 10,
      },
    });
    
    console.log(`\n=== Found ${messages.length} messages ===`);
    
    messages.forEach((message: any, index: number) => {
      console.log(`\n--- Message ${index} ---`);
      console.log('Role:', message.role);
      console.log('Content type:', typeof message.content);
      console.log('Message keys:', Object.keys(message));
      
      // Log the full message structure (be careful with size)
      console.log('Full message:', JSON.stringify(message, null, 2));
    });
    
  } catch (error) {
    console.error('Error querying memory:', error);
  }
}

// Run the debug
debugMemory().catch(console.error);