# Chat Conversation Sharing Methods

This document explores various methods to implement conversation sharing in our Convex-based chat application.

## Overview
Our chat application uses Convex for real-time data synchronization with the following structure:
- **Threads**: Contain conversation metadata and usage statistics
- **Messages**: Individual messages within threads with user/assistant roles
- **Authentication**: User-based access control via @convex-dev/auth

## Sharing Methods

### 1. Public Link Sharing
**Description**: Generate a unique, shareable URL for each conversation.

**Implementation Approach**:
```typescript
// Add to schema.ts
shares: defineTable({
  threadId: v.id("threads"),
  shareId: v.string(), // UUID or short code
  createdBy: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
  accessCount: v.number(),
  isPublic: v.boolean(),
  settings: v.optional(v.object({
    allowComments: v.boolean(),
    requirePassword: v.boolean(),
    passwordHash: v.optional(v.string()),
  })),
}).index("by_shareId", ["shareId"])
.index("by_thread", ["threadId"])
```

**Features**:
- Unique shareable links (e.g., `https://app.com/share/abc123`)
- Optional expiration dates
- View count tracking
- Optional password protection
- Read-only access by default

**Security Considerations**:
- Use cryptographically secure random IDs
- Rate limit share creation
- Allow revoking shares
- Track access logs

### 2. User-to-User Sharing
**Description**: Share conversations directly with specific users within the platform.

**Implementation Approach**:
```typescript
// Add to schema.ts
sharedThreads: defineTable({
  threadId: v.id("threads"),
  sharedBy: v.id("users"),
  sharedWith: v.id("users"),
  sharedAt: v.number(),
  permissions: v.object({
    canRead: v.boolean(),
    canComment: v.boolean(),
    canContinue: v.boolean(), // Continue the conversation
  }),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("rejected")
  ),
}).index("by_recipient", ["sharedWith"])
.index("by_thread", ["threadId"])
```

**Features**:
- Share with specific users by email/username
- Granular permissions (read, comment, continue)
- Accept/reject mechanism
- Notification system for shares

### 3. Export Formats
**Description**: Export conversations in various formats for external sharing.

**Supported Formats**:
1. **Markdown**
   ```markdown
   # Conversation: [Title]
   Date: [Date]
   Participants: User, Assistant

   ## User
   [Message content]

   ## Assistant (GPT-4)
   [Response content]
   ```

2. **JSON**
   ```json
   {
     "title": "Conversation Title",
     "date": "2024-01-01",
     "messages": [
       {
         "role": "user",
         "content": "...",
         "timestamp": "..."
       }
     ]
   }
   ```

3. **PDF** (using React PDF or similar)
4. **Plain Text**
5. **HTML** (styled conversation view)

### 4. Collaborative Sharing
**Description**: Allow multiple users to participate in the same conversation thread.

**Implementation Approach**:
```typescript
// Add to schema.ts
threadParticipants: defineTable({
  threadId: v.id("threads"),
  userId: v.id("users"),
  role: v.union(
    v.literal("owner"),
    v.literal("collaborator"),
    v.literal("viewer")
  ),
  joinedAt: v.number(),
  lastViewedAt: v.optional(v.number()),
  canEdit: v.boolean(),
  canDelete: v.boolean(),
}).index("by_thread", ["threadId"])
.index("by_user", ["userId"])
```

**Features**:
- Real-time collaborative chat
- Role-based permissions
- Presence indicators
- Typing indicators
- Message attribution

### 5. Embed Sharing
**Description**: Generate embeddable widgets for websites/blogs.

**Implementation**:
```html
<!-- Embed code -->
<iframe
  src="https://app.com/embed/share/abc123"
  width="600"
  height="400"
  frameborder="0">
</iframe>
```

**Features**:
- Customizable themes
- Responsive design
- Minimal UI for embedding
- CORS configuration for security

### 6. Social Media Sharing
**Description**: Share conversation snippets or summaries on social platforms.

**Implementation Options**:
1. **Screenshot Generation**: Use Puppeteer/Playwright to generate images
2. **Open Graph Tags**: Rich previews when sharing links
3. **Twitter Cards**: Formatted previews for Twitter
4. **Share Buttons**: Quick share to various platforms

### 7. API-Based Sharing
**Description**: Programmatic access to shared conversations.

**Implementation**:
```typescript
// API endpoints
GET /api/shares/:shareId
POST /api/threads/:threadId/share
DELETE /api/shares/:shareId
```

**Features**:
- RESTful API endpoints
- API key authentication
- Rate limiting
- Webhook support for integrations

## Implementation Recommendations

### Phase 1: Basic Public Link Sharing
1. Implement share link generation
2. Create public share view page
3. Add share button to chat interface
4. Implement share management (list, revoke)

### Phase 2: Enhanced Security & Features
1. Add password protection
2. Implement expiration dates
3. Add view analytics
4. Create share settings modal

### Phase 3: Export & Advanced Sharing
1. Implement export formats (Markdown, JSON, PDF)
2. Add user-to-user sharing
3. Create notification system
4. Build share acceptance flow

### Phase 4: Collaboration & Integration
1. Implement collaborative features
2. Add embed functionality
3. Create API endpoints
4. Build social media integration

## Security Best Practices

1. **Authentication & Authorization**
   - Verify user owns thread before sharing
   - Implement proper access control for shared content
   - Use secure session management

2. **Data Privacy**
   - Allow users to redact sensitive information
   - Implement data retention policies
   - Provide clear privacy settings

3. **Rate Limiting**
   - Limit share creation per user
   - Implement viewing rate limits
   - Prevent abuse through monitoring

4. **Encryption**
   - Use HTTPS for all share links
   - Consider end-to-end encryption for sensitive shares
   - Encrypt passwords if password protection is used

5. **Audit Trail**
   - Log all share actions
   - Track access patterns
   - Provide activity history to users

## UI/UX Considerations

1. **Share Button Placement**
   - Add to chat header
   - Include in message context menu
   - Add to thread list actions

2. **Share Modal Design**
   - Clear privacy indicators
   - Easy-to-copy link field
   - Quick access to settings
   - Preview of what will be shared

3. **Shared View Experience**
   - Clean, read-only interface
   - Clear indication of shared status
   - Easy way to start own conversation
   - Mobile-responsive design

## Technical Architecture

```typescript
// Example Convex mutation for creating a share
export const createShare = mutation({
  args: {
    threadId: v.id("threads"),
    settings: v.object({
      expiresIn: v.optional(v.number()), // hours
      requirePassword: v.optional(v.boolean()),
      password: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Verify user owns thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== ctx.userId) {
      throw new Error("Unauthorized");
    }

    // Generate unique share ID
    const shareId = generateShareId();

    // Create share record
    await ctx.db.insert("shares", {
      threadId: args.threadId,
      shareId,
      createdBy: ctx.userId,
      createdAt: Date.now(),
      expiresAt: args.settings.expiresIn
        ? Date.now() + (args.settings.expiresIn * 3600000)
        : undefined,
      accessCount: 0,
      isPublic: true,
      settings: {
        requirePassword: args.settings.requirePassword || false,
        passwordHash: args.settings.password
          ? await hashPassword(args.settings.password)
          : undefined,
      },
    });

    return { shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${shareId}` };
  },
});
```

## Monitoring & Analytics

1. **Share Metrics**
   - Total shares created
   - Share view counts
   - Popular sharing methods
   - Share-to-engagement ratio

2. **User Behavior**
   - Most shared conversation types
   - Sharing patterns
   - Feature adoption rates

3. **Performance Metrics**
   - Share generation time
   - Page load performance
   - API response times

## Future Enhancements

1. **AI-Powered Features**
   - Auto-summarization before sharing
   - Sensitive content detection
   - Suggested redactions

2. **Advanced Collaboration**
   - Branching conversations
   - Version history
   - Merge conversations

3. **Integration Ecosystem**
   - Slack/Discord bots
   - Browser extensions
   - Mobile app sharing

4. **Monetization Options**
   - Premium sharing features
   - Analytics dashboards
   - Custom branding for shares
