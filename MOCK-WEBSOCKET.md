# Mock WebSocket for Development

This document explains the mock WebSocket implementation added for development purposes.

## What is the Mock WebSocket?

The mock WebSocket service simulates a WebSocket connection without actually connecting to the Husqvarna API. This is useful for development and testing when:

1. You don't have valid Husqvarna API credentials 
2. You want to develop locally without making real API calls
3. You're experiencing CORS or network issues with the real WebSocket

## How it Works

The mock WebSocket service:

1. Simulates connection/disconnection events
2. Reports connection status to the UI
3. Automatically times out after 5 minutes (to simulate real WebSocket behavior)
4. Works entirely client-side (no server communication needed)

## How to Use

In development mode (when running `npm run dev`), the application will:

1. **Automatically use the mock WebSocket** when real connections fail
2. Show a "Connect via Mock" button on the WebSocket test page
3. Display mock connection status in the UI just like a real connection

You can test the mock WebSocket explicitly by:

1. Going to http://localhost:3000/websocket-test
2. Clicking the "Connect via Mock (Dev Only)" button
3. Observing the simulated connection status

## Implementation Details

The mock WebSocket implementation includes:

1. **`mockWebSocketService.ts`**: Main service that simulates WebSocket behavior
2. **`/api/websocket/mock-connect/route.ts`**: Mock API endpoint for simulated connections
3. Updates to UI components to handle both real and mock connections

## Switching Between Mock and Real

The application tries connection methods in this order:

1. Mock WebSocket (in development)
2. Local API WebSocket endpoint  
3. Firebase function WebSocket
4. Fallback to mock (in development)

In production builds, the mock WebSocket is not included, ensuring real connections are always used in production environments.

## Developing with the Mock WebSocket

When developing new features that depend on WebSocket:

1. **Status**: The `WebSocketStatus` and `MiniWebSocketStatus` components work with both real and mock WebSockets
2. **Reconnection**: The reconnection functionality works for both real and mock connections
3. **Time-Based Effects**: The mock service will simulate a disconnection after 5 minutes

This allows you to develop and test WebSocket-dependent features without having working API credentials or network connectivity.

## Troubleshooting

If you see errors even with the mock WebSocket:

1. Make sure you're running in development mode
2. Try manually connecting via the WebSocket test page
3. Check the console for any mock service-specific errors
4. Ensure the `mockWebSocketService.ts` file is correctly imported

For persistent issues, you can modify the `mockWebSocketService.ts` file to adjust simulation behavior. 