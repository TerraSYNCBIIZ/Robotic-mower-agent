# Husqvarna Automower WebSocket Events Reference

This document provides a detailed overview of the WebSocket events available through the Husqvarna Automower Connect WebSocket API, what data they contain, and how we can leverage this information in our application.

## WebSocket Connection

**Connection URL:** `wss://ws.openapi.husqvarna.dev/v1`

**Authentication:** JWT Bearer Token (same as REST API)

## Event Types Overview

The Husqvarna WebSocket API provides the following event types:

1. `battery-event-v2`: Battery status updates
2. `calendar-event-v2`: Calendar/schedule updates
3. `cuttingHeight-event-v2`: Cutting height changes
4. `headlights-event-v2`: Headlight mode changes
5. `message-event-v2`: New messages or alerts
6. `mower-event-v2`: Mower status changes
7. `planner-event-v2`: Planning information updates
8. `position-event-v2`: Position updates

## Event Payloads and Usage

### 1. Battery Event (`battery-event-v2`)

**Payload Structure:**
```json
{
  "id": "battery-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "batteryPercent": 85
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `batteryPercent`: Current battery level (0-100)

**Application Uses:**
- Real-time battery level indicators
- Charging status monitoring
- Low battery alerts
- Battery drain rate analysis
- Prediction of remaining operating time

### 2. Calendar Event (`calendar-event-v2`)

**Payload Structure:**
```json
{
  "id": "calendar-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "tasks": [
      {
        "start": 480,
        "duration": 120,
        "monday": true,
        "tuesday": true,
        "wednesday": true,
        "thursday": true,
        "friday": true,
        "saturday": false,
        "sunday": false
      }
    ]
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `tasks`: Array of scheduled mowing tasks
- `start`: Start time in minutes from midnight
- `duration`: Duration in minutes
- Day flags: Boolean values for each day of the week

**Application Uses:**
- Schedule visualization
- Next mowing session prediction
- Calendar integration 
- Schedule conflict detection
- Weekly coverage analysis

### 3. Cutting Height Event (`cuttingHeight-event-v2`)

**Payload Structure:**
```json
{
  "id": "cuttingHeight-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "cuttingHeight": 5
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `cuttingHeight`: Current cutting height setting (typically 1-9)

**Application Uses:**
- Cutting height visualization
- Season-appropriate recommendations
- Settings history tracking
- User preference learning

### 4. Headlights Event (`headlights-event-v2`)

**Payload Structure:**
```json
{
  "id": "headlights-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "mode": "ALWAYS_ON"
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `mode`: Current headlight mode (e.g., "ALWAYS_ON", "ALWAYS_OFF", "EVENING_ONLY")

**Application Uses:**
- Visibility status indication
- Power consumption analysis
- Night operation monitoring
- Settings synchronization

### 5. Message Event (`message-event-v2`)

**Payload Structure:**
```json
{
  "id": "message-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "message": {
      "id": "message-id-123",
      "level": "WARNING",
      "headline": "Mower lifted",
      "text": "The mower has been lifted. Enter PIN code to restart.",
      "datetime": "2023-05-31T14:25:16.000Z",
      "resolved": false
    }
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `message.level`: Severity level (INFO, WARNING, ERROR)
- `message.headline`: Short message description
- `message.text`: Detailed message
- `message.datetime`: When the message occurred
- `message.resolved`: Whether issue has been resolved

**Application Uses:**
- Real-time error notifications
- Alert system with severity levels
- Issue tracking and resolution
- Historical problem analysis
- Maintenance recommendations

### 6. Mower Status Event (`mower-event-v2`)

**Payload Structure:**
```json
{
  "id": "mower-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "mower": {
      "mode": "AUTO",
      "activity": "MOWING",
      "state": "IN_OPERATION",
      "errorCode": 0,
      "errorCodeTimestamp": null
    }
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `mower.mode`: Operating mode (AUTO, MANUAL, HOME, etc.)
- `mower.activity`: Current activity (MOWING, CHARGING, PARKED, etc.)
- `mower.state`: Current state (IN_OPERATION, RESTRICTED, STOPPED, etc.)
- `mower.errorCode`: Error code if any
- `mower.errorCodeTimestamp`: When error occurred

**Application Uses:**
- Real-time status dashboard
- Operation visualization
- Mode transitions tracking
- Error monitoring and analysis
- Activity duration analysis
- Operational health indicators

### 7. Planner Event (`planner-event-v2`)

**Payload Structure:**
```json
{
  "id": "planner-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "planner": {
      "nextStartTimestamp": "2023-05-31T16:00:00.000Z",
      "override": {
        "action": "NO_SOURCE"
      },
      "restrictedReason": "NONE"
    }
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `planner.nextStartTimestamp`: Next scheduled start time
- `planner.override`: Any override settings
- `planner.restrictedReason`: Reason if mower is restricted

**Application Uses:**
- Next mowing session prediction
- Schedule visualization
- Restriction monitoring
- Override status tracking
- Planning conflicts detection

### 8. Position Event (`position-event-v2`)

**Payload Structure:**
```json
{
  "id": "position-event-v2",
  "device": {
    "id": "12345678-1234-1234-1234-123456789012"
  },
  "data": {
    "position": {
      "latitude": 59.685506,
      "longitude": 17.939689
    }
  },
  "metadata": {
    "timestamp": "2023-05-31T14:25:16.000Z"
  }
}
```

**Key Data Points:**
- `position.latitude`: GPS latitude
- `position.longitude`: GPS longitude

**Application Uses:**
- Real-time position tracking
- Movement visualization
- Coverage mapping
- Path efficiency analysis
- Zone entry/exit detection
- Geofencing and security alerts

## Implementation Considerations

### 1. Event Processing Pipeline

To effectively handle WebSocket events, consider implementing the following pipeline:

1. **Event Reception**: Receive raw WebSocket messages
2. **Event Parsing**: Decode JSON and validate event structure
3. **Event Typing**: Categorize by event type
4. **Data Extraction**: Extract relevant data points
5. **State Management**: Update application state
6. **Persistence**: Store in appropriate database (real-time or time-series)
7. **Notification**: Trigger any necessary notifications
8. **UI Updates**: Refresh relevant UI components

### 2. Handling Connection Issues

WebSocket connections may drop due to various factors. Implement these strategies:

- Automatic reconnection with exponential backoff
- Heartbeat monitoring to detect silent failures
- Session resumption logic
- Fallback to REST API for critical functions during outages
- Connection status indicators in the UI

### 3. Data Storage Considerations

Different event types require different storage approaches:

- **Battery, Status, Messages**: Store latest state and historical changes
- **Position**: Efficient storage for high-frequency updates (consider downsampling)
- **Calendar, Settings**: Store only changes
- **Time correlation**: Ensure consistent timestamping for cross-event analysis

### 4. Performance Optimization

For large fleets or extended operation:

- Implement filtering to process only relevant events
- Use batched processing for historical data analysis
- Consider client-side data aggregation for analytics
- Implement data retention policies

## Example: Real-time Dashboard Processing

Here's a simplified example of how to process these events for a real-time dashboard:

```javascript
// Sample pseudocode for handling WebSocket events
websocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.id) {
    case 'battery-event-v2':
      updateBatteryIndicator(data.data.batteryPercent);
      storeBatteryHistory(data.device.id, data.data.batteryPercent, data.metadata.timestamp);
      break;
      
    case 'mower-event-v2':
      updateMowerStatus(data.data.mower);
      if (previousStatus !== data.data.mower.activity) {
        notifyStatusChange(data.data.mower.activity);
      }
      break;
      
    case 'position-event-v2':
      updateMapPosition(data.data.position);
      addToPathHistory(data.device.id, data.data.position, data.metadata.timestamp);
      checkGeofencing(data.data.position);
      break;
      
    case 'message-event-v2':
      if (data.data.message.level === 'ERROR' || data.data.message.level === 'WARNING') {
        triggerAlert(data.data.message);
      }
      logMessage(data.device.id, data.data.message);
      break;
  }
};
```

## Conclusion

The Husqvarna Automower WebSocket API provides a rich set of real-time events that enable advanced monitoring and control features. By properly handling these events, we can create a highly responsive and informative management system that provides users with immediate feedback and insights into their mower operations. 