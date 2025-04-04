# Unit Testing Plan

## Overview

This document outlines the unit testing strategy for the Strict Compile-Time Connection Flow implementation. Unit tests will focus on testing individual components, hooks, and utilities in isolation, ensuring that each piece of the system works correctly before integration.

## Testing Approach

1. **Test-Driven Development**: Where possible, write tests before implementation
2. **Component Testing**: Test React components in isolation
3. **Hook Testing**: Test React hooks using `@testing-library/react-hooks`
4. **Type Safety Testing**: Ensure TypeScript types work as expected
5. **Edge Case Coverage**: Test boundary conditions and error handling

## Test Areas

### Phase 1: Enhanced Handle Types

- Test constructor functions for TextureHandleId and OutputHandleId
- Test type guards for handle validation
- Test utility functions for handle creation and manipulation
- Ensure Zod schemas correctly validate handles

```typescript
// Example test for Phase 1
describe("TextureHandleId", () => {
  test("createTextureHandleId returns null for invalid handles", () => {
    expect(createTextureHandleId("invalid")).toBeNull();
    expect(createTextureHandleId("output-1")).toBeNull();
    expect(createTextureHandleId("")).toBeNull();
  });

  test("createTextureHandleId creates valid handles", () => {
    expect(createTextureHandleId("input-1")).toBe("input-1");
    expect(createTextureHandleId("input-42")).toBe("input-42");
  });

  test("generateTextureHandleId creates correct handles from index", () => {
    expect(generateTextureHandleId(0)).toBe("input-1");
    expect(generateTextureHandleId(1)).toBe("input-2");
  });
});
```

### Phase 2: Connection Types

- Test StrictConnection conversions
- Test connection validation logic
- Test error reporting for invalid connections
- Test connection utility functions

```typescript
// Example test for Phase 2
describe("StrictConnection", () => {
  test("toStrictConnection converts valid connections", () => {
    const validConnection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    };

    const strictConnection = toStrictConnection(validConnection);
    expect(strictConnection).not.toBeNull();
    expect(strictConnection?.sourceHandle).toBe("output-main");
    expect(strictConnection?.targetHandle).toBe("input-1");
  });

  test("validateConnection reports correct errors", () => {
    const invalidConnection = {
      source: "node1",
      target: "node2",
      sourceHandle: "invalid-handle",
      targetHandle: "input-1",
    };

    const result = validateConnection(invalidConnection);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe(ConnectionValidationError.INVALID_SOURCE_HANDLE);
  });
});
```

### Phase 3: Edge Schema

- Test edge schema validation
- Test edge migration utilities
- Test edge store adapter with the new types
- Test uniform name extraction

```typescript
// Example test for Phase 3
describe("Edge Schema", () => {
  test("migrateEdgeHandles handles missing handles", () => {
    const result = migrateEdgeHandles({
      sourceHandle: null,
      targetHandle: null,
    });

    expect(result.sourceHandle).toBe("output-main");
    expect(result.targetHandle).toBe("input-1");
  });

  test("getUniformForEdge returns correct uniform name", () => {
    const textureHandle = createTextureHandleId("input-1")!;
    expect(getUniformForEdge({ targetHandle: textureHandle })).toBe(
      "u_texture1",
    );
  });
});
```

### Phase 4: UI Components

- Test TextureHandle and OutputHandle components
- Test EdgeLine component with different connection states
- Test node components with typed handles

```typescript
// Example test for Phase 4
describe("TextureHandle Component", () => {
  test("renders with valid handle ID", () => {
    const handle = generateTextureHandleId(0);
    const { getByTestId } = render(
      <TextureHandle id={handle} data-testid="test-handle" />
    );

    expect(getByTestId("test-handle")).toBeInTheDocument();
  });

  test("shows connection indicator when connected", () => {
    const handle = generateTextureHandleId(0);
    const { getByTestId } = render(
      <TextureHandle
        id={handle}
        isConnected={true}
        connectionIndicator={true}
        data-testid="test-handle"
      />
    );

    expect(getByTestId("test-handle")).toHaveClass("connected");
  });
});
```

### Phase 5: Hook Logic

- Test useAddEdge hook with valid and invalid connections
- Test useEdgeStore with the new validation
- Test useUpdateTextureConnection with typed handles
- Test useDynamicConnections with different connection types

```typescript
// Example test for Phase 5
describe("useAddEdge Hook", () => {
  test("returns false for invalid connections", () => {
    const onInvalidConnection = jest.fn();
    const { result } = renderHook(() => useAddEdge({ onInvalidConnection }));

    const invalidConnection = {
      source: "node1",
      target: "node2",
      sourceHandle: "invalid",
      targetHandle: "input-1",
    };

    expect(result.current(invalidConnection)).toBe(false);
    expect(onInvalidConnection).toHaveBeenCalled();
  });

  test("adds valid connections to the store", () => {
    const mockAddEdge = jest.fn();
    jest.spyOn(EdgeStoreContext, "useEdgeStore").mockImplementation(() => ({
      addEdge: mockAddEdge,
      // Other store properties
    }));

    const { result } = renderHook(() => useAddEdge());

    const validConnection = {
      source: "node1",
      target: "node2",
      sourceHandle: "output-main",
      targetHandle: "input-1",
    };

    expect(result.current(validConnection)).toBe(true);
    expect(mockAddEdge).toHaveBeenCalled();
  });
});
```

### Phase 6: WebGL Registry

- Test texture registry with typed handles
- Test validation functions for texture types
- Test uniform name mapping

```typescript
// Example test for Phase 6
describe("Texture Registry", () => {
  test("getTextureInputsForType returns correct inputs", () => {
    const inputs = getTextureInputsForType("displace");
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).toBe("input-1");
    expect(inputs[1].id).toBe("input-2");
  });

  test("isValidTextureHandleForType validates handles", () => {
    const handle = generateTextureHandleId(0); // input-1
    expect(isValidTextureHandleForType("displace", handle)).toBe(true);

    const invalidHandle = generateTextureHandleId(5); // input-6
    expect(isValidTextureHandleForType("displace", invalidHandle)).toBe(false);
  });
});
```

### Phase 7: Validation Middleware

- Test ConnectionValidationMiddleware component
- Test connection validation UI feedback
- Test toast notifications for errors
- Test integration with React Flow

```typescript
// Example test for Phase 7
describe("ConnectionValidationMiddleware", () => {
  test("shows error for invalid connections", async () => {
    const mockToast = jest.fn();
    jest.spyOn(ToastContext, "useToast").mockImplementation(() => ({
      toast: mockToast,
      toasts: [],
      dismissToast: jest.fn(),
    }));

    const { getByTestId } = render(
      <ConnectionValidationMiddleware>
        <div data-testid="test-content">Test Content</div>
      </ConnectionValidationMiddleware>
    );

    // Simulate connection event with invalid connection
    const invalidConnection = {
      source: "node1",
      target: "node2",
      sourceHandle: "invalid",
      targetHandle: "input-1",
    };

    act(() => {
      // Find and trigger the onConnect handler
      const handlers = JSON.parse(
        getByTestId("flow-connection-handler").dataset.onconnect
      );
      handlers.onConnect(invalidConnection);
    });

    // Check that error is shown
    expect(getByTestId("invalid-connection")).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
      })
    );
  });
});
```

## Test Coverage Goals

| Component Type    | Coverage Target |
| ----------------- | --------------- |
| Type Definitions  | 100%            |
| Utility Functions | 95%             |
| React Hooks       | 90%             |
| React Components  | 85%             |

## Testing Tools

- Jest for test runner and assertions
- React Testing Library for component testing
- @testing-library/react-hooks for hook testing
- ts-jest for TypeScript support
- jest-dom for DOM testing utilities

## Continuous Integration

- Run unit tests on every pull request
- Enforce minimum code coverage thresholds
- Block merges if tests fail or coverage drops below threshold

## Mocking Strategy

- Mock external dependencies like React Flow
- Mock stores and providers using context API
- Use jest.fn() and jest.spyOn() for function mocks
- Create test fixtures for common test data
