# Contributing to Lightfast

We're excited that you're interested in contributing to Lightfast! This document outlines how to contribute to the project effectively.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Development Setup

### Prerequisites
- Node.js >= 22.12.0
- pnpm 10.32.1 (enforced by packageManager)

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

This is a monorepo using pnpm workspaces with Turborepo:

- **Apps** (`apps/`):
  - `app` — main application (tRPC + Inngest, auth, server actions)
  - `platform` — platform host (tRPC, Inngest, health endpoints)
  - `www` — marketing site + docs (fumadocs MDX)
  - `desktop` — Electron desktop client
- **Shared code**: `core/`, `api/`, `db/`, `packages/`, `vendor/`, `internal/` — SDKs, API routers, database, UI/utility packages, third-party integrations, and build tooling

See `CLAUDE.md` for the full architecture diagram.

## Development Workflow

### Common Commands

```bash
# Development
pnpm dev            # Start app + www + platform
pnpm dev:app        # Start app only
pnpm dev:www        # Start www only
pnpm dev:platform   # Start platform only
pnpm dev:desktop    # Start desktop (Electron)

# Building (app-specific)
pnpm build:app      # Build app
pnpm build:platform # Build platform
pnpm build:www      # Build www

# Code Quality
pnpm check          # Biome lint + format check
pnpm typecheck      # TypeScript type checking
pnpm lint:ws        # Workspace dependency boundary check

# Database
pnpm db:generate    # Generate Drizzle migrations (NEVER write manual .sql)
pnpm db:migrate     # Apply migrations
pnpm dev:studio     # Open Drizzle Studio

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
   - Lint and format are enforced by Biome via `biome.jsonc`
   - Maintain consistent code style with the existing codebase

3. Test your changes:
   ```bash
   pnpm check         # Biome lint + format check
   pnpm typecheck     # Ensure no type errors
   ```

4. Commit your changes using the scoped convention (`type(scope): subject`):
   ```bash
   git add .
   git commit -m "feat(app): add new feature description"
   ```

   Common scopes mirror the affected area: `app`, `platform`, `www`, `desktop`, `api`, `db`, `vendor`, `core`, `deps`, `dev`. Types include `feat`, `fix`, `refactor`, `chore`, `docs`, `revert`.

## Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use proper error handling with Result patterns where applicable

### React/Next.js
- Use App Router patterns
- Prefer server components when possible
- Implement proper loading and error states
- Use `"use client"` directive only when necessary

### Styling
- Use Tailwind CSS via `@repo/ui`
- Follow utility-first approach
- Use CSS variables for dynamic values

### Formatting
- Biome (`biome.jsonc`) handles both linting and formatting
- Run `pnpm check` to verify before pushing

### Error Handling
- Implement comprehensive error types
- Use proper error reporting and logging
- Handle edge cases gracefully

## Pull Request Process

1. Ensure your code passes all checks:
   ```bash
   pnpm check && pnpm typecheck
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

Lightfast is Apache 2.0 for the platform and MIT for the SDKs and shared libraries. By contributing, you agree that your contribution is licensed under the same license as the file(s) you are modifying (as declared by the nearest `package.json` `license` field, or the repository-root `LICENSE` if none applies).

Thank you for contributing to Lightfast!