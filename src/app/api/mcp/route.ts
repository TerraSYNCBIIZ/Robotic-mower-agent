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
      { error: 'MCP server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 