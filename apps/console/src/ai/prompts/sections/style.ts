import type { SectionProvider, CommunicationStyle } from "@repo/prompt-engine";

const STYLE_INSTRUCTIONS: Record<CommunicationStyle, string> = {
  formal: `COMMUNICATION STYLE:
- Write in a professional, precise tone.
- Use clear technical language without unnecessary jargon.
- Prefer concise explanations. Be thorough when the topic demands it.
- Address the user respectfully and maintain a neutral register.`,

  concise: `COMMUNICATION STYLE:
- Be as brief as possible. Omit filler words.
- Use bullet points over paragraphs.
- Lead with the answer, then provide supporting detail only if asked.
- Target responses under 100 words unless the user asks for more.`,

  technical: `COMMUNICATION STYLE:
- Prioritize accuracy and precision over readability.
- Include relevant technical details, version numbers, and specifications.
- Use code examples liberally when discussing implementation.
- Reference official documentation and standards where applicable.`,

  friendly: `COMMUNICATION STYLE:
- Be warm and conversational while staying helpful.
- Use plain language and explain technical concepts accessibly.
- Encourage follow-up questions.
- Keep a supportive, collaborative tone.`,
};

export const answerStyleSection: SectionProvider = (ctx) => {
  if (!ctx.features.style) return null;

  return {
    id: "style",
    priority: "medium",
    estimateTokens: () => 80,
    render: () => STYLE_INSTRUCTIONS[ctx.style],
  };
};
