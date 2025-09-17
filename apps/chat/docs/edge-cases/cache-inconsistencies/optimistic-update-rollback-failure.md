# Optimistic Update Rollback Failure

## Status: PARTIALLY SOLVED ✅❌

**SOLVED**: Quota rollback (prevents revenue loss)
**REMAINING**: Message rollback (UX inconsistency)

## Description
Optimistic update succeeds, but when the actual API call fails, the rollback mechanism fails or is incomplete, leaving cache in an inconsistent state.

## Current Implementation Analysis

Looking at `existing-session-chat.tsx` lines 96-143, the optimistic update pattern:

```typescript
// Optimistically append user message
queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
  // ... add message optimistically
});

// Optimistically update usage limits  
queryClient.setQueryData(usageQueryOptions.queryKey, (oldUsageData) => {
  // ... update usage with immer
});

// Send actual API request
await vercelSendMessage(userMessage, { /* ... */ });
```

## The Gap: No Rollback on Failure

**Problem**: If `vercelSendMessage` fails, the optimistic updates remain in cache permanently.

**Current Error Handling** (chat-interface.tsx lines 359-363):
```typescript
} catch (error) {
  // Log and throw to error boundary
  ChatErrorHandler.handleError(error);
  throwToErrorBoundary(error);
}
```

This throws to error boundary but **NEVER rolls back the optimistic updates**.

## Real Scenarios

### Scenario 1: API Timeout After Optimistic Update
```
Flow:
1. User sends message → optimistic cache update (message + usage)
2. API call times out after 30 seconds
3. Error boundary triggers → user sees error page
4. User clicks "retry" → comes back to chat
5. Cache still shows the failed message + incorrect usage counts

Result: User sees "ghost message" that was never actually sent
```

### Scenario 2: Rate Limit Hit After Usage Update
```
Flow:
1. User near limit → sends message → usage optimistically decremented  
2. Server checks actual usage → over limit → returns 429
3. Error boundary shows rate limit error
4. User upgrades account → returns to chat
5. Usage counts wrong due to failed optimistic update

Result: Billing/usage limits corrupted in frontend
```

### Scenario 3: Network Failure During Send
```
Flow:
1. User sends message → optimistic updates applied
2. Network fails → API call never reaches server  
3. User sees error → refreshes page
4. tRPC cache persists → optimistic message still shown
5. User thinks message was sent, continues conversation

Result: Conversation context completely wrong
```

## Detection Patterns

### Cache Validation on Resume
```typescript
// Check if messages in cache exist in DB
const validateCacheConsistency = async () => {
  const cachedMessages = queryClient.getQueryData(messagesQueryOptions.queryKey);
  const dbMessages = await trpc.message.list.query({ sessionId });
  
  const orphanedMessages = cachedMessages.filter(cached => 
    !dbMessages.find(db => db.id === cached.id)
  );
  
  if (orphanedMessages.length > 0) {
    // Found ghost messages in cache
    return { hasInconsistency: true, orphanedMessages };
  }
};
```

### Usage Reconciliation
```typescript
// Validate usage counts match server
const validateUsageConsistency = async () => {
  const cachedUsage = queryClient.getQueryData(usageQueryOptions.queryKey);
  const serverUsage = await trpc.usage.checkLimits.query({});
  
  if (cachedUsage.usage.nonPremiumMessages !== serverUsage.usage.nonPremiumMessages) {
    return { hasUsageInconsistency: true, serverUsage };
  }
};
```

## What We Solved: Quota Rollback ✅

### Implemented Solution
We implemented a **hybrid optimistic + rollback approach** for quota management:

```typescript
// In existing-session-chat.tsx - IMPLEMENTED
onQuotaError={(modelId) => {
  // Rollback optimistic quota update when server rejects
  queryClient.setQueryData(usageQueryOptions.queryKey, (oldUsageData) => {
    if (!oldUsageData) return oldUsageData;
    
    const messageType = getMessageType(modelId);
    const isPremium = messageType === MessageType.PREMIUM;
    
    // Rollback: increment quota back
    return produce(oldUsageData, (draft) => {
      if (isPremium) {
        draft.remainingQuota.premiumMessages += 1;
      } else {
        draft.remainingQuota.nonPremiumMessages += 1;
      }
    });
  });
}}
```

**Why this works:**
- ✅ Prevents spam clicking when user hits quota limit
- ✅ Automatically rolls back quota when server rejects
- ✅ Maintains billing integrity with atomic quota reservation system
- ✅ Provides immediate UI feedback

## What Still Needs Solving: Message Rollback ❌

### Current Gap
If the API fails for non-quota reasons (network error, server error, authentication), the user message remains in cache but never gets processed:

1. User sends message → optimistically added to chat
2. API call fails (network/server error) → error boundary triggered
3. User message stays in cache forever (no rollback)
4. On page refresh → message disappears (inconsistent state)

### Solution Design for Remaining Issue

#### 1. Message Rollback on API Failure
```typescript
// Enhanced error handling needed in chat-interface.tsx
try {
  // Store rollback data before optimistic update
  const previousMessages = queryClient.getQueryData(messagesQueryOptions.queryKey);
  
  // Apply optimistic updates
  onNewUserMessage?.(userMessage);
  
  // Attempt API call
  await vercelSendMessage(userMessage, { /* ... */ });
  
} catch (error) {
  console.error('[Chat] API call failed, rolling back message');
  
  // Rollback message from cache
  queryClient.setQueryData(messagesQueryOptions.queryKey, previousMessages);
  
  // Then handle error
  ChatErrorHandler.handleError(error);
  throwToErrorBoundary(error);
}
```

### 2. Background Consistency Validation
```typescript
// In existing-session-chat.tsx, add periodic validation
useEffect(() => {
  if (status === "ready" && !isNewSession) {
    // Validate cache consistency after operations complete
    const validateConsistency = async () => {
      const validation = await validateCacheConsistency();
      if (validation.hasInconsistency) {
        console.warn('[Cache] Inconsistency detected, reconciling...');
        // Force refresh from server
        await queryClient.invalidateQueries({ queryKey: messagesQueryOptions.queryKey });
      }
    };
    
    validateConsistency().catch(console.error);
  }
}, [status, messages.length]);
```

### 3. Optimistic Update State Tracking
```typescript
// Track which updates are pending confirmation
const [pendingOptimisticUpdates, setPendingOptimisticUpdates] = useState(new Set());

const handleSendMessage = async (message: string) => {
  const updateId = crypto.randomUUID();
  
  try {
    // Mark update as pending
    setPendingOptimisticUpdates(prev => prev.add(updateId));
    
    // Apply optimistic updates with tracking
    onNewUserMessage?.(userMessage);
    
    // API call
    await vercelSendMessage(userMessage, { /* ... */ });
    
    // Success - mark as confirmed
    setPendingOptimisticUpdates(prev => {
      const newSet = new Set(prev);
      newSet.delete(updateId);
      return newSet;
    });
    
  } catch (error) {
    // Failure - rollback and remove tracking
    rollbackOptimisticUpdate(updateId);
    setPendingOptimisticUpdates(prev => {
      const newSet = new Set(prev);
      newSet.delete(updateId);
      return newSet;
    });
    
    throw error;
  }
};
```

## Testing Scenarios

### Manual Testing
1. **Network timeout test**: Send message → block network → wait for timeout
2. **Rate limit test**: Hit rate limit after optimistic update  
3. **Server error test**: Mock 500 error after optimistic update

### Automated Testing
```typescript
test('rollback on API failure', async () => {
  const { queryClient } = render(<ChatInterface />);
  
  // Get initial state
  const initialMessages = queryClient.getQueryData(['messages', sessionId]);
  const initialUsage = queryClient.getQueryData(['usage']);
  
  // Mock API failure
  mockApiEndpoint.mockRejectedValueOnce(new Error('Server error'));
  
  fireEvent.submit(messageInput, { text: 'test message' });
  
  await waitFor(() => {
    // Verify rollback occurred
    expect(queryClient.getQueryData(['messages', sessionId])).toEqual(initialMessages);
    expect(queryClient.getQueryData(['usage'])).toEqual(initialUsage);
  });
});
```

## Implementation Priority: **LOW** 

**Reasoning for LOW priority:**
- ✅ **Critical issue solved**: Quota rollback prevents revenue loss (was HIGH priority)
- ❌ **Remaining issue is UX-only**: Message rollback affects user experience but not billing
- 🔄 **Current workaround exists**: Error boundaries handle failures gracefully  
- 📊 **Low frequency**: API failures that trigger this are relatively rare
- 🚀 **Higher priorities exist**: Other features provide more user value

**When to prioritize:**
- If user reports indicate confusion about disappeared messages
- If error rates increase significantly  
- After other HIGH/MEDIUM priority features are complete