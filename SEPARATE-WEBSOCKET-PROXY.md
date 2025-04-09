# Running the WebSocket Proxy Separately

This guide explains how to run the WebSocket proxy as a separate service from the main Next.js application.

## Overview

The WebSocket proxy is now designed to run as a separate Node.js service that handles all communication with the Husqvarna WebSocket API. The benefits of this approach include:

1. **No Timeout Limitations**: The proxy runs as a persistent process without the 9-minute timeout constraints of Firebase Functions
2. **Better Debugging**: Direct access to logs and connection status
3. **Simplified Architecture**: Clear separation between the WebSocket connection and your Next.js application

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Husqvarna API credentials (API Key, Client ID, Client Secret)
- Firebase service account (optional, for data storage)

## Setup Instructions

### Step 1: Configure Environment Variables

Create a `.env` file in the `websocket-proxy` directory with your credentials:

```
# Husqvarna API credentials
HUSQVARNA_API_KEY=your_api_key_here
HUSQVARNA_CLIENT_ID=your_client_id_here
HUSQVARNA_CLIENT_SECRET=your_client_secret_here

# Firebase configuration
FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json

# Server configuration
PORT=8080

# Enable for debugging
# DEBUG=true
```

You can copy the template from `.env.example` in the same directory.

### Step 2: Install Dependencies

Install the WebSocket proxy dependencies:

```bash
cd websocket-proxy
npm install
```

### Step 3: Start the WebSocket Proxy

You can run the WebSocket proxy directly:

```bash
cd websocket-proxy
npm start
```

Or from the root of the project:

```bash
npm run proxy
```

### Step 4: Start the Next.js Application

In a separate terminal, start the Next.js application:

```bash
npm run dev
```

## Testing the Connection

1. First, make sure the WebSocket proxy is running on port 8080
2. Start the Next.js application on port 3000
3. Visit the WebSocket proxy status page at http://localhost:3000/websocket-proxy
4. Verify that the connection is established

## Troubleshooting

### WebSocket Proxy Not Starting

- Check that port 8080 is available
- Verify your Husqvarna API credentials in the `.env` file
- Look for error messages in the WebSocket proxy terminal

### Connection Issues from Next.js App

- Make sure the WebSocket proxy is running
- Check browser console for WebSocket connection errors
- Try manually reconnecting from the WebSocket proxy page

### Firebase Integration Issues

- Verify that your Firebase service account file exists and is properly formatted
- Check that the path in `FIREBASE_SERVICE_ACCOUNT_PATH` is correct

## Monitoring and Logs

The WebSocket proxy includes detailed logging. You can enable debug mode by setting `DEBUG=true` in the `.env` file.

The proxy also provides a health check endpoint at:

```
http://localhost:8080/health
```

This returns a JSON object with the current status of the proxy.

## Production Deployment

For production, you'll need to:

1. Deploy the WebSocket proxy as a standalone Node.js service
2. Configure your Next.js application to connect to the deployed proxy
3. Update the `url` in `proxyWebSocketService.ts` to point to your deployed proxy

## Architecture Diagram

```
┌─────────────┐     ┌─────────────┐     ┌────────────────┐
│ Next.js App │◄────►WebSocket Proxy◄────►Husqvarna API WS│
└─────────────┘     └─────────────┘     └────────────────┘
       ▲                   ▲
       │                   │
       ▼                   ▼
┌─────────────────────────────────────┐
│           Firebase Firestore         │
└─────────────────────────────────────┘
```

## Command Reference

| Command | Description |
|---------|-------------|
| `npm run proxy` | Start the WebSocket proxy |
| `npm run dev` | Start the Next.js application |
| `npm run kill-ports` | Kill processes on ports 3000 and 8080 | 