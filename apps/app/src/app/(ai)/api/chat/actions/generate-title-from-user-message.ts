import type { Message } from "ai";
import { generateText } from "ai";

import { providers } from "~/app/(ai)/api/chat/providers/models";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  const { text: title } = await generateText({
    model: providers.languageModel("title"),
    system: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}
