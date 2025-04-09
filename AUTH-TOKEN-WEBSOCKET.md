# Authentication Token for WebSocket Connections

This guide explains how the WebSocket connection uses your Husqvarna authentication token.

## Overview

The WebSocket connection now uses your authentication token from your Husqvarna account login instead of trying to generate a token automatically. This approach:

1. **Uses your existing authentication** - The same token from your logged-in session
2. **Follows Husqvarna's intended API usage** - Using the OAuth token from user authentication
3. **Avoids permission issues** - User tokens have the proper permissions to access your mower data

## How It Works

1. When you log in to the application, you authenticate with Husqvarna and receive an access token
2. This token is stored in:
   - Browser localStorage (for client-side use)
   - Cookies (for server-side API routes)
3. When establishing the WebSocket connection:
   - The application retrieves your token from cookies
   - The token is passed to the WebSocket connection
   - Real-time mower data begins flowing through the WebSocket

## Connection Flow

1. **User Authentication** → Generates access token
2. **ServiceInitializer** → Initiates WebSocket connection with your token
3. **API Routes** → Server-side code establishes WebSocket using your token
4. **Real-time Data** → Flows through WebSocket to Firebase database

## Implementation Details

The implementation respects Husqvarna's authentication model:

- Uses `Authorization: Bearer <your-token>` header
- Adds `Authorization-Provider: husqvarna` header (required by Husqvarna)
- Automatically reconnects if disconnected
- Refreshes connection before the 2-hour token limit

## Development vs Production

- **In Production**: Only uses real authentication token from user login
- **In Development**: Falls back to mock WebSocket if authentication fails

## Troubleshooting

If the WebSocket connection fails:

1. **Check Authentication** - Ensure you are logged in with a valid Husqvarna account
2. **Check Token** - Your token may have expired; try logging out and back in
3. **Check Console** - Look for WebSocket-related error messages in the console
4. **Check Network** - Look for WebSocket connection attempts in the Network tab

## Manual Testing

You can manually test the WebSocket connection:

1. Log in to ensure you have a valid authentication token
2. Visit http://localhost:3000/websocket-test
3. Click "Test Real WebSocket (Auto Token)"
4. The test will use your authentication token to establish a connection

## Benefits Over Token Generation

Using your authentication token instead of generating one has several benefits:

1. **Proper Authorization** - Your token has the right permissions for your mowers
2. **Simplified Authentication** - No need for separate client credentials flow
3. **Follows API Guidelines** - Uses the authentication method recommended by Husqvarna
4. **Avoids Rate Limits** - Prevents API key throttling from token generation 