# Feedback System Implementation

This document describes the feedback mechanism implemented similar to v0.dev's feedback system.

## Overview

The feedback system allows users to rate AI assistant responses with thumbs up/down buttons and optionally provide detailed feedback through a modal dialog.

## Features

### 1. Quick Feedback
- **Thumbs Up/Down**: Single click to quickly rate a response as positive or negative
- **Toggle Behavior**: Clicking the same rating again removes the feedback
- **Visual Feedback**: Selected ratings are highlighted with color (green for positive, red for negative)

### 2. Detailed Feedback
- **Double-click**: Double-clicking a feedback button opens a modal for detailed comments
- **Comment Field**: Users can provide specific feedback about what was good or what went wrong
- **Persistent Storage**: All feedback is stored in the Convex database

### 3. Feedback Analytics
- **Summary Component**: Shows aggregated feedback statistics for a conversation thread
- **Metrics**: Displays counts of positive/negative ratings and comments

## Technical Implementation

### Database Schema

```typescript
feedback: defineTable({
  messageId: v.id("messages"),
  userId: v.id("users"),
  threadId: v.id("threads"),
  rating: v.union(v.literal("positive"), v.literal("negative")),
  comment: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### Components

1. **FeedbackButtons** (`src/components/chat/FeedbackButtons.tsx`)
   - Renders thumbs up/down buttons
   - Handles quick feedback and modal triggers
   - Shows current feedback state

2. **FeedbackModal** (`src/components/chat/FeedbackModal.tsx`)
   - Modal dialog for detailed feedback
   - Different prompts for positive/negative feedback
   - Textarea for comments

3. **FeedbackSummary** (`src/components/chat/FeedbackSummary.tsx`)
   - Displays aggregated feedback statistics
   - Shows positive/negative counts and comment counts

### Backend Functions

1. **submitFeedback** - Creates or updates feedback for a message
2. **removeFeedback** - Removes user's feedback from a message
3. **getUserFeedbackForMessage** - Gets current user's feedback for a specific message
4. **getThreadFeedback** - Gets all feedback for a thread (for analytics)

## Usage

The feedback buttons automatically appear on all completed AI assistant messages. Users can:

1. **Quick Rate**: Click thumbs up/down for quick feedback
2. **Add Comment**: Double-click to open modal and add detailed feedback
3. **Change Rating**: Click a different rating to change feedback
4. **Remove Rating**: Click the same rating again to remove feedback

## Design Decisions

1. **Non-intrusive**: Feedback buttons are small and subtle, not disrupting the chat flow
2. **Optional Comments**: Users can provide quick feedback without being forced to write comments
3. **Toggle Behavior**: Similar to social media reactions, users can easily change or remove feedback
4. **User-specific**: Each user can only see and modify their own feedback
5. **Real-time Updates**: Feedback state updates immediately using Convex's reactive queries

## Future Enhancements

1. **Feedback Export**: Add ability to export feedback data for analysis
2. **Feedback Categories**: Add predefined categories for common issues
3. **Feedback Trends**: Show feedback trends over time
4. **Model Improvement**: Use feedback data to improve model selection or prompting
5. **Admin Dashboard**: Create an admin view to analyze all feedback across users
