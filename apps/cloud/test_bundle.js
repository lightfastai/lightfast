// Mock implementations for isolated-vm environment
const createAgent = function(config) {
  return {
    __isAgent: true,
    name: config.name,
    system: config.system,
    model: config.model || 'gpt-4o-mini',
    tools: config.tools || {},
    __originalConfig: config
  };
};

const gateway = function(modelId) {
  return { __isModel: true, modelId: modelId };
};

const createLightfast = function(config) {
  return config;
};

// Create test agent
const testAgent = createAgent({
  name: "test-agent", 
  system: "You are a helpful test assistant",
  model: gateway("gpt-4o-mini")
});

// Export Lightfast config
module.exports = createLightfast({
  agents: {
    test: testAgent
  },
  metadata: {
    name: "Test Bundle",
    version: "1.0.0"
  }
});
