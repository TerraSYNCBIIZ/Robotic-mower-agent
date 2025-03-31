import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Initialize the Google Generative AI client with the API key from environment variable
const getGoogleAI = (): GoogleGenerativeAI | null => {
  // Check for server-side environment variable
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  if (!apiKey) {
    console.error('Google Generative AI API key is not set - please check your environment variables');
    return null;
  }
  
  return new GoogleGenerativeAI(apiKey);
};

export async function GET() {
  return NextResponse.json({ status: "The chat API is working" });
}

export async function POST(request: Request) {
  try {
    const { message, chatHistory } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    // Initialize Google AI client
    const genAI = getGoogleAI();
    
    if (!genAI) {
      return NextResponse.json(
        { error: "Failed to initialize AI client" },
        { status: 500 }
      );
    }
    
    // Get the Gemini model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro-exp-03-25',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
    
    // Convert message history to Google AI format if provided
    const history: ChatMessage[] = chatHistory || [];
    
    // Create a chat session
    const chat = model.startChat({
      history,
    });
    
    // Send message and get response
    const result = await chat.sendMessage(message);
    const response = result.response.text();
    
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
} 