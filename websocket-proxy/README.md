# Husqvarna WebSocket Proxy

A dedicated Node.js server that provides a persistent WebSocket connection to the Husqvarna API, handling authentication, reconnection, and data synchronization.

## Overview

This proxy server solves several limitations with the previous Firebase Functions-based WebSocket implementation:

1. **No Timeout Limits**: Runs as a persistent process without the 9-minute timeout of Firebase Functions
2. **Improved Reliability**: Handles reconnection and token refresh automatically
3. **Better Debugging**: Provides direct access to logs and connection status
4. **Centralized Logic**: Manages WebSocket complexity in a dedicated service

## Setup Instructions

### Prerequisites

- Node.js >= 18
- npm or yarn
- Husqvarna API credentials (API Key, Client ID, Client Secret)
- Firebase service account (for data storage)

### Installation

1. Create a `.env` file in the `websocket-proxy` directory with the following variables:

```
HUSQVARNA_API_KEY=your_api_key
HUSQVARNA_CLIENT_ID=your_client_id
HUSQVARNA_CLIENT_SECRET=your_client_secret
FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-service-account.json
PORT=8080
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Architecture

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

### Components

1. **WebSocket Server**: Handles connections from client applications
2. **Husqvarna Client**: Maintains connection to Husqvarna WebSocket API
3. **Authentication Manager**: Handles OAuth token acquisition and refresh
4. **Data Processor**: Processes and throttles updates to Firebase
5. **Health Monitoring**: Provides status and diagnostic endpoints

## API

### Client Connections

Clients connect to the WebSocket proxy at:
- Development: `ws://localhost:8080`
- Production: Configure as needed for your deployment environment

### Message Types

**From Client to Proxy:**

```json
{
  "type": "command",
  "mowerId": "mower-id-123",
  "action": "START",
  "parameters": {
    "duration": 60
  }
}
```

```json
{
  "type": "reconnect"
}
```

**From Proxy to Client:**

```json
{
  "type": "status",
  "connected": true,
  "timestamp": "2023-05-25T12:34:56.789Z"
}
```

```json
{
  "type": "data",
  "data": {
    "id": "mower-id-123",
    "battery": 75,
    "mower": {
      "mode": "MAIN_AREA",
      "activity": "MOWING",
      "state": "IN_OPERATION"
    }
  }
}
```

```json
{
  "type": "error",
  "message": "Error description"
}
```

### HTTP Endpoints

- `GET /health`: Returns server status information

## Data Processing

The proxy processes different types of data with throttling to prevent excessive database writes:

- Status updates: Every 5 seconds
- Position updates: Every 10 seconds
- Statistics: Every 1 minute
- Settings: Every 1 minute
- Calendar: Every 1 hour

## Deployment

### Local Development

Run the server locally with:

```bash
npm run dev
```

### Production Deployment

Deploy as a standalone Node.js service using your preferred hosting method:

- PM2 on a VPS
- Docker container
- Heroku/Render/Railway
- Cloud Run

Example for PM2:

```bash
npm install -g pm2
pm2 start server.js --name husqvarna-ws-proxy
pm2 save
```

## Monitoring

The proxy includes a health endpoint that returns the current status:

```bash
curl http://localhost:8080/health
```

Response:

```json
{
  "status": "ok",
  "clients": 2,
  "connectedToHusqvarna": true
}
```

## Troubleshooting

If you encounter issues:

1. Check the server logs for error messages
2. Verify your Husqvarna API credentials
3. Ensure your Firebase service account has the correct permissions
4. Check the WebSocket status page in the main application 