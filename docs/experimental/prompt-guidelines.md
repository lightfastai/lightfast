# System Prompt Engineering Guidelines

## Executive Summary
This document provides comprehensive guidelines for creating effective system prompts for LLM agents based on 2025 best practices from Anthropic, OpenAI, and industry standards.

## Core Structure

### 1. Hierarchical XML Organization
Use nested XML tags for clear structure:

```xml
<system>
  <role>...</role>
  <objective>...</objective>
  <instructions>...</instructions>
  <constraints>...</constraints>
  <error_handling>...</error_handling>
  <performance_optimization>...</performance_optimization>
  <communication_style>...</communication_style>
</system>
```

### 2. Essential Components

#### Role Definition
```xml
<role>
  <identity>Clear, specific agent identity</identity>
  <core_competencies>
    - List key capabilities
    - Be specific about expertise areas
  </core_competencies>
  <expertise_level>Define skill level and autonomy</expertise_level>
</role>
```

#### Clear Objective
```xml
<objective>
  State the primary purpose in 2-3 sentences. Be specific about:
  - What the agent should accomplish
  - How it should approach tasks
  - Expected outcomes
</objective>
```

#### Knowledge Boundaries
```xml
<knowledge_boundaries>
  <cutoff_date>Specific date</cutoff_date>
  <knowledge_handling>
    - How to handle unknown information
    - When to use tools vs internal knowledge
    - How to acknowledge limitations
  </knowledge_handling>
  <real_time_capabilities>
    - List tools that provide current data
  </real_time_capabilities>
</knowledge_boundaries>
```

### 3. Task Management

#### Working Memory Structure
```xml
<working_memory>
  <structure>Define data schema</structure>
  <lifecycle>State transitions</lifecycle>
  <usage>When and how to use</usage>
</working_memory>
```

#### Execution Loop
```xml
<execution_loop>
  <step_1>
    <name>Step Name</name>
    <actions>Specific actions to take</actions>
  </step_1>
  <!-- Additional steps -->
</execution_loop>
```

### 4. Tool Organization

#### Group by Workflow
```xml
<tool_usage>
  <category_name>
    <principles>General guidelines</principles>
    <tools>
      - toolName: Description and usage
    </tools>
    <practices>Best practices</practices>
  </category_name>
</tool_usage>
```

#### Workflow Patterns
```xml
<workflow_patterns>
  <pattern_name>
    <steps>
      1. First action
      2. Second action
      <!-- Continue -->
    </steps>
  </pattern_name>
</workflow_patterns>
```

### 5. Constraints and Boundaries

#### Explicit Limitations
```xml
<constraints>
  <limitations>
    - What the agent cannot do
    - Technical limitations
    - Scope boundaries
  </limitations>
  <boundaries>
    - Security constraints
    - Ethical guidelines
    - Operational limits
  </boundaries>
</constraints>
```

### 6. Error Handling

#### Comprehensive Strategy
```xml
<error_handling>
  <validation>
    <pre_execution>Checks before tool use</pre_execution>
  </validation>
  <graceful_degradation>
    <strategies>Alternative approaches</strategies>
  </graceful_degradation>
  <recovery>
    <approaches>How to recover from failures</approaches>
  </recovery>
</error_handling>
```

### 7. Performance Optimization

```xml
<performance_optimization>
  <category>
    - Specific optimization techniques
    - Resource management strategies
  </category>
</performance_optimization>
```

### 8. Communication Guidelines

```xml
<communication_style>
  <guidelines>
    - How to interact with users
    - Progress reporting
    - Result presentation
  </guidelines>
  <tone>Desired communication tone</tone>
</communication_style>
```

## Best Practices

### Structure and Organization
1. **Use XML tags** - Models are trained to pay attention to XML structure
2. **Be hierarchical** - Nest related concepts
3. **Be explicit** - State everything clearly, don't assume
4. **Use consistent naming** - Keep tag names logical and consistent

### Content Guidelines
1. **Front-load important information** - Put critical instructions early
2. **Be specific** - Avoid vague instructions
3. **Use positive framing** - Say what to do, not just what to avoid
4. **Include examples** - Show desired behavior patterns
5. **Explain why** - Context helps models make better decisions

### Language and Tone
1. **Use clear, direct language**
2. **Avoid jargon unless necessary**
3. **Be consistent in terminology**
4. **Match tone to use case**

### Technical Considerations
1. **Consider token limits** - Keep prompts comprehensive but efficient
2. **Test iteratively** - Refine based on actual performance
3. **Version control** - Track prompt changes
4. **Document changes** - Maintain a changelog

## Common Pitfalls to Avoid

1. **Over-complexity** - Don't make the structure unnecessarily complex
2. **Redundancy** - Avoid repeating the same instructions
3. **Ambiguity** - Be specific about expectations
4. **Missing error handling** - Always include failure scenarios
5. **Ignoring constraints** - Clearly state what the agent cannot do

## Testing and Validation

Before deployment:
- [ ] Test with various input types
- [ ] Verify error handling works
- [ ] Check performance optimization impact
- [ ] Validate constraint adherence
- [ ] Test edge cases
- [ ] Review communication style consistency

## Example Template

```xml
<system>
  <role>
    <identity>Your Agent Name - Descriptive Title</identity>
    <core_competencies>
      - Key capability 1
      - Key capability 2
    </core_competencies>
    <expertise_level>Expert/Specialist/Assistant</expertise_level>
  </role>

  <objective>
    Primary purpose statement. What the agent accomplishes and how.
  </objective>

  <knowledge_boundaries>
    <cutoff_date>Month Year</cutoff_date>
    <knowledge_handling>
      - How to handle unknowns
      - Tool usage for current info
    </knowledge_handling>
  </knowledge_boundaries>

  <instructions>
    <!-- Detailed operational instructions -->
  </instructions>

  <constraints>
    <limitations>
      - Cannot do X
      - Limited to Y
    </limitations>
  </constraints>

  <error_handling>
    <!-- Error strategies -->
  </error_handling>

  <communication_style>
    <guidelines>
      - User interaction approach
    </guidelines>
    <tone>Professional and helpful</tone>
  </communication_style>
</system>
```

## Maintenance and Updates

1. **Regular Reviews** - Review prompt effectiveness monthly
2. **User Feedback** - Incorporate user feedback
3. **Performance Metrics** - Track success rates
4. **Iterative Improvement** - Refine based on data
5. **Documentation** - Keep guidelines updated

## Additional Resources

- Anthropic's Claude documentation
- OpenAI's prompt engineering guide
- Industry best practices repositories
- Community forums and discussions

Remember: Great system prompts are clear, structured, and comprehensive while remaining focused on the agent's core purpose.