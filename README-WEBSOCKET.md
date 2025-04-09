# Husqvarna WebSocket Integration Guide

This README explains how to use the WebSocket integration with the Husqvarna API.

## Quick Start

The simplest way to start the application with WebSocket support:

```powershell
# In PowerShell:
.\start-mower-agent.ps1
```

This script will:
1. Kill any processes using ports 3000/3001
2. Clean the Next.js build cache
3. Install dependencies if needed
4. Start the application on port 3001

## WebSocket Features

The WebSocket integration provides real-time updates from Husqvarna mowers, including:

- Battery status
- Current mode and activity
- Position updates
- Error codes with descriptions
- Statistics and settings

## WebSocket Status UI

The application includes two components to monitor WebSocket status:

1. **Full Status Monitor**: Displays connection status, reconnection attempts, and recent logs
2. **Mini Status Indicator**: Compact indicator that can be embedded in other UI components

## Troubleshooting

### Port Conflicts

If you see "EADDRINUSE" errors indicating port 3000 is already in use:

```powershell
# Kill processes using port 3000
npm run kill-ports
```

### Build Errors

If you see errors related to missing files in the `.next` directory:

```powershell
# Remove the .next directory
Remove-Item -Recurse -Force .next

# Then start the application
npm run dev
```

### WebSocket Connection Issues

If the WebSocket doesn't connect automatically:

1. Check the Firebase configuration in `.env.local`
2. Visit the WebSocket Status page in the app
3. Click the "Reconnect" button
4. Check logs for detailed error messages

## Manual Connection

You can manually initiate the WebSocket connection from the WebSocket Status UI by clicking the "Reconnect" button.

## WebSocket Connection Lifecycle

1. **Connection**: Established when the application starts via `ServiceInitializer.tsx`
2. **Monitoring**: Connection status stored in Firebase Firestore
3. **Auto-Reconnect**: Automatic reconnection on disconnection with exponential backoff
4. **Pre-emptive Reconnect**: Connection refreshed before the 2-hour API limit

## Data Processing

1. WebSocket receives real-time updates from Husqvarna API
2. Updates are throttled based on data type to prevent excessive database writes
3. Processed data is stored in Firebase Firestore
4. UI components react to Firestore data changes

## Architecture

The implementation consists of the following components:

1. **WebSocket Manager** (`src/services/husqvarnaWebSocket.ts`): Handles WebSocket connection lifecycle, message processing, and reconnection.

2. **Throttle Service** (`src/services/throttleService.ts`): Manages data throttling to prevent excessive database updates.

3. **Firebase Functions**:
   - **WebSocket Connector** (`src/firebase/websocketConnector.ts`): Initiates the WebSocket connection.
   - **WebSocket Monitor** (`src/firebase/websocketMonitor.ts`): Periodically checks WebSocket health and automatically initializes the connection when deployed.

4. **Error Codes** (`src/lib/errorCodes.ts`): Provides mappings for error codes to human-readable descriptions.

## Deployment Steps

1. Install dependencies:
   ```
   npm install ws @types/ws
   ```

2. Deploy Firebase functions:
   ```
   node deploy-firebase-functions.js
   ```
   Or manually:
   ```
   npm run build
   firebase deploy --only functions:initiateWebSocketConnection,functions:monitorWebSocketHealth
   ```

**Note:** The WebSocket connection is automatically initiated on deployment. You don't need to manually call the initiation function.

## Firebase Firestore Structure

The implementation uses the following Firestore collections:

- `mowers/{mowerId}`: Stores mower data including status, positions, settings, and statistics.
- `system/websocket`: Stores WebSocket connection status.
- `logs`: Stores error logs and connection events.

### Data Structure

WebSocket data is saved to Firestore in the same structure as the API sync function, ensuring consistency:

```
/mowers/{mowerId}/
  ├── id: string
  ├── system: { name, model, serialNumber }
  ├── status: {
  │     battery: number
  │     mode: string
  │     activity: string
  │     state: string
  │     errorCode: number
  │     errorDescription: string
  │     connected: boolean
  │     lastStatusUpdate: timestamp
  │   }
  ├── capabilities: { ... }
  ├── calendar: { tasks: [...] }
  ├── positions: [ {latitude, longitude}, ... ]
  ├── settings: { ... }
  ├── statistics: { ... }
  ├── lastUpdated: timestamp
```

## Features

- **Real-time Updates**: Receives mower updates in real-time.
- **Automatic Reconnection**: Reconnects before the 2-hour WebSocket limit.
- **Health Monitoring**: Monitors connection health and reconnects if needed.
- **Throttled Updates**: Prevents excessive database writes with configurable throttling.
- **Error Handling**: Comprehensive error logging and recovery.
- **Data Consistency**: Uses the same data structure as the API sync function.
- **Automatic Initialization**: WebSocket connection is automatically established upon deployment.

## Testing

The WebSocket connection is automatically established when the functions are deployed. To verify it's working:

1. Check the Firebase function logs to see the connection status:
   ```
   firebase functions:log
   ```
   You should see messages like "WebSocket connection initiated successfully on deployment".

2. Check the `system/websocket` document in Firestore to monitor connection status.

3. Verify data consistency by comparing WebSocket updates with API data:
   ```javascript
   // Listen for changes to mower data
   const mowerRef = db.collection('mowers').doc('your-mower-id');
   mowerRef.onSnapshot(snapshot => {
     const data = snapshot.data();
     console.log('Updated mower data:', data);
     console.log('Last updated:', data.lastUpdated.toDate());
   });
   ```

## Manual Connection (if needed)

If you need to manually initiate the connection (rarely necessary):

```javascript
const functions = firebase.functions();
const initiateWebSocket = functions.httpsCallable('initiateWebSocketConnection');
initiateWebSocket().then(result => {
  console.log('WebSocket initiated:', result.data);
});
```

## Troubleshooting

- **Connection Issues**: Check the logs collection in Firestore for error details.
- **Missing Data**: Verify that the mower is online and sending updates through the Husqvarna API.
- **Function Timeouts**: Firebase functions have a 9-minute timeout limit, so the WebSocket monitor will reconnect as needed.
- **Data Structure Mismatch**: If you notice differences between WebSocket updates and API sync data, check the `throttleService.ts` file for any discrepancies.
- **Initialization Failure**: If the automatic initialization fails, check the function logs and manually call the `initiateWebSocketConnection` function.

## Development

For local development and testing:

1. Use Firebase emulator: `firebase emulators:start`.
2. Monitor logs for WebSocket activity: `firebase functions:log`.
3. Test the local function with the Firebase shell: 
   ```
   firebase functions:shell
   initiateWebSocketConnection()
   ```

## Integration with API Sync

This WebSocket integration complements the existing API sync functions:

- **API Sync (`syncHusqvarnaMowers`)**: Runs every 6 hours, provides complete mower data.
- **WebSocket**: Provides real-time updates between API sync intervals.

Together they provide comprehensive data coverage with minimal API usage. 