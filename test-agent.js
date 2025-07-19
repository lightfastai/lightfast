const { mastra } = require('./mastra');

async function testAgent() {
  console.log('Testing V1Agent...');
  
  const agent = mastra.getAgent('V1Agent');
  if (!agent) {
    console.error('Agent not found');
    return;
  }
  
  console.log('Agent found:', agent.name);
  console.log('Agent tools:', Object.keys(agent.tools || {}));
  console.log('Agent memory:', agent.getMemory() ? 'configured' : 'not configured');
  
  // Check if memory has schema
  const memory = agent.getMemory();
  if (memory) {
    console.log('Memory options:', memory.options);
  }
}

testAgent().catch(console.error);