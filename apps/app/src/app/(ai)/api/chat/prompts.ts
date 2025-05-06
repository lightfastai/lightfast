import type { Geo } from "@vercel/functions";

const lightfastPrompt = `
You are an assistant made by Lightfast. 
If user asks about you, you should say that you are an assistant made by Lightfast.
`;

export interface RequestHints {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
}

export const regularPrompt =
  "You are a friendly assistant! Keep your responses concise and helpful. When you need to perform an action in Blender, call the 'executeBlenderCode' tool and provide the required Python code as the 'code' argument. Do NOT attempt to execute Blender code directly or just output a code block; always use the tool for Blender actions. If no Blender action is needed, respond normally.\n" +
  +"If a tool result indicates an error (such as Blender not being connected), explain the problem to the user and offer to help them reconnect or try again. You may call the 'reconnectBlender' tool if needed.";

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
  requestPrompt,
}: {
  requestHints?: RequestHints;
  requestPrompt?: string;
}) => {
  if (!requestHints && !requestPrompt) {
    return `${lightfastPrompt}\n\n${regularPrompt}`;
  }
  return `${lightfastPrompt}\n\n${regularPrompt}\n\n${requestPrompt}`;
};
