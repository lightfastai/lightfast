# Simple Chat Sharing - Setup Instructions

## What We've Implemented

A simple read-only sharing feature that allows users to share their chat conversations via unique links.

### Features:
- ✅ Generate shareable links for conversations
- ✅ Read-only view for shared conversations
- ✅ Clean, minimal UI
- ✅ No authentication required for viewing shared chats
- ✅ Share button in the chat header

## Setup Instructions

### 1. Install Required Dependencies

```bash
# No additional dependencies needed!
```

### 2. Run Convex Dev to Generate Types

Since we've added new Convex functions, you need to regenerate the types:

```bash
# In one terminal:
pnpm convex:dev

# This will:
# - Push the new schema (shares table) to Convex
# - Generate TypeScript types for the new API functions
# - Remove the TypeScript errors we temporarily ignored
```

### 3. Test the Feature

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Navigate to an existing chat conversation (not the new chat page)

3. Click the "Share" button in the header

4. Copy the generated link

5. Open the link in an incognito/private browser window to test the read-only view

## What Was Added

### New Files:
- `convex/shares.ts` - Backend functions for creating and retrieving shares
- `src/components/chat/ShareButton.tsx` - Share button component
- `src/app/share/[shareId]/page.tsx` - Public share view page

### Modified Files:
- `convex/schema.ts` - Added `shares` table
- `src/components/chat/ChatLayout.tsx` - Added ShareButton to header

## How It Works

1. **Creating a Share**: When you click the share button, it creates a record in the `shares` table with a unique ID
2. **Share Links**: Links follow the pattern: `https://yourapp.com/share/[uniqueId]`
3. **Viewing Shares**: Anyone with the link can view the conversation (no authentication required)
4. **Security**: Only the conversation owner can create shares

## Next Steps (Optional Enhancements)

1. **Add Expiration**: Add time-based expiration to shares
2. **Add Password Protection**: Allow optional password protection
3. **Share Management**: Create a page to view/revoke all your shares
4. **Analytics**: Track view counts for shares
5. **Export Options**: Add download as PDF/Markdown

## Troubleshooting

### TypeScript Errors
If you see TypeScript errors about `api.shares` not existing:
1. Make sure Convex is running: `pnpm convex:dev`
2. Wait a few seconds for types to regenerate
3. Restart your TypeScript server in VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### Share Button Not Appearing
The share button only appears when viewing an existing conversation, not on the new chat page.

### Share Links Not Working
1. Check that the shares table was created in Convex dashboard
2. Verify the share was created by checking the Convex data browser
3. Make sure your app URL is correct in the ShareButton component

## Security Considerations

1. **Public Access**: Shared links are public - anyone with the link can view
2. **No Expiration**: Shares don't expire by default
3. **No Revocation**: Currently no way to revoke shares (can be added)
4. **Data Privacy**: Consider what sensitive information might be in conversations before sharing

## Production Checklist

Before deploying to production:
- [ ] Update the share URL in ShareButton to use an environment variable
- [ ] Add rate limiting to prevent share spam
- [ ] Consider adding share analytics
- [ ] Add terms of service notice on shared pages
- [ ] Implement share revocation functionality
