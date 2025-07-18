import { Agent } from "@mastra/core";
import { CompositeVoice } from "@mastra/core/voice";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";
import { OpenAIVoice } from "@mastra/voice-openai";
import { env } from "../../env";
import { anthropic, anthropicModels } from "../lib/anthropic";

// Create voice configuration only if API keys are available
let voice: CompositeVoice | undefined;

if (env.OPENROUTER_API_KEY && env.ELEVENLABS_API_KEY) {
	try {
		voice = new CompositeVoice({
			input: new OpenAIVoice({
				speechModel: {
					apiKey: env.OPENROUTER_API_KEY,
				},
			}),
			output: new ElevenLabsVoice({
				speechModel: {
					apiKey: env.ELEVENLABS_API_KEY,
				},
			}),
		});
	} catch (error) {
		console.warn("Voice capabilities disabled - missing API keys:", error);
	}
}

// Create the voice agent
export const voiceAgent = new Agent({
	name: "voiceAgent",
	description: "A voice-enabled assistant with speech capabilities",
	instructions: `You are a helpful voice assistant that can provide conversational responses optimized for audio output.
  
  Keep your responses clear, concise, and natural for voice interaction.
  Speak in a friendly, conversational tone that works well when converted to speech.
  
  Note: This agent has voice capabilities that can convert text to speech and transcribe audio to text.`,
	model: anthropic(anthropicModels.claude4Sonnet),
	...(voice && { voice }),
});
