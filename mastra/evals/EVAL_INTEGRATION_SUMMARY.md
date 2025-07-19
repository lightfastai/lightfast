# Mastra Evals Integration Summary for V1 Agent

## Key Findings

### 1. Evals Are Not Auto-Executed
- **Discovery**: Mastra evals configured on agents via the `evals` property are NOT automatically executed during `generate()` or `stream()` calls
- **Current Behavior**: Evals are stored on the agent but require manual execution
- **No evalResults in Response**: The response object does not include eval results by default

### 2. Manual Evaluation Required
To use Mastra evals, you must:
1. Configure metrics on the agent (optional, for documentation)
2. Get response from `agent.generate()`
3. Extract the text from the response structure
4. Manually call `metric.measure(input, output)` for each metric
5. Handle results separately

### 3. Response Structure
The agent response has this structure:
```typescript
{
  steps: [{
    content: [{ type: "text", text: "actual response text" }],
    // ... other step data
  }],
  resolvedOutput: undefined // Often empty
}
```

Text extraction requires navigating through `steps[].content[]` to find text parts.

## Working Implementation

### Simple Eval Test (Verified Working)
```typescript
// 1. Get response
const response = await agent.generate(messages);

// 2. Extract text from complex structure
const text = response.steps[0].content.find(c => c.type === "text").text;

// 3. Run eval manually
const metric = new AnswerRelevancyMetric(model, { scale: 10 });
const result = await metric.measure(input, text);
```

### Available Metrics
- **LLM Metrics** (`@mastra/evals/llm`):
  - HallucinationMetric
  - FaithfulnessMetric
  - AnswerRelevancyMetric
  - CompletenessMetric
  - PromptAlignmentMetric
  - ToxicityMetric
  - BiasMetric
  - SummarizationMetric

- **NLP Metrics** (`@mastra/evals/nlp`):
  - ToneConsistencyMetric
  - ContentSimilarityMetric
  - KeywordCoverageMetric

### Common Issues
1. **Import Errors**: Use `@mastra/evals/llm` not `@mastra/evals/judge`
2. **Constructor Parameters**: Most metrics require `{ scale: 10 }` option
3. **Empty Responses**: Some metrics fail with undefined/empty text
4. **API Keys**: Eval model needs separate API key configuration

## Test Results

### Math Question Test ("What is 2 + 2?")
- **Answer Relevancy**: 76.7% - Direct answer but penalized for extra explanation
- **Toxicity**: 0% (perfect - no toxic content)

## Recommendations

### For Testing V1 Agent
1. **Use Manual Evaluation**: Create separate eval runner scripts
2. **Select Key Metrics**: Focus on relevancy, hallucination, and safety
3. **Handle Complex Responses**: Extract text from tool-heavy responses
4. **Batch Evaluations**: Run metrics in parallel for efficiency

### For Production
1. **Consider External Frameworks**: Braintrust, Langfuse for full eval pipelines
2. **Create Eval Dataset**: Build test cases covering all agent capabilities
3. **Monitor Key Metrics**: Track relevancy, safety, and task completion
4. **Set Thresholds**: Define acceptable scores per use case

## Future Improvements
- Mastra may add automatic eval execution in future versions
- Consider creating wrapper to simplify eval execution
- Build comprehensive test suite with expected outputs
- Integrate with CI/CD for regression testing