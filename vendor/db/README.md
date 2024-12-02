# Database Package

This package provides the database layer for the application, using Drizzle ORM with PostgreSQL (via Neon).

## Architecture

The database package is structured around several key components:

- **Schema**: Defines the database structure using Drizzle ORM
- **Migrations**: Handles database schema changes
- **Edge Constraints**: Implements business rules for node connections
- **Client**: Provides database connection and query interface

### Key Features

- Type-safe database operations with Drizzle ORM
- Automated migrations using DrizzleKit
- Database-level constraints for graph edge validation
- Connection pooling optimization for serverless environments

## Schema

The database schema includes several core tables:

- `node`: Stores graph nodes (geometry, material, texture)
- `edge`: Manages connections between nodes with constraint enforcement
- `workspace`: Organizes nodes into user workspaces
- `user`: Manages user accounts and authentication
- `session`: Handles user sessions
- `account`: Stores OAuth provider information

### Edge Constraints

The database implements a trigger-based constraint system for edges:
