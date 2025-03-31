import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

// Type definition for chat message
export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Initialize the Google Generative AI client with the API key from environment variables
const getGoogleAI = (): GoogleGenerativeAI | null => {
  // Check for client-side environment variable first, then fallback to server-side
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  
  if (!apiKey) {
    console.error('Google Generative AI API key is not set - please check your environment variables');
    return null;
  }
  
  return new GoogleGenerativeAI(apiKey);
};

// Function to get a response from the Gemini model
export async function getAIResponse(userMessage: string, chatHistory: ChatMessage[] = []): Promise<string> {
  try {
    // Use the API endpoint instead of calling Google AI directly
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        chatHistory,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}

// Function to create system prompt for the mower assistant
export function createMowerSystemPrompt(mowerName?: string): string {
  return `You are MowerMind AI, a helpful assistant for robotic lawn mowers${
    mowerName ? ` currently connected to ${mowerName}` : ''
  }. Your goal is to assist users with their smart mowers, providing guidance on maintenance, scheduling, troubleshooting, and optimization.
  
  Here are some key facts about robotic mowers:
  - They operate on rechargeable batteries and return to charging stations automatically
  - They use boundary wires or GPS for navigation
  - They require regular blade maintenance
  - Their schedules can be optimized based on weather and lawn growth patterns
  
  Be helpful, concise, and informative. If you don't know something, acknowledge it and suggest how the user might find the answer.`;
} 