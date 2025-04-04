# Migration Testing Plan

## Overview

This document outlines the migration testing strategy for the Strict Compile-Time Connection Flow implementation. Migration tests will focus on ensuring that existing data and code remain compatible with the new type system, and that the migration paths provided work correctly.

## Testing Approach

1. **Data Migration**: Test that existing data is correctly migrated to the new format
2. **API Compatibility**: Test that the API remains compatible with existing clients
3. **Runtime Validation**: Test that runtime validation correctly handles legacy data
4. **Edge Cases**: Test migration of edge cases and potentially invalid data
5. **Rollback**: Test the ability to rollback migrations if needed

## Test Areas

### Data Migration Testing

Test that existing data formats are correctly migrated to the new type system:

1. **Edge Migration**: Test migration of existing edges with string handles
2. **Handle Migration**: Test migration of handles with various formats
3. **Null/Undefined Handling**: Test migration of missing or null handles

```typescript
// Example data migration test
describe("Edge Data Migration", () => {
  test("migrates edges with string handles", async () => {
    // Setup test database with legacy data
    await setupTestDatabaseWithLegacyData([
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        sourceHandle: "output-1", // Legacy format
        targetHandle: "input-1",
      },
    ]);

    // Run migration
    await migrateEdges();

    // Verify migration result
    const migratedEdges = await db.select().from(edge);
    expect(migratedEdges[0].sourceHandle).toBe("output-main"); // Corrected format
    expect(migratedEdges[0].targetHandle).toBe("input-1");
  });

  test("handles null or undefined handles", async () => {
    // Setup test database with missing handles
    await setupTestDatabaseWithLegacyData([
      {
        id: "edge-2",
        source: "node-1",
        target: "node-2",
        sourceHandle: null,
        targetHandle: undefined,
      },
    ]);

    // Run migration
    await migrateEdges();

    // Verify defaults were applied
    const migratedEdges = await db.select().from(edge);
    expect(migratedEdges[0].sourceHandle).toBe("output-main");
    expect(migratedEdges[0].targetHandle).toBe("input-1");
  });
});
```

### API Compatibility Testing

Test that the API remains compatible with existing clients:

1. **Legacy Client API**: Test that legacy clients can still interact with the API
2. **Response Format**: Test that API responses maintain backward compatibility
3. **New Validation**: Test that new validation doesn't break existing clients

```typescript
// Example API compatibility test
describe("API Compatibility", () => {
  test("legacy client can create edges", async () => {
    // Setup legacy client
    const legacyClient = createLegacyClient();

    // Create edge with legacy format
    const result = await legacyClient.createEdge({
      source: "node-1",
      target: "node-2",
      sourceHandle: "output", // Legacy format
      targetHandle: "input-1",
    });

    // Verify edge was created and corrected
    expect(result.id).toBeDefined();
    expect(result.sourceHandle).toBe("output-main"); // Server corrected

    // Verify in database
    const dbEdge = await db.select().from(edge).where(eq(edge.id, result.id));
    expect(dbEdge[0].sourceHandle).toBe("output-main");
  });

  test("API response format remains compatible", async () => {
    // Setup test
    const client = createApiClient();

    // Get edges from API
    const edges = await client.getEdges();

    // Verify response format is compatible with legacy clients
    expect(edges[0]).toHaveProperty("sourceHandle");
    expect(edges[0]).toHaveProperty("targetHandle");
    expect(typeof edges[0].sourceHandle).toBe("string");
    expect(typeof edges[0].targetHandle).toBe("string");
  });
});
```

### Runtime Validation Testing

Test that runtime validation correctly handles legacy data:

1. **Invalid Handle Migration**: Test how invalid handles are handled at runtime
2. **Validation Errors**: Test that validation errors are handled gracefully
3. **Performance Impact**: Test that runtime validation doesn't impact performance

```typescript
// Example runtime validation test
describe("Runtime Validation", () => {
  test("runtime validation corrects invalid handles", () => {
    // Create edge with invalid handle format
    const invalidEdge = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      sourceHandle: "invalid-format",
      targetHandle: "input-1",
    };

    // Run through migration utility
    const migratedEdge = prepareEdgeForInsert(invalidEdge);

    // Verify handles were corrected
    expect(migratedEdge.sourceHandle).toBe("output-main");
    expect(migratedEdge.targetHandle).toBe("input-1");
  });

  test("invalid handles in UI are handled gracefully", async () => {
    // Setup component with legacy data
    const { getByText } = render(
      <TestProviders legacyData={true}>
        <FlowComponent />
      </TestProviders>
    );

    // Verify no errors are thrown and UI renders
    expect(getByText("Flow Chart")).toBeInTheDocument();

    // Try to interact with invalid handles
    // ... simulate interactions

    // Verify appropriate error messages are shown
    expect(getByText("Handle format is invalid")).toBeInTheDocument();
  });
});
```

### WebGL Compatibility Testing

Test that the WebGL integration works with migrated data:

1. **Shader Uniform Compatibility**: Test shader uniform updates with migrated handles
2. **Texture Connection Migration**: Test that texture connections work after migration
3. **Rendering Consistency**: Test that rendering output is consistent before and after migration

```typescript
// Example WebGL compatibility test
describe("WebGL Compatibility", () => {
  test("migrated handles correctly update shader uniforms", async () => {
    // Setup
    const mockSetUniform = jest.fn();
    jest.spyOn(WebGLContext, "useWebGL").mockReturnValue({
      setUniform: mockSetUniform,
      // Other methods
    });

    // Load project with migrated edges
    const { getByTestId } = render(
      <TestProviders migratedData={true}>
        <WebGLProvider>
          <FlowComponent />
        </WebGLProvider>
      </TestProviders>
    );

    // Verify shader uniforms are set correctly
    await waitFor(() => {
      expect(mockSetUniform).toHaveBeenCalledWith(
        "u_texture1", // Correct uniform name
        expect.any(Object)
      );
    });
  });

  test("rendering output matches pre-migration", async () => {
    // Capture pre-migration render output
    const preMigrationOutput = await captureRenderOutput(legacyProject);

    // Migrate project
    const migratedProject = await migrateProject(legacyProject);

    // Capture post-migration render output
    const postMigrationOutput = await captureRenderOutput(migratedProject);

    // Compare outputs (allowing for minor pixel differences)
    expect(compareRenderOutputs(preMigrationOutput, postMigrationOutput)).toBeLessThan(0.01);
  });
});
```

### Rollback Testing

Test the ability to rollback migrations if needed:

1. **Migration Rollback**: Test rolling back a migration
2. **Data Preservation**: Test that data is preserved during rollback
3. **System Stability**: Test that the system remains stable after rollback

```typescript
// Example rollback test
describe("Migration Rollback", () => {
  test("can rollback edge migration", async () => {
    // Setup test database
    const originalEdges = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        sourceHandle: "output-1",
        targetHandle: "input-1",
      },
    ];

    await setupTestDatabaseWithLegacyData(originalEdges);

    // Run migration
    const migrationResult = await migrateEdges();

    // Verify migration occurred
    let currentEdges = await db.select().from(edge);
    expect(currentEdges[0].sourceHandle).toBe("output-main");

    // Rollback migration
    await rollbackMigration(migrationResult.migrationId);

    // Verify rollback restored original data
    currentEdges = await db.select().from(edge);
    expect(currentEdges[0].sourceHandle).toBe("output-1");
  });

  test("system remains stable after rollback", async () => {
    // Setup system with rolled-back migration
    await setupRolledBackSystem();

    // Verify system functions correctly
    const { getByText } = render(
      <TestProviders>
        <FlowComponent />
      </TestProviders>
    );

    // Check that the app loads without errors
    expect(getByText("Flow Chart")).toBeInTheDocument();

    // Verify basic functionality works
    // ... test basic operations
  });
});
```

## Migration Test Environment

### Test Setup

```typescript
// Example migration test setup
async function setupTestDatabaseWithLegacyData(legacyData) {
  // Clear database
  await db.delete(edge);

  // Insert legacy data
  for (const item of legacyData) {
    await db.insert(edge).values(item);
  }
}

async function migrateEdges() {
  // Run the actual migration script
  const result = await db.execute(`
    UPDATE edge
    SET source_handle = CASE
      WHEN source_handle IS NULL OR source_handle = '' THEN 'output-main'
      WHEN source_handle NOT LIKE 'output-%' THEN CONCAT('output-', SUBSTRING_INDEX(source_handle, '-', -1))
      ELSE source_handle
    END,
    target_handle = CASE
      WHEN target_handle IS NULL OR target_handle = '' THEN 'input-1'
      WHEN target_handle NOT LIKE 'input-%' THEN CONCAT('input-', SUBSTRING_INDEX(target_handle, '-', -1))
      ELSE target_handle
    END
  `);

  return {
    migrationId: Date.now().toString(),
    affectedRows: result.rowCount,
  };
}

async function rollbackMigration(migrationId) {
  // Use the migration backup table to restore original values
  await db.execute(
    `
    UPDATE edge e
    JOIN edge_migration_backup b ON e.id = b.edge_id
    SET e.source_handle = b.original_source_handle,
        e.target_handle = b.original_target_handle
    WHERE b.migration_id = ?
  `,
    [migrationId],
  );
}
```

### Test Data Generators

```typescript
// Example test data generator
function generateLegacyEdgeData(count = 10) {
  const edges = [];

  for (let i = 0; i < count; i++) {
    edges.push({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
      sourceHandle: Math.random() > 0.5 ? `output-${i % 3}` : `out-${i % 3}`, // Mix of formats
      targetHandle: Math.random() > 0.5 ? `input-${i % 4}` : `in-${i % 4}`, // Mix of formats
    });
  }

  return edges;
}

function generateProblemCases() {
  return [
    // Missing handles
    {
      id: "edge-null",
      source: "node-1",
      target: "node-2",
      sourceHandle: null,
      targetHandle: null,
    },
    // Invalid formats
    {
      id: "edge-invalid",
      source: "node-3",
      target: "node-4",
      sourceHandle: "completely-wrong-format",
      targetHandle: "another-wrong-format",
    },
    // Mixed valid/invalid
    {
      id: "edge-mixed",
      source: "node-5",
      target: "node-6",
      sourceHandle: "output-main",
      targetHandle: "wrong-format",
    },
  ];
}
```

## Test Coverage Goals

| Migration Area         | Coverage Target |
| ---------------------- | --------------- |
| Data Migration         | 95%             |
| API Compatibility      | 90%             |
| Runtime Validation     | 90%             |
| WebGL Compatibility    | 85%             |
| Rollback Functionality | 95%             |

## Migration Testing Tools

- Jest for test runner
- Custom database utilities for setting up test data
- Visual regression testing for WebGL output
- Custom API clients for compatibility testing
- Mock service workers for API testing

## Continuous Integration

- Run basic migration tests on every pull request
- Run comprehensive migration tests before releases
- Include migration tests in deployment pipeline
- Track migration test metrics over time

## Risk Mitigation

- Create database backups before running migration tests
- Implement transaction-based migrations with rollback capability
- Include monitoring for migration issues in production
- Provide clear migration error reporting
