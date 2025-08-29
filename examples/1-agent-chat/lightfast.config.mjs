// Simple mock config for testing without imports
const mockAgent = {
  name: "test-agent",
  model: { provider: "mock", model: "test-model" },
  config: {
    model: "test-model",
    temperature: 0.7
  },
  toJSON() {
    return {
      name: this.name,
      config: this.config
    }
  }
};

const lightfast = {
  toJSON() {
    return {
      agents: {
        testAgent: mockAgent,
        anotherAgent: {
          ...mockAgent,
          name: "another-agent"
        }
      },
      metadata: {
        name: "Test Configuration",
        version: "1.0.0",
        description: "Simple test configuration"
      },
      dev: {
        port: 3000
      }
    };
  }
};

export default lightfast;