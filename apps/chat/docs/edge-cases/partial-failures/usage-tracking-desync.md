# Usage Tracking Desync

## Description
Message successfully saves and streams, but usage tracking fails, causing billing/quota inconsistencies between frontend and backend.

## Code Analysis

Looking at the usage tracking implementation:

### Frontend Optimistic Update (existing-session-chat.tsx lines 115-142)
```typescript
// Optimistically update usage limits using immer
queryClient.setQueryData(usageQueryOptions.queryKey, (oldUsageData) => {
  return produce(oldUsageData, (draft) => {
    if (isPremium) {
      draft.usage.premiumMessages = (draft.usage.premiumMessages || 0) + 1;
      draft.remainingQuota.premiumMessages = Math.max(0, draft.remainingQuota.premiumMessages - 1);
    } else {
      draft.usage.nonPremiumMessages = (draft.usage.nonPremiumMessages || 0) + 1;
      draft.remainingQuota.nonPremiumMessages = Math.max(0, draft.remainingQuota.nonPremiumMessages - 1);
    }
  });
});
```

### Backend Usage Tracking (API route lines 675-686)
```typescript
onAgentComplete(event) {
  // Track message usage for authenticated users
  if (!isAnonymous) {
    trackMessageSent(selectedModelId)
      .then(() => {
        console.log(`[Billing] Usage tracked for user ${authenticatedUserId}`);
      })
      .catch((error) => {
        console.error(`[Billing] Failed to track usage for user ${authenticatedUserId}:`, error);
      });
  }
}
```

## The Gap: No Sync Between Frontend/Backend Usage

**Problem**: Frontend decrements quota optimistically, but backend usage tracking is async and can fail silently.

## Real Scenarios

### Scenario 1: Backend Usage Tracking Failure
```
Flow:
1. User sends premium message → frontend optimistically: premiumMessages += 1, quota -= 1
2. Message processes successfully → user gets response
3. Backend usage tracking fails (DB write error, billing service down)
4. Frontend shows: "4 messages remaining"
5. Backend thinks: "5 messages remaining" 
6. User tries to send 5th message → backend allows it (user gets extra message)
7. OR backend rejects it (user confused - frontend said they had quota)

Result: Billing inconsistency, user confusion
```

### Scenario 2: Model ID Mismatch
```
Flow:
1. User selects premium model → frontend tracks as premium usage
2. Backend fails to get premium model → falls back to free model
3. Backend tracks free usage, frontend tracks premium usage
4. User's premium quota decremented for free model usage

Result: User loses premium quota for free messages
```

### Scenario 3: Partial Transaction Failure
```
Flow:
1. Message saves successfully
2. Response generates successfully  
3. Usage tracking DB write fails (separate transaction)
4. Frontend cache invalid → shows wrong quota
5. Background sync doesn't catch this (it only syncs message data)

Result: Frontend quota permanently wrong until hard refresh
```

## Technical Root Causes

### 1. Split Tracking Responsibility
- **Frontend**: Optimistic quota tracking
- **Backend**: Actual billing tracking  
- **No reconciliation** between the two

### 2. Fire-and-Forget Backend Tracking
```typescript
// Backend tracking is async with no validation
trackMessageSent(selectedModelId)
  .catch((error) => {
    console.error(`[Billing] Failed to track usage`, error);
    // Error logged but no corrective action
  });
```

### 3. No Quota Validation Before Stream
Backend doesn't validate quota before starting expensive operations:
```typescript
// Missing: Check if user actually has quota before starting stream
await requireMessageAccess(selectedModelId); // This might not be accurate
```

## Solution Design

### 1. Reconciliation After Stream Complete
```typescript
// In existing-session-chat.tsx onNewAssistantMessage
onNewAssistantMessage={(assistantMessage) => {
  // ... existing cache updates
  
  // Reconcile usage with backend after stream completes
  setTimeout(async () => {
    try {
      const serverUsage = await trpc.usage.checkLimits.query({});
      const cachedUsage = queryClient.getQueryData(usageQueryOptions.queryKey);
      
      if (serverUsage && cachedUsage) {
        // Check for discrepancies
        const premiumDiff = Math.abs(
          serverUsage.usage.premiumMessages - cachedUsage.usage.premiumMessages
        );
        
        if (premiumDiff > 0) {
          console.warn('[Usage] Frontend/backend usage desync detected, correcting...');
          // Update cache to match server
          queryClient.setQueryData(usageQueryOptions.queryKey, serverUsage);
        }
      }
    } catch (error) {
      console.error('[Usage] Failed to reconcile usage:', error);
    }
  }, 1000); // Give backend time to process usage tracking
}}
```

### 2. Pre-Stream Quota Validation
```typescript
// In API route, before starting expensive operations
// Get REAL usage from database, not cached estimates
const currentUsage = await getCurrentUsageFromDB(authenticatedUserId);
const hasQuota = validateQuotaAvailable(currentUsage, selectedModelId);

if (!hasQuota) {
  return ApiErrors.usageLimitExceeded({ requestId, currentUsage });
}
```

### 3. Synchronous Usage Tracking
```typescript
// Make usage tracking part of the main transaction
await db.transaction(async (tx) => {
  // Save message
  await tx.insert(messages).values(messageData);
  
  // Track usage in same transaction
  await tx.update(userUsage)
    .set({ premiumMessages: sql`${userUsage.premiumMessages} + 1` })
    .where(eq(userUsage.userId, authenticatedUserId));
});
```

### 4. Usage Tracking Validation Hook
```typescript
// New hook to periodically validate usage consistency
export function useUsageConsistencyCheck(sessionId: string, isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const serverUsage = await trpc.usage.checkLimits.query({});
        const cachedUsage = queryClient.getQueryData(['usage']);
        
        if (serverUsage && cachedUsage) {
          const hasDiscrepancy = 
            serverUsage.usage.premiumMessages !== cachedUsage.usage.premiumMessages ||
            serverUsage.usage.nonPremiumMessages !== cachedUsage.usage.nonPremiumMessages;
            
          if (hasDiscrepancy) {
            // Sync with server version
            queryClient.setQueryData(['usage'], serverUsage);
            
            // Optional: Notify user of correction
            toast.info('Usage quota updated to match server records');
          }
        }
      } catch (error) {
        console.error('Usage consistency check failed:', error);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);
}
```

## Testing Scenarios

### Manual Testing
1. **Backend failure test**: Mock `trackMessageSent` to fail after message succeeds
2. **Network interruption test**: Send message → kill network → restore → check usage sync
3. **Model fallback test**: Request premium model → mock premium unavailable → verify usage tracking

### Automated Testing
```typescript
test('usage tracking reconciliation', async () => {
  const { queryClient } = render(<ChatInterface />);
  
  // Mock backend usage tracking failure
  mockTrackMessageSent.mockRejectedValueOnce(new Error('Billing service down'));
  
  // Send message successfully
  fireEvent.submit(messageInput, { text: 'test message' });
  
  await waitFor(() => {
    expect(screen.getByText('test message')).toBeInTheDocument();
  });
  
  // Verify reconciliation occurs
  await waitFor(() => {
    const cachedUsage = queryClient.getQueryData(['usage']);
    const expectedUsage = mockServerUsage;
    expect(cachedUsage).toEqual(expectedUsage);
  }, { timeout: 5000 });
});
```

## Implementation Priority: **MEDIUM**

This affects billing accuracy and user trust, but failures are often temporary and resolve on page refresh. However, in a production billing system, accuracy is critical.