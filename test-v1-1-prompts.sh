#!/bin/bash

# Test script for v1.1 agent with various prompts
# Note: You need to set OPENROUTER_API_KEY before running this script

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "Error: OPENROUTER_API_KEY is not set"
    echo "Please export OPENROUTER_API_KEY=your-api-key before running this script"
    exit 1
fi

echo "Testing v1.1 Agent with various prompts..."
echo "========================================="

# Function to test a prompt
test_prompt() {
    local prompt="$1"
    local thread_id="$2"
    local description="$3"
    
    echo ""
    echo "Test: $description"
    echo "Prompt: $prompt"
    echo "Thread ID: $thread_id"
    echo "---"
    
    # Make the API call with a timeout
    timeout 30 curl -s -X POST http://localhost:4111/api/agents/V1_1Agent/stream \
        -H "Content-Type: application/json" \
        -d "{
            \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}],
            \"threadId\": \"$thread_id\",
            \"resourceId\": \"V1_1Agent\",
            \"stream\": true
        }" 2>/dev/null | grep -E "^0:" | sed 's/^0://' | tr -d '"' | head -50
    
    echo ""
    echo "========================================="
}

# Test 1: Simple file creation
test_prompt "create a hello world markdown file" \
    "test-hello-world" \
    "Simple file creation task"

# Test 2: Web search
test_prompt "search for JavaScript async await best practices" \
    "test-js-async" \
    "Web search for JavaScript concepts"

# Test 3: Multi-step research
test_prompt "research React hooks and create a summary guide" \
    "test-react-hooks" \
    "Multi-step research and documentation"

# Test 4: Browser navigation
test_prompt "navigate to https://example.com and extract the main heading" \
    "test-browser-nav" \
    "Browser navigation and extraction"

# Test 5: Complex workflow
test_prompt "find TypeScript interface documentation, extract examples, and create a guide file" \
    "test-ts-interfaces" \
    "Complex multi-tool workflow"

echo ""
echo "All tests completed!"