# Architecture Overview: Strict Compile-Time Connection Flow

## System Purpose

The Strict Compile-Time Connection Flow architecture introduces compile-time type safety for node connections in React TD. The primary goal is to move validation of handle IDs and connections from runtime to compile-time, creating a single source of truth for connection validation and providing better developer feedback through TypeScript.

## Core Components

The system consists of these major components:

### 1. Enhanced Type System

**Description**: A set of TypeScript branded types and validation utilities for handle IDs.

**Key Components**:

- `TextureHandleId`: Branded type for texture input handles
- `OutputHandleId`: Branded type for node output handles
- `HandleId`: Union type for both handle types
- Type guards and constructor functions

**Benefits**:

- Compile-time validation of handle ID format
- Type-level distinction between input and output handles
- Prevention of incorrect handle assignments

### 2. Connection Validation System

**Description**: Utilities and middleware for validating connections between nodes.

**Key Components**:

- `StrictConnection`: Type-safe connection interface
- Validation utilities with detailed error reporting
- Connection validation middleware for React Flow

**Benefits**:

- Centralized validation logic
- Detailed error messages for invalid connections
- Real-time validation during connection creation

### 3. WebGL Registry Integration

**Description**: Integration with the WebGL texture registry to validate texture-specific connections.

**Key Components**:

- Typed texture registry with `TextureHandleId`
- Type-safe uniform name mapping
- Validation against texture type requirements

**Benefits**:

- Ensure texture connections match shader requirements
- Type-safe updates to shader uniforms
- Validation of required vs. optional connections

### 4. UI Feedback System

**Description**: Visual feedback for connection validation in the user interface.

**Key Components**:

- Connection validation visual indicators
- Error tooltips for invalid connections
- Toast notifications for validation errors

**Benefits**:

- Clear feedback on why connections are invalid
- Improved user experience during connection creation
- Prevention of user errors

## Architecture Diagrams

See the [Architecture Diagrams](./architecture-diagrams.md) document for visual representations of the system architecture.

## Data Flow

### Handle ID Flow

1. Handle IDs are defined with branded types (`TextureHandleId`, `OutputHandleId`)
2. Constructor functions ensure IDs have the correct format
3. Component props enforce the correct handle types
4. Handle components validate IDs at render time
5. Connections use type-safe handle IDs

### Connection Flow

1. User initiates a connection in the UI
2. Connection validation middleware intercepts the connection event
3. Connection is validated against type system and WebGL registry
4. If valid, connection is created and stored
5. If invalid, user receives visual feedback and error message

### Validation Flow

1. Basic handle format validation through TypeScript types
2. Connection source/target validation through React Flow
3. Handle type validation (input vs. output) through branded types
4. Texture-specific validation through WebGL registry
5. UI feedback based on validation results

## Technical Constraints

- Must maintain backward compatibility with existing projects
- Must provide migration path for existing code
- Must not impact performance significantly
- Must integrate with React Flow's connection system
- Must support feature flag for gradual rollout

## Security Considerations

- Validation must happen on both client and server
- Handle IDs must be properly validated before database operations
- Error messages should be specific but not expose internal details

## Performance Considerations

- Type safety has no runtime cost (TypeScript types are erased)
- Validation utilities should be optimized for frequent use
- Connection validation should complete within 10ms
- Visual feedback should update immediately

## Migration Strategy

- Phased implementation approach
- Feature flags for gradual adoption
- Backward compatibility for existing projects
- Comprehensive migration guides for developers
- Automated migration utilities for existing data

## Success Metrics

- Reduction in runtime validation errors
- Increase in compile-time errors (catching issues earlier)
- Improved developer experience (measured through surveys)
- No regression in performance benchmarks
- Successful migration of existing projects
