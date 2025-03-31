import { NextRequest, NextResponse } from 'next/server';
import mcpServer from '@/mcp-server';
import { Anthropic } from '@anthropic-ai/sdk';

// Define the TypeScript types we need
interface MessageContentBlock {
  type: string;
  text?: string;
  tool_use?: {
    name: string;
    parameters: Record<string, any>;
  };
}

interface ToolResult {
  tool_name: string;
  result?: any;
  error?: string;
}

// Check if we have an API key configured
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SYSTEM_MAX_TOKENS = 4000; // Limit system prompt to avoid excessive tokens
const MODEL = process.env.CLAUDE_MODEL || 'claude-3-opus-20240229';

// Initialize the Claude client with API key
const claude = ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

// Create a context manager to include relevant information about mowers in the system prompt
function createSystemPrompt(availableMowers: any[]) {
  // Start with the core purpose
  let systemPrompt = `You are an intelligent assistant for Husqvarna robotic lawn mowers. 
Your primary function is to help users control, monitor, and optimize their mowers using natural language.

`;

  // Add available mowers context if there are any
  if (availableMowers && availableMowers.length > 0) {
    systemPrompt += `Available mowers:
${availableMowers.map((m: any) => `- ${m.name} (ID: ${m.id}, Model: ${m.model})`).join('\n')}

`;
  }

  // Add mower identification guidance
  systemPrompt += `User Context:
- If a user refers to a mower by name rather than ID, use the correct mower ID when making API calls
- If the user has only one mower, you can assume they're referring to that mower
- If they have multiple mowers and don't specify which one, ask them to clarify
- Remember the mower a user is discussing in the conversation and maintain that context

Tool Usage Guidelines:
- Use getMowerStatus to check a mower's battery level, current activity, and operational state
- Use startMower to begin mowing operations, with optional duration parameter (in minutes)
- Use parkMower to send the mower back to its charging station
- Use getMowerSchedule to view the current schedule
- Use updateMowerSchedule to modify the mowing schedule
- Use getUserMowers to see all available mowers if the user is unsure which mowers they have

Response Guidelines:
- Be conversational but concise - use short, direct responses
- For status updates, always include key information like battery level and current activity
- If a command succeeds, confirm what action was taken
- If a command fails, explain why in simple terms and suggest alternatives
- Use technical terms correctly but explain them when needed
- Acknowledge the user's goal and respond appropriately to their intent

Additional Knowledge:
- Typical lawn mowing is recommended 2-3 times per week during growing season
- Mowing during early morning or evening is ideal to avoid heat stress
- Battery life typically lasts 2-4 hours of mowing depending on model and lawn conditions
- Regular maintenance includes cleaning, blade replacement, and software updates
`;

  // Make sure we don't exceed token limits for system prompt
  if (systemPrompt.length > SYSTEM_MAX_TOKENS) {
    // Simplify if needed
    systemPrompt = systemPrompt.split("\n\n").slice(0, 3).join("\n\n") + "\n\nYou help users control their robotic mowers.";
  }

  return systemPrompt;
}

// Add a comment explaining the approach
/**
 * This is the main API route for the chat functionality.
 * It integrates with Anthropic's Claude AI via the Model Context Protocol (MCP)
 * to provide a natural language interface for controlling Husqvarna robotic mowers.
 * 
 * The implementation:
 * 1. Receives messages from the frontend chat interface
 * 2. Sends them to Claude with the available mower control tools
 * 3. Processes any tool calls that Claude wants to make
 * 4. Returns Claude's response to the frontend
 * 
 * If Claude API is not available, a fallback mechanism provides basic responses.
 */

export async function POST(request: NextRequest) {
  try {
    const { messages, availableMowers } = await request.json();
    
    // Create the system prompt with mower context
    const systemPrompt = createSystemPrompt(availableMowers);
    
    // Get tools from MCP server
    const tools = mcpServer.getTools();
    
    // If we don't have Claude API key, use a fallback response
    if (!claude) {
      console.warn('No Claude API key found, using fallback responses');
      return handleFallbackResponse(messages, availableMowers);
    }
    
    // Log the incoming message structure to debug
    console.log('Incoming messages:', JSON.stringify(messages.map((m: any) => 
      ({ role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 50) : '...' })
    ), null, 2));
    
    // Prepare conversation history for Claude
    const conversationMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
    
    console.log('Sending to Claude:', { 
      model: MODEL,
      messageCount: conversationMessages.length,
      toolCount: tools.length,
      messages: conversationMessages.map((m: {role: string; content: any}) => 
        ({ role: m.role, contentLength: m.content?.length || 0 }))
    });
    
    try {
      // Call Claude API with tools
      const response = await claude.messages.create({
        model: MODEL,
        system: systemPrompt,
        messages: conversationMessages,
        tools: tools,
        max_tokens: 1000,
        temperature: 0.7,
      });
      
      console.log('Claude response received:', {
        contentLength: response.content.length,
        hasToolCalls: response.content.some(block => block.type === 'tool_use')
      });
      
      // Process any tool use blocks from Claude's response
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      
      if (toolUseBlocks.length > 0) {
        // Extract tool calls from blocks
        const toolCalls = toolUseBlocks.map(block => {
          // We've already filtered for tool_use blocks
          return {
            name: (block as any).tool_use.name,
            parameters: (block as any).tool_use.parameters
          };
        });
        
        console.log('Claude wants to use tools:', JSON.stringify(toolCalls, null, 2));
        
        // Claude wants to use tools, let's handle that
        const toolResults = await handleToolUse(toolCalls, availableMowers);
        
        console.log('Tool results:', JSON.stringify(toolResults, null, 2));
        
        // Add tool results to the conversation
        const updatedMessages = [
          ...conversationMessages,
          {
            role: 'assistant',
            content: response.content
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_result: toolResults }]
          }
        ];
        
        // Make a follow-up request to Claude with the tool results
        const followUpResponse = await claude.messages.create({
          model: MODEL,
          system: systemPrompt,
          messages: updatedMessages,
          max_tokens: 1000,
          temperature: 0.7,
        });
        
        // Find the text content in the response
        const textBlock = followUpResponse.content.find(block => block.type === 'text');
        
        // Return the final response
        return NextResponse.json({
          message: textBlock ? textBlock.text : "I processed your request but couldn't generate a proper response."
        });
      }
      
      // Find the text block in the response content
      const textBlock = response.content.find(block => block.type === 'text');
      
      // If no tool use, just return the response text
      return NextResponse.json({
        message: textBlock ? textBlock.text : "I received your message but couldn't generate a proper response."
      });
      
    } catch (claudeError: any) {
      console.error('Error calling Claude API:', claudeError?.message, claudeError?.stack);
      // Fall back to basic response if Claude API fails
      return handleFallbackResponse(messages, availableMowers);
    }
  } catch (error: any) {
    console.error('Error in chat API:', error?.message, error?.stack);
    return NextResponse.json(
      { error: 'Chat processing error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Handle tool use by forwarding to the MCP server
async function handleToolUse(toolUse: any[], availableMowers: any[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  
  for (const tool of toolUse) {
    try {
      // Process each tool call through our MCP server
      const response = await mcpServer.handleRequest({
        name: tool.name,
        parameters: tool.parameters
      });
      
      // Check for errors in the response
      if (response.error) {
        results.push({
          tool_name: tool.name,
          error: response.error
        });
      } else {
        results.push({
          tool_name: tool.name,
          result: response.result || response
        });
      }
    } catch (error) {
      console.error(`Error executing tool ${tool.name}:`, error);
      results.push({
        tool_name: tool.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// Fallback response generator when Claude API is unavailable
function handleFallbackResponse(messages: any[], availableMowers: any[]) {
  // Get the last user message
  const lastMessage = messages[messages.length - 1];
  let response = 'I need the Claude API to provide a proper response.';
  
  if (!lastMessage || !lastMessage.content) {
    return NextResponse.json({ message: response });
  }
  
  // Get the content as string if it's an array of blocks
  const content = Array.isArray(lastMessage.content) 
    ? lastMessage.content.map((block: any) => block.text).join(' ') 
    : lastMessage.content;
  
  const userMessage = typeof content === 'string' ? content.toLowerCase() : '';
  const mowerOptions = availableMowers && availableMowers.length > 0 
    ? availableMowers 
    : [{ name: 'your mower', id: 'demo-mower' }];
  
  // Basic pattern matching for testing without Claude API
  if (userMessage.includes('status') || userMessage.includes('battery') || userMessage.includes('what')) {
    const mower = mowerOptions[0];
    response = `${mower.name} is currently charging. Battery level is at 85%. Everything is functioning normally.`;
  } else if (userMessage.includes('start') || userMessage.includes('mow')) {
    const mower = mowerOptions[0];
    response = `I've sent a command to start ${mower.name}. It should begin mowing shortly.`;
  } else if (userMessage.includes('park') || userMessage.includes('stop') || userMessage.includes('dock')) {
    const mower = mowerOptions[0];
    response = `I've sent a command to park ${mower.name}. It will return to the charging station.`;
  } else if (userMessage.includes('schedule')) {
    response = "You have no mowing schedules configured yet. Would you like me to help you set one up?";
  } else if (userMessage.includes('help') || userMessage.includes('what can you')) {
    response = "I can help you control your robotic mower. You can ask me to check status, start mowing, park the mower, or manage your mowing schedule.";
  } else {
    response = "I understood your request, but I need Claude API access to handle it properly. You can try asking about mower status, starting or parking the mower, or checking the schedule.";
  }
  
  return NextResponse.json({ message: response });
} 