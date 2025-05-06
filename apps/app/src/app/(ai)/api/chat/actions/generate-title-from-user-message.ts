import type { UIMessage } from "ai";
import { generateText } from "ai";

import { modelProviders } from "~/app/(ai)/api/chat/providers/models";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: modelProviders.languageModel("title-model"),
    system: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}
