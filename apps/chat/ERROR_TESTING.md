# Chat Error Handling - Testing Guide

## Quick Start

### Development Testing Panel

1. **Enable Test Panel** (Development only):
   - Press `Cmd+Shift+E` (Mac) or `Ctrl+Shift+E` (Windows/Linux) to toggle the error test panel
   - The panel appears in the bottom-left corner

2. **Available Test Scenarios**:
   - Each button simulates a specific error condition
   - Errors will appear as toasts and/or inline in the chat

## Manual Testing Scenarios

### 1. Rate Limiting (Anonymous Users)

**Setup:**
- Log out of the application
- Send 10 messages quickly

**Expected Behavior:**
- After 10 messages, rate limit error appears
- Inline error message below the last user message
- Error persists until daily limit resets
- Toast notification with 6-second duration

### 2. Authentication Required

**Scenarios:**
- Try to use an authenticated-only model while logged out
- Session expires during conversation

**Expected Behavior:**
- Clear "Sign in required" message
- Non-retryable error
- Persists in UI

### 3. Network Issues

**Test Methods:**
- Chrome DevTools > Network tab > Set to "Offline"
- Use Network throttling (Slow 3G)
- Kill backend server mid-conversation

**Expected Behavior:**
- "Connection issue" error with retry button
- Retry button attempts to resend last message
- Toast with 4-second duration

### 4. Model Errors

**Scenarios:**
- Select a model that's unavailable
- Model timeout (long processing)

**Expected Behavior:**
- "Model unavailable" with retry option
- Suggests switching models
- Retryable error

### 5. Server Errors

**Test Method:**
- Cause backend to return 500 error
- Database connection failure

**Expected Behavior:**
- "Server error" message
- Retryable after backend recovers
- Generic but informative message

## Testing with Real API

### Modify Transport for Testing

Create a test version of the chat transport that can inject errors:

```typescript
// In development, you can temporarily modify use-chat-transport.ts
if (process.env.NODE_ENV === 'development' && window.location.search.includes('test-error')) {
  const errorType = new URLSearchParams(window.location.search).get('test-error');
  // Inject error based on query param
}
```

### URL-based Testing

Access the chat with query parameters:
- `?test-error=rate-limit` - Simulate rate limiting
- `?test-error=network` - Simulate network failure
- `?test-error=auth` - Simulate auth failure

## Automated Testing

### Unit Tests for Error Handler

```typescript
// Example test structure
describe('ChatErrorHandler', () => {
  it('should classify rate limit errors correctly', () => {
    const error = new Error('Too many requests');
    (error as any).status = 429;
    
    const result = ChatErrorHandler.handleError(error);
    expect(result.type).toBe(ChatErrorType.RATE_LIMIT);
    expect(result.retryable).toBe(false);
  });

  it('should provide retry functionality for network errors', () => {
    const error = new Error('Network error');
    const onRetry = jest.fn();
    
    const result = ChatErrorHandler.handleError(error, { onRetry });
    expect(result.retryable).toBe(true);
    expect(result.action).toBeDefined();
    
    result.action?.();
    expect(onRetry).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// Test with React Testing Library
describe('Chat Interface Error Handling', () => {
  it('should display inline error for rate limits', async () => {
    const { getByText } = render(<ChatInterface {...props} />);
    
    // Trigger rate limit error
    mockUseChat.mockImplementation(() => ({
      ...defaultChatState,
      error: createRateLimitError(),
    }));
    
    await waitFor(() => {
      expect(getByText('Rate limit reached')).toBeInTheDocument();
      expect(getByText('Sign in to continue')).toBeInTheDocument();
    });
  });
});
```

## Browser Testing

### Cross-browser Testing Checklist

- [ ] Chrome/Edge (Chromium)
  - [ ] Toast notifications appear correctly
  - [ ] Inline errors display properly
  - [ ] Retry functionality works

- [ ] Firefox
  - [ ] Network error detection
  - [ ] Stream interruption handling

- [ ] Safari
  - [ ] WebSocket/SSE error handling
  - [ ] iOS Safari specific issues

### Mobile Testing

- [ ] Touch interactions with retry button
- [ ] Toast positioning on small screens
- [ ] Error message readability

## Performance Testing

### Error Recovery Performance

1. **Measure retry latency**:
   - Time from retry click to request sent
   - Should be < 100ms

2. **Memory leaks**:
   - Errors shouldn't accumulate in memory
   - Check with Chrome DevTools Memory Profiler

3. **Multiple errors**:
   - Rapid error triggering shouldn't crash UI
   - Error state should update correctly

## Production Monitoring

### Logging Strategy

```typescript
// In production, errors should be logged to monitoring service
ChatErrorHandler.handleError(error, {
  onError: (chatError) => {
    // Send to Sentry/LogRocket/etc
    captureException(error, {
      tags: {
        errorType: chatError.type,
        retryable: chatError.retryable,
        statusCode: chatError.statusCode,
      },
    });
  },
});
```

### Metrics to Track

1. **Error Rates**:
   - By type (rate limit, network, etc.)
   - By user segment (anonymous vs authenticated)
   - By time of day

2. **Recovery Success**:
   - Retry success rate
   - Time to recovery
   - User actions after error

3. **User Impact**:
   - Session abandonment after error
   - Error → Sign up conversion
   - Support tickets related to errors

## Testing Checklist

### Before Release

- [ ] All error types tested manually
- [ ] Error test panel removed from production build
- [ ] Console logs removed/productionized
- [ ] Error messages reviewed for clarity
- [ ] Accessibility tested (screen readers)
- [ ] Performance impact measured
- [ ] Mobile experience validated
- [ ] Analytics/monitoring configured

### Regression Testing

After any changes to error handling:

1. Test each error scenario
2. Verify retry functionality
3. Check error message content
4. Validate toast behavior
5. Ensure proper cleanup (no memory leaks)

## Troubleshooting

### Common Issues

1. **Errors not appearing**:
   - Check if error is being caught elsewhere
   - Verify error classification logic
   - Check console for uncaught errors

2. **Retry not working**:
   - Ensure retry callback is properly bound
   - Check if message state is preserved
   - Verify transport reconnection logic

3. **Multiple error toasts**:
   - Check for duplicate error handlers
   - Verify cleanup in useEffect hooks
   - Ensure single error emission

## Development Commands

```bash
# Run in development with error testing enabled
NEXT_PUBLIC_ENABLE_ERROR_TESTING=true pnpm dev

# Run specific error scenario tests
pnpm test:errors

# Check error handling in production build
pnpm build && pnpm start
```