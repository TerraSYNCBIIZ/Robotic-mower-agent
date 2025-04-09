# Real-time WebSocket Connection Guide

This guide explains how to set up and troubleshoot the real-time WebSocket connection with the Husqvarna API.

## Overview

The application now supports automatic token generation and management for WebSocket connections to the Husqvarna API. This allows for real-time updates from your mower to be stored in Firebase.

## How It Works

1. **Connection Flow**:
   - The app attempts to connect using the real WebSocket API
   - It automatically generates a token using your API key and secret
   - If successful, real-time data is stored in Firebase
   - In development, it falls back to the mock WebSocket if the real connection fails

2. **Required Environment Variables**:
   - `HUSQVARNA_API_KEY`: Your API key from Husqvarna Developer Portal
   - `HUSQVARNA_SECRET`: Your client secret from Husqvarna Developer Portal
   - `HUSQVARNA_TOKEN` (optional): Pre-generated token (will auto-generate if missing)

3. **Data Flow**:
   - WebSocket receives real-time updates from Husqvarna API
   - Updates are processed and throttled to avoid excessive database writes
   - Processed data is stored in Firebase Firestore
   - UI components react to Firestore data changes

## Setup Instructions

1. **Update Environment Variables**:
   - In `.env.local`, add your Husqvarna API credentials:
   ```
   HUSQVARNA_API_KEY=your_api_key_here
   HUSQVARNA_SECRET=your_client_secret_here
   ```

2. **Test the WebSocket Connection**:
   - Go to http://localhost:3000/websocket-test
   - Click "Test Real WebSocket (Auto Token)"
   - Look for success message or detailed error information

3. **Verify Data in Firebase**:
   - Open Firebase Console
   - Check Firestore database for mower data
   - Look for collections: `mowers`, `system`, and `logs`

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify your API key and secret are correct
   - Check if your Husqvarna Developer account is active
   - Test the authentication using the test page

2. **WebSocket Connection Issues**:
   - WebSocket status shows "Disconnected"
   - Check browser console for detailed error messages
   - Try the manual reconnect button in the WebSocket status component

3. **No Data in Firebase**:
   - Check WebSocket status - should show "Connected"
   - Verify Firebase permissions are set correctly
   - Check if your mower is online and reporting data

### Testing Tools

- **WebSocket Test Page**: http://localhost:3000/websocket-test
  - "Test Real WebSocket (Auto Token)": Uses API key & secret to generate token
  - "Connect WebSocket": Uses Firebase callable function
  - "Connect via Local API": Uses the local API endpoint
  - "Connect via Mock": Uses the mock WebSocket (development only)

- **API Test Endpoint**: http://localhost:3000/api/websocket/test
  - Tests token generation and validation
  - Tests WebSocket connection
  - Returns detailed diagnostic information

## Switching Between Real and Mock

The system automatically tries the real WebSocket first, then falls back to the mock in development mode.

- In **production**: Only real WebSocket is used
- In **development**: Falls back to mock if real connection fails
- **Force mock**: Use the "Connect via Mock" button on the test page

## Monitoring WebSocket Status

The application includes components to monitor WebSocket status:

1. **WebSocket Status Page**: Full monitoring dashboard with logs
2. **MiniWebSocketStatus**: Small indicator with reconnect button

## Advanced: Manual Token Management

If you need to use a pre-generated token:

1. Obtain a token from Husqvarna API
2. Set `HUSQVARNA_TOKEN` in your `.env.local` file
3. Restart the application

Note: The system will still validate the token and auto-refresh if it's invalid. 