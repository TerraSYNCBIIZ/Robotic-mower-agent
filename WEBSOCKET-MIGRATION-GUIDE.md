# WebSocket Migration Guide

This guide will help you migrate from the Firebase Functions-based WebSocket implementation to the new WebSocket proxy.

## Step 1: Clean Up Old Implementation

We've provided a script to help clean up the old WebSocket implementation files. To run it:

```powershell
.\clear-old-websocket.ps1
```

This script will:
1. Create backups of all old WebSocket files
2. Ask for confirmation before removing them
3. Remove the files after confirmation

## Step 2: Install Dependencies

Make sure you have the required dependencies installed:

```powershell
# Install proxy dependencies
cd websocket-proxy && npm install

# Install main app dependencies
cd .. && npm install
```

## Step 3: Update Component Imports

If you have components that imported the old WebSocket services, update them to use the new proxy service:

```typescript
// OLD
import webSocketManager from '@/services/husqvarnaWebSocket';
// or
import clientWebSocketService from '@/services/clientWebSocketService';

// NEW
import proxyWebSocketService from '@/services/proxyWebSocketService';
```

The API for proxyWebSocketService is similar to the old services, but with improved reliability.

## Step 4: Start the App with Proxy

To start both the application and the WebSocket proxy:

```powershell
.\start-with-proxy.ps1
```

This script will:
1. Kill any processes using ports 3000 and 8080
2. Set up environment variables if needed
3. Start the WebSocket proxy in a separate terminal
4. Start the main application

## Step 5: Verify the Connection

1. Navigate to the WebSocket proxy status page:
```
http://localhost:3000/websocket-proxy
```

2. Check that the connection is successful.

3. Verify your mower data is being updated correctly.

## Common Migration Issues

### Missing Events

If your component relied on specific event names from the old WebSocket implementation, you may need to update them:

| Old Event | New Event |
|-----------|-----------|
| `sent-to-firebase` | `sent-to-data` |
| `message` | `message` (unchanged) |
| `status-change` | `status-change` (unchanged) |
| `error` | `error` (unchanged) |

### Command Structure

The command structure for sending commands to mowers is now:

```typescript
proxyWebSocketService.sendCommand(mowerId, action, parameters);

// Example:
proxyWebSocketService.sendCommand('mower-id-123', 'START', { duration: 60 });
```

### Reconnection Logic

The new proxy service handles reconnection automatically. If you need to manually reconnect:

```typescript
// To reconnect to the proxy:
proxyWebSocketService.connect();

// To tell the proxy to reconnect to Husqvarna:
proxyWebSocketService.requestReconnect();
```

## Troubleshooting

If you encounter issues:

1. Check the WebSocket proxy logs in its terminal window
2. Visit the WebSocket proxy status page for detailed connection information
3. Make sure your Husqvarna API credentials are correct in both `.env.local` and `websocket-proxy/.env`

## Need Help?

If you have trouble with the migration, consult the documentation:
- `websocket-proxy/README.md`
- `WEBSOCKET-PROXY-PLAN.md` 