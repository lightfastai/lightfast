# Changelog Templates

## BaseHub Entry Fields

When creating/editing in BaseHub:
- **Title**: 2-3 key features (e.g., "GitHub File Sync, Semantic Search, Team Workspaces")
- **Slug**: Version in URL format ("0-1", "1-2", etc.)
- **Body**: Main changelog content (markdown)
- **Description**: 150-160 char meta description with keywords

## Document Structure


```markdown
**[2-3 key features as subtitle]**

---

### [Feature Name]

[1-3 sentences: what it does + user benefit]

**What's included:**
- Bullet list of specific capabilities
- Include limitations if any
- Mention beta/rollout status if applicable

**Example:**
\`\`\`yaml
# Config snippet or API example
\`\`\`

[Optional: "Why we built it this way" insight]

---

### [Next Feature]

[Repeat structure]

---

### Improvements (N)

<details>
<summary>View all improvements</summary>

- Concise bullet (1-2 lines max)
- Focus on user impact, not implementation
- [Link to docs if relevant](/docs/feature)

</details>

---

### Infrastructure (N)

<details>
<summary>View technical details</summary>

- Platform/architecture improvements
- Can be more technical than Improvements
- Include performance metrics if available

</details>

---

### What's Coming Next

[ONLY include if validated by implementation docs]

**Based on your feedback:**
1. **[Feature]** (vX.X) — [brief description, validated by roadmap]
2. **[Integration]** (when N+ customers request it)

---

### Resources

- [Quick Start](/docs/quick-start)
- [GitHub Setup](/docs/integrations/github)
- [API Reference](/docs/api)
- [Configuration Docs](/docs/config)
```

## Section Guidelines

### Feature Sections
- Lead with user benefit
- Include "What's included" bullets
- Add code example
- Disclose what's NOT included
- Optional: "Why we built it this way"

### Improvements Section
- Use collapsible `<details>` tag
- 1-2 lines per item max
- Focus on user impact
- Link to docs where relevant

### Infrastructure Section
- Technical audience
- Include metrics where available
- Can be more detailed than Improvements

### What's Coming Next
- ONLY validated items from roadmap
- Use conditionals: "when N+ customers request"
- Be honest about prioritization
