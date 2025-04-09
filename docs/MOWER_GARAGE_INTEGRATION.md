# Robotic Mower Garage Integration

## Overview

This document outlines the integration between a robotic mower garage system and the Husqvarna Automower API. The system automatically controls the garage door based on the mower's status:

- Opens when mower is returning home
- Opens when mower is at the charging station
- Closes in all other states

## Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌───────────────────────┐
│                 │     │                   │     │                       │
│  React Client   │◄───►│  Firebase Backend │◄───►│  Firebase Functions   │
│  Application    │     │   (Firestore DB)  │     │                       │
│                 │     │                   │     │                       │
└─────────────────┘     └───────────────────┘     └───────────┬───────────┘
                                │                             │
                                │                             │ API Calls
                                │                             ▼
                                │               ┌────────────────────────────┐
                                │               │                            │
                                │               │  Husqvarna Automower API   │
                                │               │                            │
                                │               └────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────┐
│                                               │
│           Garage Controller System            │
│  (Arduino/Raspberry Pi with WiFi connection)  │
│                                               │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────┐
│                                               │
│              Garage Door Motor                │
│                                               │
└───────────────────────────────────────────────┘
```

## Implementation Requirements

### 1. Hardware Requirements

- Microcontroller (Arduino/Raspberry Pi/ESP32)
- WiFi capability for cloud connectivity
- Relay module to control garage door motor
- Power supply
- Door position sensors (optional)

### 2. Firebase Integration

#### Firestore Listener Setup

The garage controller will need to:

1. Connect to Firebase using Firebase SDK
2. Listen to the mower status document for real-time updates:

```javascript
// Path to the mower's status document
const mowerStatusRef = db.collection('mowers').doc(mowerId).collection('status');

// Set up real-time listener
mowerStatusRef.onSnapshot((snapshot) => {
  const data = snapshot.data();
  
  // Check if mower is returning home or at charging station
  if (data.activity === 'GOING_HOME' || 
      (data.activity === 'CHARGING' && data.state === 'IN_OPERATION')) {
    openGarageDoor();
  } else {
    closeGarageDoor();
  }
});
```

### 3. Controller Software

The garage controller software should:

1. Establish secure connection to Firebase
2. Authenticate using Firebase Auth
3. Listen for status changes in the mower document
4. Control the garage door relay based on mower status
5. Implement basic error handling and reconnection logic
6. Provide simple status indicators (LED, display, etc.)

### 4. Garage Door Control Logic

```
Mower status check (every time status updates):
  IF mower.activity == "GOING_HOME" OR 
     (mower.activity == "CHARGING" AND mower.state == "IN_OPERATION"):
    OpenGarageDoor()
  ELSE:
    CloseGarageDoor()
```

### 5. Security Considerations

- Use service account credentials for Firebase authentication
- Store credentials securely on the controller
- Implement rate limiting for door operations
- Add manual override capability

## Implementation Steps

1. **Set up Firebase Project Access**
   - Create a service account for garage controller
   - Generate and securely store credentials
   - Set appropriate Firestore read permissions

2. **Configure Hardware**
   - Wire microcontroller to relay module
   - Connect relay to garage door motor circuit
   - Set up power supply and WiFi connectivity

3. **Develop Controller Software**
   - Implement Firebase SDK integration
   - Create real-time listener for mower status
   - Develop door control logic
   - Add error handling and recovery

4. **Testing and Validation**
   - Verify status change detection
   - Test door operation reliability
   - Ensure proper error handling
   - Validate security measures

5. **Production Deployment**
   - Weather-proof the installation
   - Document wiring and configuration
   - Create backup/manual controls

## Alternative Implementation

If direct Firebase integration is challenging, an alternative approach would be to create a dedicated Firebase Function that monitors mower status and exposes a simple API endpoint for the garage controller to poll:

```javascript
// Firebase Function
exports.getGarageDoorCommand = functions.https.onRequest(async (req, res) => {
  const mowerId = req.query.mowerId;
  const mowerStatus = await db.collection('mowers').doc(mowerId).get();
  const data = mowerStatus.data();
  
  const shouldBeOpen = data.activity === 'GOING_HOME' || 
                       (data.activity === 'CHARGING' && data.state === 'IN_OPERATION');
  
  res.json({
    doorCommand: shouldBeOpen ? 'OPEN' : 'CLOSE',
    mowerStatus: data.activity,
    timestamp: new Date().toISOString()
  });
});
```

The garage controller would then periodically call this endpoint to determine door state.

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Door doesn't respond to status changes | Firebase connection lost | Implement auto-reconnect and verify WiFi signal strength |
| Excessive door operations | Status fluctuations | Add debounce logic (wait 30 seconds before changing door state again) |
| System not responding | Power issues | Ensure reliable power to controller and add backup battery |
| Incorrect door behavior | Misinterpreted status codes | Verify status mapping and update controller logic | 