# OpenCode Tool Catalog

## Overview
OpenCode provides a comprehensive set of tools for AI-assisted development. These tools are organized into categories and have provider-specific availability.

## Complete Tool List

### 1. File System Operations

#### **read** - File Reading
- **ID**: `read`
- **Description**: Reads a file from the local filesystem. You can access any file directly by using this tool.
- **Parameters**:
  - `filePath`: The path to the file to read
  - `offset`: The line number to start reading from (0-based) [optional]
  - `limit`: The number of lines to read (defaults to 2000) [optional]
- **Features**:
  - Line number formatting
  - Image file detection and blocking
  - Helpful suggestions for typos
  - File access tracking per session
  - Preview metadata for UI

#### **write** - File Writing  
- **ID**: `write`
- **Description**: Writes a file to the local filesystem.
- **Parameters**:
  - `filePath`: The path to the file to write
  - `content`: The content to write to the file
- **Features**:
  - Safety checks before overwriting
  - Directory creation if needed
  - File access tracking
  - Statistics in response (lines, size)

#### **edit** - String Replacement
- **ID**: `edit` 
- **Description**: Performs exact string replacements in files.
- **Parameters**:
  - `filePath`: The path to the file to modify
  - `oldString`: The text to replace
  - `newString`: The text to replace it with
  - `replaceAll`: Replace all occurrences [optional]
- **Features**:
  - Exact string matching
  - Safety validation
  - File backup on changes

#### **multiedit** - Batch Edits (Currently Disabled)
- **ID**: `multiedit`
- **Description**: Makes multiple edits to a single file in one operation
- **Status**: Commented out in current implementation
- **Purpose**: Efficient batch editing with atomic operations

### 2. File System Navigation

#### **list** - Directory Listing
- **ID**: `list` (implementation: `ls`)
- **Description**: Lists files and directories in a given path
- **Parameters**:
  - `path`: The absolute path to the directory to list
  - `ignore`: List of glob patterns to ignore [optional]
- **Features**:
  - Absolute path requirement
  - Glob pattern filtering
  - File type identification

#### **glob** - Pattern Matching
- **ID**: `glob`
- **Description**: Fast file pattern matching tool that works with any codebase size
- **Parameters**:
  - `pattern`: The glob pattern to match files against
  - `path`: The directory to search in [optional]
- **Features**:
  - Supports complex glob patterns (`**/*.js`, `src/**/*.ts`)
  - Performance optimized for large codebases
  - Returns matching file paths

### 3. Search and Analysis

#### **grep** - Content Search
- **ID**: `grep`
- **Description**: Fast content search tool using regular expressions
- **Parameters**:
  - `pattern`: The regular expression pattern to search for
  - `path`: File or directory to search in [optional]
  - `glob`: Glob pattern to filter files [optional]
  - `type`: File type to search [optional]
  - `outputMode`: Output format (content/files/count) [optional]
  - Various flags for case sensitivity, line numbers, context
- **Features**:
  - Full regex support
  - File type filtering
  - Context lines (before/after)
  - Multiple output modes

### 4. Command Execution

#### **bash** - Shell Commands
- **ID**: `bash`
- **Description**: Executes bash commands in a persistent shell session
- **Parameters**:
  - `command`: The command to execute
  - `timeout`: Optional timeout in milliseconds
- **Features**:
  - Persistent shell session
  - Timeout support
  - Security measures
  - Output capture
  - Error handling

### 5. Web Operations

#### **webfetch** - URL Content Fetching
- **ID**: `webfetch`
- **Description**: Fetches content from a specified URL
- **Parameters**:
  - `url`: The URL to fetch content from
  - `prompt`: The prompt to run on the fetched content
- **Features**:
  - HTML to markdown conversion
  - Content processing with AI
  - Caching support
  - Redirect handling

### 6. Task Management

#### **todowrite** - Todo List Management
- **ID**: `todowrite`
- **Description**: Creates and manages a structured task list for coding sessions
- **Parameters**:
  - `todos`: Array of todo items with content, status, priority, and ID
- **Features**:
  - Session-scoped storage
  - Status tracking (pending, in_progress, completed, cancelled)
  - Priority levels (high, medium, low)
  - Progress reporting

#### **todoread** - Todo List Reading
- **ID**: `todoread`
- **Description**: Reads the current todo list for the session
- **Parameters**: None
- **Features**:
  - Session-scoped retrieval
  - Progress summary
  - JSON formatted output

### 7. Agent Orchestration

#### **task** - Sub-Agent Execution
- **ID**: `task`
- **Description**: Launches a new agent with access to a subset of tools
- **Parameters**:
  - `description`: Short description of the task (3-5 words)
  - `prompt`: The task for the agent to perform
- **Features**:
  - Creates child sessions
  - Inherits model and provider settings
  - Hierarchical session management
  - Tool subset access

### 8. Development Tools (Currently Disabled)

#### **patch** - Git Patch Application
- **ID**: `patch`
- **Description**: Applies git patches to files
- **Status**: Disabled for Anthropic provider
- **Reason**: Marked as "do not use" for safety

#### **lsp_diagnostics** - LSP Diagnostics
- **ID**: `lsp_diagnostics`
- **Description**: Language Server Protocol diagnostics
- **Status**: Commented out
- **Reason**: Currently disabled

#### **lsp_hover** - LSP Hover Information
- **ID**: `lsp_hover`
- **Description**: Language Server Protocol hover information
- **Status**: Commented out
- **Reason**: Currently disabled

## Provider-Specific Tool Availability

### Anthropic Provider
```typescript
TOOLS.filter((t) => t.id !== "patch")
```
- **Available**: All tools except `patch`
- **Total**: 11 tools
- **Excluded**: `patch` (safety reasons)

### OpenAI Provider
```typescript
TOOLS.map((t) => ({ ...t, parameters: optionalToNullable(t.parameters) }))
```
- **Available**: All tools with parameter schema conversion
- **Total**: 12 tools
- **Modification**: Optional parameters converted to nullable

### Google Provider
```typescript
TOOLS.map((t) => ({ ...t, parameters: sanitizeGeminiParameters(t.parameters) }))
```
- **Available**: All tools with Gemini-compatible parameter schemas
- **Total**: 12 tools
- **Modification**: Parameter sanitization for Gemini compatibility

### Azure Provider
```typescript
TOOLS.map((t) => ({ ...t, parameters: optionalToNullable(t.parameters) }))
```
- **Available**: All tools with parameter schema conversion
- **Total**: 12 tools
- **Modification**: Same as OpenAI provider

## Tool Architecture Patterns

### 1. Context Injection
Every tool receives:
```typescript
{
  sessionID: string,
  messageID: string,
  abort: AbortSignal,
  metadata: (update) => void
}
```

### 2. Session-Scoped State
Tools can maintain per-session state:
```typescript
const state = App.state("tool-name", () => {
  const data: { [sessionId: string]: any } = {}
  return data
})
```

### 3. File Access Tracking
File operations are tracked per session:
```typescript
FileTime.read(ctx.sessionID, filePath)
FileTime.assert(ctx.sessionID, filePath)
```

### 4. Metadata for UI
Tools return rich metadata for UI rendering:
```typescript
return {
  title: "Operation name",
  output: "Result text",
  metadata: {
    preview: "...",
    statistics: {...}
  }
}
```

## Comparison with hal9000 Tools

### Similar Tools
| OpenCode | hal9000 | Notes |
|----------|---------|-------|
| `read` | `Read` | Similar functionality |
| `write` | `Write` | Similar functionality |
| `edit` | `Edit` | Similar functionality |
| `bash` | `Bash` | Similar functionality |
| `glob` | `Glob` | Similar functionality |
| `grep` | `Grep` | Similar functionality |
| `webfetch` | `WebFetch` | Similar functionality |
| `todowrite/todoread` | `TodoWrite` | hal9000 has single tool |

### hal9000 Unique Tools
- `MultiEdit` - Batch editing (OpenCode has it disabled)
- `NotebookRead/NotebookEdit` - Jupyter notebook support
- `WebSearch` - Web search functionality
- Various specialized tools for math, browser automation, etc.

### OpenCode Unique Tools
- `task` - Sub-agent execution
- `patch` - Git patch application (disabled)
- LSP tools (disabled)
- More sophisticated file access tracking

## Key Takeaways for hal9000

1. **Context Awareness**: OpenCode tools are highly context-aware with session/message tracking
2. **Safety Features**: File access tracking and validation before overwriting
3. **Rich Metadata**: Tools return detailed metadata for better UI experience
4. **Provider Adaptation**: Schema adaptation for different AI providers
5. **Hierarchical Execution**: Task tool enables complex agent orchestration
6. **Session Isolation**: Per-session state management prevents cross-contamination