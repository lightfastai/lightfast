# Contributing to Lightfast

We're excited that you're interested in contributing to Lightfast! This document outlines how to contribute to the project effectively.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Development Setup

### Prerequisites
- Node.js >= 20.16.0
- pnpm 10.5.2 (enforced by packageManager)

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/lightfast.git
   cd lightfast
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Set up environment variables:
   - Copy `.env.example` files in relevant app directories
   - Configure required environment variables

## Project Structure

This is a monorepo using pnpm workspaces with Turbo:

- **Apps**: `apps/` - Main applications
  - `www` - Marketing site (port 4101)
- **Packages**: `packages/` - Shared libraries  
- **Vendor**: `vendor/` - Third-party integrations
- **Internal**: `internal/` - Build tools and configurations

## Development Workflow

### Common Commands

```bash
# Development
pnpm dev            # Start all development servers
pnpm dev:www        # Start www app only

# Building (app-specific)
pnpm build:www      # Build www app only
pnpm build:auth     # Build auth app only
pnpm build:cloud    # Build cloud app only

# Code Quality
pnpm lint           # Lint all packages
pnpm lint:fix       # Fix linting issues
pnpm typecheck      # Run TypeScript type checking
pnpm format         # Check formatting
pnpm format:fix     # Fix formatting issues

# Database
pnpm db:migrate     # Run database migrations
pnpm db:studio      # Open database studio

# Cleanup
pnpm clean          # Clean all build artifacts
pnpm clean:workspaces # Clean turbo workspaces
```

### Claude Code with MCP

Start Claude Code with selective MCP servers:

```bash
pnpm claude           # Base only
pnpm claude -b        # + Playwright browser (fresh session)
pnpm claude -B        # + Playwright browser (with saved session)
pnpm claude -e        # + Exa search
pnpm claude -b -e     # + browser + exa
pnpm claude -a        # All MCP servers (browser with session + exa)
```

Available MCP servers are documented in `.mcp.json`.

#### Saving Browser Sessions for Playwright

The `-B` flag uses a saved browser session from `.auth/browser-session.json`, allowing Playwright to access authenticated pages without re-logging in each time.

**To save a new browser session:**

1. Start Claude Code with the basic browser flag:
   ```bash
   pnpm claude -b
   ```

2. Ask Claude to navigate to the site and log in:
   ```
   Navigate to https://example.com/login and log in with my credentials
   ```

3. After logging in, ask Claude to save the session:
   ```
   Save the browser storage state to .auth/browser-session.json
   ```

   Claude will run something like:
   ```javascript
   await page.context().storageState({ path: '.auth/browser-session.json' })
   ```

4. Future sessions with `-B` or `-a` will use this saved state:
   ```bash
   pnpm claude -B  # Now authenticated automatically
   ```

**Note:** Add `.auth/` to your `.gitignore` to avoid committing session data.

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our code conventions:
   - Use TypeScript with strict type checking
   - Follow ESLint configuration from `@repo/eslint-config`
   - Use Prettier configuration from `@repo/prettier-config`
   - Maintain consistent code style with existing codebase

3. Test your changes:
   ```bash
   pnpm typecheck     # Ensure no type errors
   pnpm lint          # Check code style
   pnpm format        # Check formatting
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

## Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use proper error handling with Result patterns where applicable

### React/Next.js (for www app)
- Use App Router patterns
- Prefer server components when possible
- Implement proper loading and error states
- Use `"use client"` directive only when necessary

### Styling
- Use Tailwind CSS v4 via `@repo/ui`
- Follow utility-first approach
- Use CSS variables for dynamic values

### Error Handling
- Implement comprehensive error types
- Use proper error reporting and logging
- Handle edge cases gracefully

## Pull Request Process

1. Ensure your code passes all checks:
   ```bash
   pnpm typecheck && pnpm lint && pnpm format
   ```

2. Update documentation if needed
3. Create a pull request with:
   - Clear title describing the change
   - Detailed description of what changed and why
   - Reference any related issues

4. Ensure CI passes
5. Address any feedback from reviewers

## Testing

Check individual package.json files for testing commands. Currently no global test command is configured.

## Documentation

- Keep README files up to date
- Add JSDoc comments for complex functions
- Update type definitions when making API changes

## Environment Variables

Environment variables are loaded via `dotenv` in app packages. Check individual app configurations for environment-specific requirements.

## Reporting Issues

When reporting issues, please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment information (Node.js version, OS, etc.)
- Relevant logs or error messages

## Getting Help

- Check existing issues and discussions
- Review documentation in the repository
- Ask questions in pull request discussions

## License

By contributing to Lightfast, you agree that your contributions will be licensed under the Functional Source License, Version 1.1 (FSL-1.1-ALv2).

Thank you for contributing to Lightfast!