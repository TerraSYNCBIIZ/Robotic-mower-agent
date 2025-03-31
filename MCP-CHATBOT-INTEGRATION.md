# Robotic Mower MCP Chatbot Integration

## Overview

This guide outlines the implementation of an MCP (Model Context Protocol) server to enhance our robotic mower control system with natural language capabilities. By adding MCP to our chatbot, users can interact with their mowers through conversational commands rather than navigating traditional UI elements.

## What is MCP?

MCP (Model Context Protocol) is a standardized protocol for AI assistants to interact with external tools and services. It enables:

- **Natural language commands**: Users can type requests like "Schedule mowing for Tuesday" instead of using UI controls
- **Tool discovery**: The AI automatically discovers what actions it can perform with the mower
- **Structured interactions**: The protocol handles the translation between natural language and API calls

## Architecture

```
┌──────────────┐    ┌───────────────┐    ┌────────────────┐    ┌───────────────┐
│ Chat Interface│───▶│ AI Assistant  │───▶│  MCP Client   │───▶│   MCP Server  │
└──────────────┘    └───────────────┘    └────────────────┘    └───────┬───────┘
                                                                        │
                                                                        ▼
                                                               ┌─────────────────┐
                                                               │  Husqvarna API  │
                                                               └────────┬────────┘
                                                                        │
                                                                        ▼
                                                               ┌─────────────────┐
                                                               │ Firebase Cache  │
                                                               └─────────────────┘
```

The MCP server will coexist with our current optimization system:
- Dashboard continues to use WebSocket/Firebase for real-time updates
- Chatbot uses MCP for natural language control

## Implementation Steps

### 1. Set Up MCP Server Framework

```bash
# Install the MCP SDK for TypeScript
npm install @anthropic-ai/mcp-sdk

# Create directory structure
mkdir -p src/mcp-server
```

### 2. Define MCP Server with Tools

Create a new file `src/mcp-server/index.ts`:

```typescript
import { McpServer, Tool, ToolCall } from '@anthropic-ai/mcp-sdk';
import { husqvarnaApi } from '../lib/husqvarna/api-client';
import { getMowerDataService } from '../lib/husqvarna/mowerDataService';

const dataService = getMowerDataService();

// Define the MCP server with tools
const server = new McpServer({
  tools: [
    {
      name: 'getMowerStatus',
      description: 'Get the current status of a mower including battery level, activity, and state',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to get status for'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId }) {
        // Use our existing data service with optimization
        const mowerData = await dataService.getMowerData(mowerId);
        return {
          battery: mowerData.battery,
          activity: mowerData.mower.activity,
          state: mowerData.mower.state,
          connected: mowerData.metadata.connected,
          lastUpdated: mowerData.metadata.lastUpdated
        };
      }
    },
    
    {
      name: 'getMowerSchedule',
      description: 'Get the current mowing schedule for a mower',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to get schedule for'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId }) {
        const schedule = await dataService.getMowerSchedule(mowerId);
        return { schedule };
      }
    },
    
    {
      name: 'updateMowerSchedule',
      description: 'Update the mowing schedule for a mower',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to update schedule for'
          },
          schedule: {
            type: 'array',
            description: 'The schedule tasks to set',
            items: {
              type: 'object',
              properties: {
                start: {
                  type: 'integer',
                  description: 'Start time in seconds from midnight'
                },
                duration: {
                  type: 'integer',
                  description: 'Duration in seconds'
                },
                monday: { type: 'boolean' },
                tuesday: { type: 'boolean' },
                wednesday: { type: 'boolean' },
                thursday: { type: 'boolean' },
                friday: { type: 'boolean' },
                saturday: { type: 'boolean' },
                sunday: { type: 'boolean' }
              }
            }
          }
        },
        required: ['mowerId', 'schedule']
      },
      async handler({ mowerId, schedule }) {
        const success = await dataService.updateMowerSchedule(mowerId, schedule);
        return { success };
      }
    },
    
    {
      name: 'startMower',
      description: 'Start the mower and begin mowing',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to start'
          },
          duration: {
            type: 'integer',
            description: 'Optional duration in minutes to mow for'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId, duration }) {
        await husqvarnaApi.sendCommand(mowerId, 'start', duration || 240);
        return { success: true, message: "Mower started successfully" };
      }
    },
    
    {
      name: 'parkMower',
      description: 'Park the mower at the charging station',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to park'
          },
          untilNext: {
            type: 'boolean',
            description: 'If true, parks until next scheduled time'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId, untilNext }) {
        const command = untilNext ? 'parkUntilNext' : 'park';
        await husqvarnaApi.sendCommand(mowerId, command);
        return { success: true, message: `Mower is returning to charging station${untilNext ? ' until next scheduled time' : ''}` };
      }
    },
    
    {
      name: 'getMowerLocation',
      description: 'Get the current location of the mower and recent history',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to get location for'
          },
          historyHours: {
            type: 'integer',
            description: 'Number of hours of history to include'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId, historyHours }) {
        const positionData = await dataService.getMowerPositionHistory(mowerId, historyHours || 24);
        return { 
          currentPosition: positionData.current,
          history: positionData.history
        };
      }
    },
    
    {
      name: 'getErrorHistory',
      description: 'Get the error history for a mower',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to get errors for'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId }) {
        const errorHistory = await dataService.getMowerErrorHistory(mowerId);
        return { errorHistory };
      }
    },
    
    {
      name: 'pauseMower',
      description: 'Pause the currently running mower',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to pause'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId }) {
        await husqvarnaApi.sendCommand(mowerId, 'pause');
        return { success: true, message: "Mower paused successfully" };
      }
    },
    
    {
      name: 'resumeSchedule',
      description: 'Resume the normal mowing schedule',
      parameters: {
        type: 'object',
        properties: {
          mowerId: {
            type: 'string',
            description: 'The ID of the mower to resume schedule for'
          }
        },
        required: ['mowerId']
      },
      async handler({ mowerId }) {
        await husqvarnaApi.sendCommand(mowerId, 'resume');
        return { success: true, message: "Resumed normal mowing schedule" };
      }
    },
    
    {
      name: 'getUserMowers',
      description: 'Get the list of mowers associated with the user',
      parameters: {
        type: 'object',
        properties: {}
      },
      async handler() {
        const mowers = await dataService.getAllMowersData();
        return { 
          mowers: mowers.map(m => ({
            id: m.id,
            name: m.system.name,
            model: m.system.model
          }))
        };
      }
    }
  ]
});

export default server;
```

### 3. Create the HTTP Server for MCP

Create a new file `src/app/api/mcp/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import mcpServer from '@/mcp-server';

export async function POST(request: NextRequest) {
  try {
    const requestJson = await request.json();
    
    // Handle the MCP request
    const response = await mcpServer.handleRequest(requestJson);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in MCP server:', error);
    return NextResponse.json(
      { error: 'MCP server error', details: error.message },
      { status: 500 }
    );
  }
}
```

### 4. Integrate MCP Client in Chat Interface

Create `src/components/ChatMCPProvider.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import { useMowerData } from '@/contexts/MowerDataContext';
import { McpClient } from '@anthropic-ai/mcp-sdk/client';

interface ChatMCPProviderProps {
  children: React.ReactNode;
}

export default function ChatMCPProvider({ children }: ChatMCPProviderProps) {
  const mcpClientRef = useRef<McpClient | null>(null);
  const { mowers } = useMowerData();
  
  useEffect(() => {
    // Initialize MCP client when component mounts
    const initMcpClient = async () => {
      if (mcpClientRef.current) return;
      
      mcpClientRef.current = new McpClient({
        transportUrl: '/api/mcp',
        onConnect: () => {
          console.log('MCP client connected');
        },
        onDisconnect: () => {
          console.log('MCP client disconnected');
        },
        onError: (error) => {
          console.error('MCP client error:', error);
        }
      });
      
      // Connect to the MCP server
      await mcpClientRef.current.connect();
      
      // Make the MCP client available to the chat interface
      window.mcpClient = mcpClientRef.current;
    };
    
    initMcpClient();
    
    // Cleanup on unmount
    return () => {
      if (mcpClientRef.current) {
        mcpClientRef.current.disconnect();
        mcpClientRef.current = null;
      }
    };
  }, []);
  
  // Expose which mowers are available to the chat interface
  useEffect(() => {
    if (mcpClientRef.current && mowers.length > 0) {
      // Store mower info in a global context for the chat to access
      window.availableMowers = mowers.map(m => ({
        id: m.id,
        name: m.system?.name || 'Unknown mower',
        model: m.system?.model || 'Unknown model'
      }));
    }
  }, [mowers]);
  
  return <>{children}</>;
}
```

### 5. Update the Chat Component

Modify `src/components/MowerChat.tsx` to integrate MCP:

```typescript
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendIcon } from 'lucide-react';
import { useMowerData } from '@/contexts/MowerDataContext';

export default function MowerChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { mowers } = useMowerData();
  const chatEndRef = useRef(null);
  
  // Automatically scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // Send to backend which handles the AI + MCP
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          availableMowers: window.availableMowers || []
        }),
      });
      
      const data = await response.json();
      
      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Ask me anything about your mower!</p>
            <p className="text-sm mt-2">For example:</p>
            <ul className="text-sm mt-1 space-y-1">
              <li>"What's the battery level of my mower?"</li>
              <li>"Start mowing now for 2 hours"</li>
              <li>"Show me my current mowing schedule"</li>
              <li>"Park the mower until tomorrow"</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex space-x-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your mower..."
            disabled={isProcessing}
          />
          <Button type="submit" size="icon" disabled={isProcessing}>
            {isProcessing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### 6. Create the Chat API Endpoint

Create a new file `src/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Claude } from '@anthropic/sdk';
import { McpClient } from '@anthropic-ai/mcp-sdk/client';

// Initialize Claude client
const claude = new Claude({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, availableMowers } = await request.json();
    
    // Create a new MCP client for this request
    const mcpClient = new McpClient({
      transportUrl: process.env.NEXT_PUBLIC_URL + '/api/mcp'
    });
    
    await mcpClient.connect();
    
    // Create the system prompt with mower context
    const systemPrompt = `You are an assistant for a robotic lawn mower system.
You can control and check the status of the user's mowers.

Available mowers:
${availableMowers.map(m => `- ${m.name} (ID: ${m.id}, Model: ${m.model})`).join('\n')}

The user might refer to their mower by name rather than ID. If they do, use the correct mower ID for API calls.
If the user has only one mower, you can assume they're referring to that mower.
If they have multiple mowers and don't specify which one, ask them to clarify.

Use the provided tools to:
- Check mower status and battery level
- Start, pause, and park mowers
- Schedule mowing activities
- Check and modify mowing schedules
- Get mower location and error history

Respond conversationally and concisely. For status updates, always include key information like battery level and current activity.`;
    
    // Call Claude with MCP
    const response = await claude.messages.create({
      model: 'claude-3-opus-20240229',
      system: systemPrompt,
      messages,
      tools: mcpClient.getTools(),
      max_tokens: 1000,
    });
    
    // Disconnect MCP client
    await mcpClient.disconnect();
    
    return NextResponse.json({
      message: response.content[0].text
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Chat processing error', details: error.message },
      { status: 500 }
    );
  }
}
```

### 7. Add Method for Position History

Add a new method to MowerDataService:

```typescript
/**
 * Get position history for a mower over a specific time period
 */
async getMowerPositionHistory(mowerId: string, hours: number = 24): Promise<any> {
  try {
    // Get current timestamp
    const now = new Date();
    const hoursAgo = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    // Query position data from Firebase
    if (db) {
      const positionsRef = collection(db, MOWERS_COLLECTION, mowerId, 'positions');
      const q = query(
        positionsRef,
        where('timestamp', '>=', hoursAgo),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // Format position data
      const positions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp.toDate()
        };
      });
      
      // Get the most recent position as current
      const current = positions.length > 0 ? positions[0] : null;
      
      return {
        current,
        history: positions
      };
    }
    
    // If no Firebase or no data, fall back to API
    const mowerData = await husqvarnaApi.getMower(mowerId);
    if (mowerData?.attributes?.positions?.[0]) {
      const currentPosition = {
        latitude: mowerData.attributes.positions[0].latitude,
        longitude: mowerData.attributes.positions[0].longitude,
        timestamp: new Date()
      };
      
      return {
        current: currentPosition,
        history: [currentPosition]
      };
    }
    
    return { current: null, history: [] };
  } catch (error) {
    console.error(`Error getting position history for mower ${mowerId}:`, error);
    return { current: null, history: [] };
  }
}
```

## Testing

1. **Local Development Testing**

Start the development server:

```bash
npm run dev
```

Test your chatbot with example queries:
- "What's the status of my mower?"
- "Start mowing now for 2 hours"
- "When is my next scheduled mow?"
- "Park the mower at the charging station"

2. **Debugging Tools**

Add logging to the MCP server:

```typescript
// Add to handleRequest method
console.log('MCP request:', JSON.stringify(requestJson, null, 2));
console.log('MCP response:', JSON.stringify(response, null, 2));
```

## Deployment

1. **Environment Variables**

Ensure these variables are set in your environment:
- `ANTHROPIC_API_KEY` - API key for Claude
- `NEXT_PUBLIC_URL` - Public URL of your application

2. **Update build scripts**

Update your start-servers.bat to include MCP startup:

```batch
@echo off
echo --------------------------------------------------------
echo Starting Robotic Mower Agent servers...
echo --------------------------------------------------------
echo This will start:
echo 1. WebSocket Proxy (for real-time mower updates)
echo 2. Next.js Development Server (with MCP enabled)
echo --------------------------------------------------------
echo.

rem Start all servers
start "WebSocket Proxy" npm run proxy
start "Next.js" npm run dev
```

## Future Enhancements

1. **MCP Security**
   - Add authentication to MCP endpoints
   - Implement user-specific permissions

2. **Additional Tools**
   - Work area management
   - Stay-out zone configuration
   - Statistical analysis of mowing patterns

3. **Extensions**
   - Integrate with weather services to suggest optimal mowing times
   - Connect to smart home systems for coordinated automation

## Conclusion

This implementation creates a powerful natural language interface for controlling your robotic mower. The MCP architecture gives us the flexibility to extend capabilities while maintaining a simple user experience through the chatbot interface.

Happy mowing! 