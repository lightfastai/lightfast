// Simple test configuration for base CLI functionality
// This will be replaced with TypeScript compilation in the next PR

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
        description: "Simple test configuration for CLI development"
      },
      dev: {
        port: 3000
      }
    };
  }
};

export default lightfast;