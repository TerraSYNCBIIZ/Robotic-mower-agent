# Husqvarna API Integration Architecture

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Visual Diagram](#visual-diagram)
3. [Core Components](#core-components)
4. [Authentication Flow](#authentication-flow)
5. [Data Synchronization](#data-synchronization)
6. [Mower Control](#mower-control)

## Architecture Overview

Our Husqvarna Automower integration uses a Firebase-backed architecture to securely connect with the Husqvarna Automower Connect API. The system consists of:

1. **Client Application** - The React-based frontend displaying mower status and controls
2. **Firebase Backend** - Stores mower data and handles secure operations
3. **Firebase Functions** - Server-side code to sync data and send commands
4. **Husqvarna API Client** - TypeScript interface to the Husqvarna API

## Visual Diagram

```
┌─────────────────┐     ┌───────────────────┐     ┌───────────────────────┐
│                 │     │                   │     │                       │
│  React Client   │◄───►│  Firebase Backend │◄───►│  Firebase Functions   │
│  Application    │     │   (Firestore DB)  │     │                       │
│                 │     │                   │     │                       │
└─────────────────┘     └───────────────────┘     └───────────┬───────────┘
                                                              │
                                                              │ API Calls
                                                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                       Husqvarna Automower Connect API                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Husqvarna API Client (`src/api/`)

- **`husqvarnaApi.ts`** - Complete API client with all Husqvarna endpoints
- **`types.ts`** - TypeScript interfaces for all API data structures
- **`createHusqvarnaApi.ts`** - Factory function for creating API instances

### 2. Firebase Functions (`src/firebase/`)

- **`syncHusqvarnaMowers.ts`** - Scheduled and manual functions for data sync
  - Runs every 6 hours to update Firestore with latest mower data
  - Provides manual sync capability for immediate updates
  - Handles mower commands with pre/post-action data updates

### 3. Firebase Data Structure

Mower data is stored in Firestore with a clean, normalized structure:

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
  ├── planner: { ... }
  ├── positions: [ {latitude, longitude}, ... ]
  ├── settings: { ... }
  ├── statistics: { ... }
  ├── workAreas: [ ... ]
  ├── stayOutZones: [ ... ]
  ├── messages: [ ... ]
  └── lastUpdated: timestamp
```

## Authentication Flow

1. **OAuth 2.0 Authorization Code Flow**
   - Application redirects to Husqvarna login page
   - User authorizes access to their mowers
   - Husqvarna redirects back with authorization code
   - Server exchanges code for access and refresh tokens

2. **Token Management**
   - Access token used for all API requests
   - Refresh token used to generate new access tokens
   - Tokens stored securely in Firebase

## Data Synchronization

Our system uses two synchronization methods:

### 1. Scheduled Background Sync
```
┌───────────────────┐    ┌───────────────┐    ┌───────────────────┐
│ Firebase Function │    │               │    │                   │
│ (Runs every 6hrs) │───►│ Husqvarna API │───►│ Firestore Database│
└───────────────────┘    │               │    │                   │
                         └───────────────┘    └───────────────────┘
```

- **Schedule**: Runs every 6 hours (4 times daily)
- **Process**:
  1. Retrieves all mower data via Husqvarna API
  2. Transforms data to clean structure
  3. Stores in Firestore in a batch operation

### 2. Manual Sync (On-Demand)
- Triggered by user action or after command execution
- Updates a single mower or all mowers
- Same transformation and storage process

## Mower Control

Commands to mowers follow this flow:

```
┌─────────────┐    ┌─────────────────┐    ┌────────────────┐    ┌───────────────┐
│ User Action │───►│ Firebase Callable│───►│ Husqvarna API │───►│ Automower     │
│ (UI Button) │    │ Function         │    │ Command       │    │ (Physical)     │
└─────────────┘    └─────────────────┘    └────────────────┘    └───────────────┘
                           │                                            │
                           │                                            │
                           ▼                                            ▼
                   ┌────────────────┐                         ┌──────────────────┐
                   │ Update         │◄────────────────────────│ Status Change    │
                   │ Firestore Data │                         │ (API Response)   │
                   └────────────────┘                         └──────────────────┘
```

1. **Available Commands**:
   - Start (with duration)
   - Start in specific work area
   - Park (with duration)
   - Park until next scheduled task
   - Park indefinitely
   - Pause
   - Resume schedule

2. **Command Flow**:
   - User clicks command button in UI
   - Firebase callable function executes
   - Command sent to Husqvarna API
   - Fresh mower data retrieved
   - Firestore updated with new status
   - UI displays updated state

## Error Handling

The system includes comprehensive error handling:

1. **API Error Map**:
   - Complete mapping of all 100+ Husqvarna error codes to descriptions
   - Errors displayed to users in readable format

2. **Recovery Logic**:
   - Automatic token refresh on expiration
   - Retries for transient network issues
   - Safe batch operations for database updates

## Upcoming Enhancements

- **WebSocket Integration** - For real-time status updates
- **Additional UI Controls** - For advanced mower features
- **Multi-user Support** - For shared mower access 