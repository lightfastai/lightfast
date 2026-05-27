# @lightfastai/cli

CLI for signing in to Lightfast from local developer workflows.

## Purpose

Provides command-line tools for:
- Signing in with Clerk OAuth Authorization Code + PKCE
- Binding the native session to a Lightfast organization selected in the browser
- Inspecting and clearing the stored CLI session

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

Build the CLI:

```bash
pnpm --filter @lightfastai/cli build
```

## Usage

### Sign in

```bash
lightfast login
```

The CLI starts a temporary loopback listener on `127.0.0.1`, opens your browser, and signs in with Clerk OAuth Authorization Code + PKCE. Organization selection happens in the Lightfast web app during sign-in, and the stored native session is bound to that selected organization.

### Show current session

```bash
lightfast whoami
```

### Sign out

```bash
lightfast logout
```

## Commands

### login

Signs in with Clerk OAuth Authorization Code + PKCE and stores the org-bound native CLI session in `auth.json`. The browser callback uses an ephemeral loopback port.

```bash
lightfast login
```

### whoami

Shows the currently stored CLI session.

```bash
lightfast whoami
```

### logout

Removes the stored CLI session.

```bash
lightfast logout
```

## Development

Run in development mode:

```bash
pnpm --filter @lightfastai/cli dev
```

## Documentation

For CLI specification, see [docs/architecture/phase1/package-structure.md](../../docs/architecture/phase1/package-structure.md).
