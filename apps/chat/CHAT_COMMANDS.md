# Chat Test Commands (Development Only)

## Overview
In development mode, you can trigger various error scenarios directly in the chat by typing special commands. This allows you to test error handling in the actual chat flow.

## Usage
Simply type these commands as regular chat messages. They only work when `NODE_ENV=development`.

## Available Commands

### Error Testing Commands

| Command | Description | HTTP Status |
|---------|-------------|-------------|
| `/test error rate-limit` | Trigger rate limit error | 429 |
| `/test error bot` | Trigger bot detection | 403 |
| `/test error model-access` | Model access denied | 403 |
| `/test error auth` | Authentication required | 401 |
| `/test error bad-request` | Bad request error | 400 |
| `/test error not-found` | Resource not found | 404 |
| `/test error server` | Internal server error | 500 |
| `/test error bad-gateway` | Bad gateway error | 502 |
| `/test error unavailable` | Service unavailable | 503 |
| `/test error timeout` | Gateway timeout | 504 |
| `/test error help` | Show all available commands | - |

### Using Status Codes
You can also use HTTP status codes directly:
- `/test error 429` - Rate limit
- `/test error 503` - Service unavailable
- `/test error 500` - Server error
- Any status code between 400-599

## Examples

### Testing Rate Limiting
1. Type: `/test error rate-limit`
2. You'll see:
   - Toast notification: "Rate limit reached"
   - Inline error below your message
   - No retry button (non-retryable)

### Testing Network Issues
1. Type: `/test error 503`
2. You'll see:
   - Toast: "Service temporarily unavailable"
   - Retry button appears
   - Can click retry to resend

### Testing Authentication
1. Type: `/test error auth`
2. You'll see:
   - "Authentication required" message
   - Persistent inline error
   - Sign in prompt

### Get Help
Type: `/test error help`
- Shows all available commands in the chat

## How It Works

1. The API route (`/api/v/[...v]/route.ts`) intercepts messages starting with `/test error`
2. In development mode only, it returns the appropriate error response
3. The chat interface handles the error as if it were real
4. Your error handler displays the appropriate UI (toast, inline error, retry button)

## Testing Workflow

1. **Start a chat session**
2. **Send a normal message** to ensure chat is working
3. **Type a test command** like `/test error rate-limit`
4. **Observe the error handling**:
   - Toast notification appears
   - Inline error shows for critical errors
   - Retry buttons for retryable errors
5. **Try recovery**: Click retry buttons or send another message

## Notes

- Commands only work in development (`NODE_ENV=development`)
- Commands are processed before reaching the AI
- Each command simulates the exact error that would come from the API
- Perfect for testing error recovery flows
- Works alongside the error test panel (bug button)

## Combining with Test Panel

You can use both approaches:
1. **Chat commands** - Test errors in actual message flow
2. **Test panel** (bug button) - Quick error triggering without typing

Both tools complement each other for comprehensive error testing.