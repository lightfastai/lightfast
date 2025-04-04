# Integration Testing Plan

## Overview

This document outlines the integration testing strategy for the Strict Compile-Time Connection Flow implementation. Integration tests will focus on testing how multiple components, hooks, and systems work together to ensure the entire connection flow functions correctly.

## Testing Approach

1. **Component Integration**: Test interactions between related components
2. **Flow Integration**: Test the complete connection flow from UI to database
3. **Store Integration**: Test interactions between different stores
4. **Error Handling**: Test how errors propagate through the system
5. **Real-World Scenarios**: Test common user workflows

## Test Areas

### Connection Flow Testing

Test the complete connection flow from UI interaction to data storage:

1. **UI to Store Flow**: Test that UI interactions correctly update the edge store
2. **Store to Database Flow**: Test that store changes are correctly persisted
3. **Database to UI Flow**: Test that database changes are reflected in the UI

```typescript
// Example integration test for connection flow
describe("Connection Flow Integration", () => {
  test("creating a connection in UI updates edge store and database", async () => {
    // Setup component with necessary providers
    const { getByTestId, findByText } = render(
      <TestProviders>
        <FlowComponent />
      </TestProviders>
    );

    // Simulate connection creation in UI
    const sourceNode = getByTestId("node-source");
    const targetNode = getByTestId("node-target");
    const sourceHandle = getByTestId("handle-output-main");
    const targetHandle = getByTestId("handle-input-1");

    // Simulate drag and drop
    fireEvent.mouseDown(sourceHandle);
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(targetHandle);
    fireEvent.mouseUp(targetHandle);

    // Verify edge store was updated
    await waitFor(() => {
      const edges = mockEdgeStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].sourceHandle).toBe("output-main");
      expect(edges[0].targetHandle).toBe("input-1");
    });

    // Verify database call was made
    expect(mockAddEdgeApi).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceHandle: "output-main",
        targetHandle: "input-1",
      })
    );
  });
});
```

### Component Integration Testing

Test how connected components work together:

1. **Node and Handle Integration**: Test that nodes correctly create and manage handles
2. **Handle and Connection Integration**: Test that handles correctly manage connections
3. **Connection and Edge Integration**: Test that connections correctly create edges

```typescript
// Example component integration test
describe("Node and Handle Integration", () => {
  test("TextureNode creates correct number of handles for texture type", () => {
    // Mock texture registry
    jest.spyOn(TextureRegistry, "getTextureInputsForType").mockReturnValue([
      {
        id: createTextureHandleId("input-1")!,
        uniformName: "u_texture1",
        description: "Base texture",
        required: true,
      },
      {
        id: createTextureHandleId("input-2")!,
        uniformName: "u_texture2",
        description: "Displacement map",
        required: true,
      },
    ]);

    // Render node
    const { getAllByTestId } = render(
      <TestProviders>
        <TextureNode
          id="node-1"
          data={{ type: "displace" }}
          type="texture"
          position={{ x: 0, y: 0 }}
        />
      </TestProviders>
    );

    // Verify correct handles were created
    const handles = getAllByTestId(/handle-input-\d+/);
    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveAttribute("data-handleid", "input-1");
    expect(handles[1]).toHaveAttribute("data-handleid", "input-2");
  });
});
```

### Store Integration Testing

Test interactions between different stores:

1. **EdgeStore and NodeStore**: Test that changes in nodes affect edges
2. **ProjectStore and EdgeStore**: Test that project changes affect edges
3. **EdgeStore and WebGLStore**: Test that edge changes affect WebGL rendering

```typescript
// Example store integration test
describe("EdgeStore and NodeStore Integration", () => {
  test("deleting a node removes connected edges", () => {
    // Setup stores
    const nodeStore = createNodeStore();
    const edgeStore = createEdgeStore();

    // Add nodes
    nodeStore.getState().addNode({
      id: "node-1",
      type: "texture",
      position: { x: 0, y: 0 },
      data: { type: "noise" },
    });

    nodeStore.getState().addNode({
      id: "node-2",
      type: "texture",
      position: { x: 100, y: 0 },
      data: { type: "displace" },
    });

    // Add edge
    edgeStore.getState().addEdge({
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    });

    // Delete node
    nodeStore.getState().deleteNode("node-1");

    // Verify edge was removed
    expect(edgeStore.getState().edges).toHaveLength(0);
  });
});
```

### Error Handling Integration

Test how errors propagate through the system:

1. **Validation Errors**: Test that validation errors are correctly displayed
2. **API Errors**: Test that API errors are correctly handled
3. **Runtime Errors**: Test that runtime errors are caught and reported

```typescript
// Example error handling integration test
describe("Validation Error Integration", () => {
  test("invalid connection shows error toast and visual feedback", async () => {
    // Setup component with necessary providers
    const { getByTestId, findByText } = render(
      <TestProviders>
        <ToastProvider>
          <FlowComponent />
        </ToastProvider>
      </TestProviders>
    );

    // Setup mock validator to return error
    jest.spyOn(ConnectionValidator, "validateConnection").mockReturnValue({
      valid: false,
      reason: "invalid_source_handle",
      details: "Source handle 'invalid' is not a valid handle ID",
    });

    // Simulate connection creation with invalid handle
    // ... simulate drag and drop with invalid handle

    // Verify error UI is shown
    expect(await findByText("Invalid Connection")).toBeInTheDocument();
    expect(await findByText("Source handle 'invalid' is not a valid handle ID")).toBeInTheDocument();

    // Verify visual feedback is shown
    expect(getByTestId("invalid-connection-indicator")).toBeInTheDocument();
  });
});
```

### WebGL Integration Testing

Test that the connection system correctly integrates with WebGL rendering:

1. **Texture Connection to Shader**: Test that connections correctly update shader uniforms
2. **Handle Type to Uniform Mapping**: Test that handle types correctly map to uniform names
3. **Connection Validation to Rendering**: Test that invalid connections don't affect rendering

```typescript
// Example WebGL integration test
describe("Texture Connection to Shader Integration", () => {
  test("connecting nodes updates shader uniforms", async () => {
    // Setup component with necessary providers
    const { getByTestId } = render(
      <TestProviders>
        <WebGLProvider>
          <FlowComponent />
        </WebGLProvider>
      </TestProviders>
    );

    // Mock WebGL context
    const mockSetUniform = jest.fn();
    jest.spyOn(WebGLContext, "useWebGL").mockReturnValue({
      setUniform: mockSetUniform,
      // Other WebGL methods
    });

    // Simulate connection creation
    // ... simulate drag and drop

    // Verify uniform was set
    await waitFor(() => {
      expect(mockSetUniform).toHaveBeenCalledWith(
        "u_texture1",
        expect.any(Object) // Texture object
      );
    });
  });
});
```

## Integration Test Environment

### Test Setup

```typescript
// Example test setup
const TestProviders = ({ children }) => {
  // Create test stores
  const nodeStore = createNodeStore();
  const edgeStore = createEdgeStore();

  // Setup test nodes
  useEffect(() => {
    nodeStore.getState().setNodes([
      {
        id: "node-source",
        type: "texture",
        position: { x: 0, y: 0 },
        data: { type: "noise" },
      },
      {
        id: "node-target",
        type: "texture",
        position: { x: 200, y: 0 },
        data: { type: "displace" },
      },
    ]);
  }, []);

  return (
    <NodeStoreProvider store={nodeStore}>
      <EdgeStoreProvider store={edgeStore}>
        <ReactFlowProvider>
          {children}
        </ReactFlowProvider>
      </EdgeStoreProvider>
    </NodeStoreProvider>
  );
};
```

### Mock Strategies

1. **API Mocks**: Mock API calls to return predictable data
2. **Store Mocks**: Use test stores with controlled state
3. **WebGL Mocks**: Mock WebGL context to avoid actual rendering
4. **DOM Event Mocks**: Simulate complex DOM events for dragging

## Test Coverage Goals

| Integration Area      | Coverage Target |
| --------------------- | --------------- |
| Connection Flow       | 90%             |
| Component Integration | 85%             |
| Store Integration     | 85%             |
| Error Handling        | 90%             |
| WebGL Integration     | 80%             |

## Integration Testing Tools

- Jest for test runner
- React Testing Library for component rendering and interaction
- MSW (Mock Service Worker) for API mocking
- jest-canvas-mock for WebGL context mocking
- user-event for advanced user interaction simulation

## Continuous Integration

- Run integration tests on pull requests to main branches
- Schedule nightly runs for more extensive integration tests
- Include screenshots/videos of visual tests in CI artifacts
