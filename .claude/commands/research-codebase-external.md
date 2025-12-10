---
description: Deep dive into specific topics from external codebase analysis
model: opus
---

# External Codebase Research

You are tasked with conducting deep research into a specific topic from a previously analyzed external codebase by spawning parallel sub-agents and synthesizing their findings.

## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE EXTERNAL CODEBASE AS IT EXISTS

- DO NOT suggest improvements or changes to the external codebase
- DO NOT critique architectural decisions or code quality
- DO NOT compare to "better" approaches or alternatives
- DO NOT evaluate if decisions were "good" or "bad"
- ONLY extract, document, and explain the implementation as it exists
- You are an investigative journalist, not a critic

## Topic: $ARGUMENTS

## Steps to follow:

### Step 1: Locate the analysis and repository

1. **Find the analysis file:**
   - Look in `.claude/research/` for analysis files (e.g., `hmlr-analysis.md`)
   - Read the analysis file FULLY to understand:
     - The source repository URL
     - What the analysis already discovered about "$ARGUMENTS"
     - Related components and files mentioned

2. **Verify the cloned repository:**
   - Check if repo exists at `/tmp/repos/<repo-name>`
   - If not found, inform the user to run `github-codebase-researcher` first
   - Use `ls` to confirm the directory structure

### Step 2: Create research plan

Use TodoWrite to create a research plan. Break down "$ARGUMENTS" into:
- File locations to find
- Implementation details to analyze
- Patterns to extract
- Integration points to trace

### Step 3: Spawn parallel sub-agents for comprehensive research

Launch multiple Task agents concurrently, each focused on a specific aspect.

**CRITICAL**: All agents work on the EXTERNAL repo at `/tmp/repos/<repo-name>`, NOT the local Lightfast codebase.

**Agent 1: codebase-locator**
```
Research topic: "$ARGUMENTS"
Repository path: /tmp/repos/<repo-name>

Find ALL files related to "$ARGUMENTS" in this external repository.
Search for:
- Main implementation files
- Test files
- Configuration files
- Documentation
- Type definitions
- Related/dependent modules

Return organized list of file paths grouped by purpose.
```

**Agent 2: codebase-analyzer**
```
Research topic: "$ARGUMENTS"
Repository path: /tmp/repos/<repo-name>

Analyze HOW "$ARGUMENTS" works in this external repository.
Focus on:
- Core implementation logic
- Data structures and models
- Key functions and their purposes
- Data flow (entry → processing → output)
- Error handling approach
- Configuration options

Include file:line references for all claims.
DO NOT critique or suggest improvements.
```

**Agent 3: codebase-pattern-finder**
```
Research topic: "$ARGUMENTS"
Repository path: /tmp/repos/<repo-name>

Find implementation PATTERNS used in "$ARGUMENTS" in this external repository.
Extract:
- Design patterns in use
- Code organization patterns
- Integration patterns with other modules
- Testing patterns
- Configuration patterns

Show actual code snippets with file:line references.
DO NOT evaluate or compare patterns.
```

### Step 4: Wait and synthesize findings

**IMPORTANT**: Wait for ALL sub-agents to complete before proceeding.

Compile findings into a comprehensive analysis:

```
## Deep Dive: [Topic Name]

### Context
[Reference to original analysis file and what it said about this topic]

### Overview
[2-3 sentences: what this component does and its role in the system]

### File Locations
| File | Purpose | Lines |
|------|---------|-------|
| `path/to/main.py` | Core implementation | ~400 |
| `path/to/models.py` | Data structures | ~150 |
| `path/to/tests/` | Test suite | ~300 |

### Architecture

#### Data Structures
```language
// Key types/classes from the codebase
// file.py:50-75
```

#### Core Functions
| Function | Location | Purpose |
|----------|----------|---------|
| `function_name()` | `file.py:100` | What it does |
| `another_func()` | `file.py:200` | What it does |

#### Data Flow
```
Input → [Step 1] → [Step 2] → [Step 3] → Output
              ↓
        Side Effects
```

### Implementation Details

#### [Subsection 1]
[Detailed explanation with code snippets]

```language
// Actual code from file.py:100-150
```

#### [Subsection 2]
[More details...]

### Integration Points
- **Called by**: `module.py:function()` - context
- **Depends on**: `other_module.py` - what it provides
- **Triggers**: Side effects or downstream processes

### Patterns Extracted

#### Pattern 1: [Name]
**Found in**: `file.py:100-200`
**What it does**: [Description]
```language
// Code showing the pattern
```

#### Pattern 2: [Name]
...

### Testing Approach
- Test file: `tests/test_topic.py`
- Key test cases and what they verify

### Configuration
- `CONFIG_KEY`: What it controls (default: value)

### Dependencies
- **Internal**: Other modules in the repo
- **External**: Third-party libraries used

### Key Takeaways
[Bullet points of the most important things learned about this topic]
```

### Step 5: Update todo list and present findings

- Mark all research tasks as completed
- Present the synthesized analysis to the user
- Ask if they want to dive deeper into any sub-component

## Important notes:

- **Parallel execution**: Always spawn all 3 agents in a SINGLE message with multiple Task tool calls
- **Path context**: Every agent prompt MUST specify the `/tmp/repos/<repo-name>` path
- **Wait for completion**: Do NOT synthesize until ALL agents return
- **File references**: Include `file:line` for every claim
- **Code snippets**: Show actual code, not descriptions
- **No evaluation**: Document what exists without judgment
- **Focus**: Stay focused on "$ARGUMENTS" - don't document the entire codebase
- **Sub-components**: If the topic has parts (e.g., fact-scrubber has extraction + storage), cover each
