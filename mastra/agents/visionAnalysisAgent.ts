import { openai } from "@ai-sdk/openai";
import { Agent } from '@mastra/core';
import { createTool } from '@mastra/core';
import { z } from 'zod';
import OpenAI from 'openai';

// Tool to analyze images or PDFs from URLs
const analyzeVisualContent = createTool({
  id: 'analyzeVisualContent',
  description: 'Analyzes images or PDFs from provided URLs using vision capabilities',
  inputSchema: z.object({
    url: z.string().url().describe('URL of the image or PDF to analyze'),
    analysisType: z.enum(['general', 'detailed', 'text-extraction']).optional()
      .describe('Type of analysis to perform'),
  }),
  execute: async ({ context }) => {
    const { url, analysisType = 'general' } = context;
    
    try {
      // Initialize OpenAI client
      const openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Determine the prompt based on analysis type
      let prompt = 'What is in this image?';
      if (analysisType === 'detailed') {
        prompt = 'Please provide a detailed analysis of this image, including all visible elements, colors, composition, and any text present.';
      } else if (analysisType === 'text-extraction') {
        prompt = 'Extract and transcribe all text visible in this image or document.';
      }

      // Call OpenAI Vision API
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url } }
            ],
          },
        ],
        max_tokens: 1000,
      });

      const analysis = response.choices[0]?.message?.content || 'No analysis available';

      return {
        success: true,
        url,
        analysisType,
        analysis,
        model: 'gpt-4o-mini',
      };
    } catch (error) {
      console.error('Vision analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        url,
      };
    }
  },
});

// Tool to fetch and validate URLs
const validateUrl = createTool({
  id: 'validateUrl',
  description: 'Validates if a URL points to an accessible image or PDF',
  inputSchema: z.object({
    url: z.string().url().describe('URL to validate'),
  }),
  execute: async ({ context }) => {
    const { url } = context;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      
      const isImage = contentType.startsWith('image/');
      const isPdf = contentType.includes('application/pdf');
      
      return {
        valid: response.ok && (isImage || isPdf),
        contentType,
        isImage,
        isPdf,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate URL',
      };
    }
  },
});

// Create the vision analysis agent
export const visionAnalysisAgent = new Agent({
  name: 'visionAnalysisAgent',
  description: 'Analyzes images and PDFs from URLs using OpenAI GPT-4 mini vision capabilities',
  model: openai("gpt-4o-mini"),
  tools: {
    analyzeVisualContent,
    validateUrl,
  },
  instructions: `You are a vision analysis agent that helps users analyze images and PDFs from URLs.

Your capabilities:
1. Validate URLs to ensure they point to valid images or PDFs
2. Analyze visual content using OpenAI's vision capabilities
3. Extract text from images and documents
4. Provide detailed descriptions of visual content

When a user provides a URL:
1. First validate the URL using the validateUrl tool
2. If valid, analyze the content using analyzeVisualContent
3. Provide clear, structured analysis results
4. If the URL is invalid or inaccessible, explain the issue clearly

Always be helpful and provide comprehensive analysis based on what you can see in the visual content.`,
});