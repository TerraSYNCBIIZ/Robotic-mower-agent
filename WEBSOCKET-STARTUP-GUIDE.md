# Husqvarna WebSocket Integration Startup Guide

This guide provides instructions for running the Robotic Mower Agent application with the WebSocket integration.

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Firebase project configured for WebSocket data storage

## Environment Variables

Make sure your `.env.local` file includes the following variables:

```
# Husqvarna API credentials
HUSQVARNA_TOKEN=your_token_here
HUSQVARNA_API_KEY=your_api_key_here

# Firebase configuration 
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
```

## Starting the Application

### Option 1: Safe Start (Recommended)

This option automatically kills any processes using ports 3000/3001, cleans the build cache, and starts the application:

```bash
npm run dev:safe
```

### Option 2: Normal Start

Start the application normally on port 3001:

```bash
npm run dev
```

### Option 3: Clean Start

Remove the `.next` directory before starting to fix build errors:

```bash
npm run dev:clean
```

## Troubleshooting

### Port Already in Use

If you see "EADDRINUSE" errors, try the following:

1. Run the port killer script:
   ```bash
   npm run kill-ports
   ```

2. Then start the application again:
   ```bash
   npm run dev
   ```

### Missing .next Files

If you see errors about missing files in the `.next` directory, clean the build cache:

```bash
rm -rf .next
# or
npm run dev:clean
```

### WebSocket Connection Issues

If the WebSocket connection isn't established automatically:

1. Go to the WebSocket Status page
2. Click the "Reconnect" button
3. Check the logs for any error messages

## WebSocket Components

The application includes the following WebSocket-related components:

- `WebSocketStatus.tsx` - Full WebSocket status monitor
- `MiniWebSocketStatus.tsx` - Compact status indicator
- `ServiceInitializer.tsx` - Auto-initializes the WebSocket connection on app start

## Firebase Functions

The WebSocket connection is managed through Firebase Functions:

- `initiateWebSocketConnection` - Callable function to start the WebSocket

## Data Flow

1. WebSocket connects to Husqvarna API
2. Real-time mower data is received via WebSocket events 
3. Data is processed and throttled to avoid excessive updates
4. Processed data is stored in Firebase Firestore
5. UI components subscribe to Firestore data changes
6. WebSocket status is monitored in the WebSocket Status UI 