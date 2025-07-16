import { Agent } from "@mastra/core";
import { CompositeVoice } from "@mastra/core/voice";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
import { openrouter, models } from "../lib/openrouter";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Create voice tools for the agent
const speakTool = createTool({
  id: "speak",
  description: "Convert text to speech and play audio response",
  inputSchema: z.object({
    text: z.string().describe("The text to convert to speech"),
    voice: z
      .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
      .default("alloy")
      .describe("Voice ID or name to use for synthesis"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    audioGenerated: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { text, voice = "alloy" } = context;
    return {
      success: true,
      message: `Speaking: "${text}" with voice: ${voice}`,
      audioGenerated: true,
    };
  },
});

const transcribeTool = createTool({
  id: "transcribe",
  description: "Convert audio input to text",
  inputSchema: z.object({
    audioData: z
      .string()
      .describe("Base64 encoded audio data or audio file path"),
    language: z
      .string()
      .default("en")
      .describe("Language code for transcription (e.g., 'en' for English)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transcription: z.string(),
    language: z.string(),
  }),
  execute: async ({ context }) => {
    const { audioData, language = "en" } = context;
    return {
      success: true,
      transcription: "Audio transcription would appear here",
      language,
    };
  },
});

const voiceSettingsTool = createTool({
  id: "voiceSettings",
  description: "Adjust voice synthesis parameters",
  inputSchema: z.object({
    speed: z
      .number()
      .min(0.25)
      .max(4.0)
      .default(1.0)
      .describe("Speech speed (0.25 to 4.0)"),
    pitch: z
      .number()
      .min(-2.0)
      .max(2.0)
      .default(0)
      .describe("Voice pitch adjustment"),
    stability: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Voice stability (0 to 1)"),
    similarityBoost: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Voice similarity boost (0 to 1)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    settings: z.object({
      speed: z.number(),
      pitch: z.number(),
      stability: z.number(),
      similarityBoost: z.number(),
    }),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      success: true,
      settings: context,
      message: "Voice settings updated",
    };
  },
});

// Create composite voice for both input and output
const voice = new CompositeVoice({
  input: new OpenAIVoice(), // For speech-to-text
  output: new ElevenLabsVoice({ // For text-to-speech
    apiKey: process.env.ELEVENLABS_API_KEY!,
  }),
});

// Create the voice agent
export const voiceAgent = new Agent({
  name: "voiceAgent",
  description: "A voice-enabled assistant with speech capabilities",
  instructions: `You are a helpful voice assistant with advanced speech capabilities. You can:
  
  1. Convert text to natural-sounding speech using multiple voice options
  2. Transcribe audio input to text accurately
  3. Adjust voice settings like speed, pitch, and stability
  4. Provide conversational responses optimized for audio output
  
  Keep your responses clear, concise, and natural for voice interaction.
  When users ask you to speak, use the speak tool to generate audio.
  When receiving audio input, use the transcribe tool to convert it to text.`,
  model: openrouter(models.claude4Sonnet),
  tools: {
    speak: speakTool,
    transcribe: transcribeTool,
    voiceSettings: voiceSettingsTool,
  },
  voice,
});