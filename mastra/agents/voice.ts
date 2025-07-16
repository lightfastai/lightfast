import { Agent } from "@mastra/core";
import { CompositeVoice } from "@mastra/core/voice";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
import { openRouter } from "../lib/openrouter";
import { createTool } from "@mastra/core";

// Create voice tools for the agent
const speakTool = createTool({
  id: "speak",
  name: "Speak Response",
  description: "Convert text to speech and play audio response",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to convert to speech",
      },
      voice: {
        type: "string",
        description: "Voice ID or name to use for synthesis",
        enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
        default: "alloy",
      },
    },
    required: ["text"],
  },
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
  name: "Transcribe Audio",
  description: "Convert audio input to text",
  inputSchema: {
    type: "object",
    properties: {
      audioData: {
        type: "string",
        description: "Base64 encoded audio data or audio file path",
      },
      language: {
        type: "string",
        description: "Language code for transcription (e.g., 'en' for English)",
        default: "en",
      },
    },
    required: ["audioData"],
  },
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
  name: "Configure Voice Settings",
  description: "Adjust voice synthesis parameters",
  inputSchema: {
    type: "object",
    properties: {
      speed: {
        type: "number",
        description: "Speech speed (0.25 to 4.0)",
        minimum: 0.25,
        maximum: 4.0,
        default: 1.0,
      },
      pitch: {
        type: "number",
        description: "Voice pitch adjustment",
        minimum: -2.0,
        maximum: 2.0,
        default: 0,
      },
      stability: {
        type: "number",
        description: "Voice stability (0 to 1)",
        minimum: 0,
        maximum: 1,
        default: 0.5,
      },
      similarityBoost: {
        type: "number",
        description: "Voice similarity boost (0 to 1)",
        minimum: 0,
        maximum: 1,
        default: 0.5,
      },
    },
  },
  execute: async ({ context }) => {
    return {
      success: true,
      settings: context,
      message: "Voice settings updated",
    };
  },
});

// Initialize voice components
const openAIVoice = new OpenAIVoice({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

const elevenLabsVoice = new ElevenLabsVoice({
  apiKey: process.env.ELEVENLABS_API_KEY || "",
});

// Create composite voice for both input and output
const voice = new CompositeVoice({
  input: openAIVoice, // For speech-to-text
  output: elevenLabsVoice, // For text-to-speech
});

// Create the voice agent
export const voiceAgent = new Agent({
  name: "voiceAgent",
  instructions: `You are a helpful voice assistant with advanced speech capabilities. You can:
  
  1. Convert text to natural-sounding speech using multiple voice options
  2. Transcribe audio input to text accurately
  3. Adjust voice settings like speed, pitch, and stability
  4. Provide conversational responses optimized for audio output
  
  Keep your responses clear, concise, and natural for voice interaction.
  When users ask you to speak, use the speak tool to generate audio.
  When receiving audio input, use the transcribe tool to convert it to text.`,
  model: openRouter,
  tools: {
    speak: speakTool,
    transcribe: transcribeTool,
    voiceSettings: voiceSettingsTool,
  },
  voice,
});