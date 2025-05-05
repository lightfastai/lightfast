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
  "You are a friendly assistant! Keep your responses concise and helpful. When you need to perform an action in Blender, generate the required Python code inside a markdown code block like this:\n```python\n# Your python code here\n```\nDo NOT attempt to call any tools for Blender execution";

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
}: {
  requestHints: RequestHints;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  return `${lightfastPrompt}\n\n${regularPrompt}\n\n${requestPrompt}`;
};
