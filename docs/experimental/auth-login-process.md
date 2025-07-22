# Authentication Login Process

## Test Credentials

When using Playwright or any testing tools that require authentication, use the following credentials:

- **Email**: `admin@lightfast.ai`
- **Password**: `ijXFdBJ3U2eMDFnKqngp`

## Authentication Modes

The application uses different authentication methods based on the environment:

### Production Environment
- **Method**: Email verification only
- **Process**: Enter email → Receive verification code → Enter code to sign in

### Development/Preview Environment
- **Method**: Email + Password authentication
- **Process**: Enter email and password → Sign in directly

## Playwright Authentication Example

```javascript
// Navigate to sign-in page
await page.goto('http://localhost:3000/sign-in');

// Enter email
await page.fill('input[type="email"]', 'admin@lightfast.ai');

// Enter password (dev/preview only)
await page.fill('input[type="password"]', 'ijXFdBJ3U2eMDFnKqngp');

// Click sign in button
await page.click('button:has-text("Sign In")');

// Wait for navigation
await page.waitForURL('**/chat/**');
```

## MCP Playwright Example

When using the Playwright MCP with Claude:

1. Navigate to sign-in:
   ```
   mcp__playwright-mastra__browser_navigate
   URL: http://localhost:3000/sign-in
   ```

2. Enter email:
   ```
   mcp__playwright-mastra__browser_type
   element: Email input field
   text: admin@lightfast.ai
   ```

3. Enter password:
   ```
   mcp__playwright-mastra__browser_type
   element: Password input field
   text: ijXFdBJ3U2eMDFnKqngp
   ```

4. Submit form:
   ```
   mcp__playwright-mastra__browser_click
   element: Sign In button
   ```

## Important Notes

- These credentials are for development and testing only
- Never use these credentials in production
- Password authentication is automatically disabled in production
- Always ensure proper environment variables are set for authentication to work correctly