# Husqvarna Automower Integration

A comprehensive solution for connecting to the Husqvarna Automower Connect API and controlling robotic mowers.

## Quick Start

1. Set environment variables:
   ```
   HUSQVARNA_API_KEY=your_api_key
   HUSQVARNA_TOKEN=your_token
   ```

2. Use Firebase functions to interact with mowers:
   - Regular sync runs every 6 hours
   - Manual sync available via callable function
   - Commands available via callable function

## Key Features

- **Complete API Coverage**: Full implementation of all Husqvarna Automower Connect API endpoints
- **Firebase Integration**: Securely store and sync mower data in Firebase
- **Client-Server Architecture**: Separate API access from client applications
- **TypeScript Interfaces**: Strong typing for all API data and operations

## Architecture Overview

```
Client App → Firebase → Firebase Functions → Husqvarna API → Mower
```

## Documentation

For detailed documentation, see:

- [API Integration Guide](docs/HUSQVARNA_API_INTEGRATION.md) - Details on authentication and endpoints
- [Architecture Overview](docs/HUSQVARNA_API_ARCHITECTURE.md) - Visual diagrams of the system
- [API Client Types](src/api/types.ts) - TypeScript interfaces for all data structures

## Command Reference

| Command | Description | Parameters |
|---------|-------------|------------|
| `Start` | Start mowing | `duration`: minutes |
| `StartInWorkArea` | Start in a specific area | `workAreaId`, `duration` |
| `ResumeSchedule` | Resume regular schedule | None |
| `Pause` | Pause mower | None |
| `Park` | Park for a duration | `duration`: minutes |
| `ParkUntilNextSchedule` | Park until next scheduled time | None |
| `ParkUntilFurtherNotice` | Park indefinitely | None |

## Error Codes

The integration includes a comprehensive mapping of all 100+ Husqvarna error codes to human-readable descriptions, automatically displayed in the client application.

## Firebase Functions

### syncHusqvarnaMowers
- Runs every 6 hours
- Updates all mower data in Firestore
- Handles retry logic and error handling

### manualSyncMowers
- Callable function to trigger immediate sync
- Can sync a specific mower or all mowers
- Useful for testing or after schedule changes

### sendMowerCommand
- Callable function to send commands to mowers
- Updates Firestore with new state after command
- Requires authenticated users 