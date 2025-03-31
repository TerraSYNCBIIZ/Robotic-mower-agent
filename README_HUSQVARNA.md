# Husqvarna Automower Integration - MowerMind AI

This document outlines the implementation of Husqvarna Automower API integration for the MowerMind AI project.

## Table of Contents

- [API Overview](#api-overview)
- [Authentication](#authentication)
- [Mower API Endpoints](#mower-api-endpoints)
- [Implementation Details](#implementation-details)
- [Common Operations](#common-operations)
- [Limitations](#limitations)

## API Overview

The Husqvarna Automower Connect API allows for retrieving information about mowers and controlling them remotely. The base URL for all Automower API requests is:

```
https://api.amc.husqvarna.dev/v1
```

## Authentication

Authentication is handled through the Husqvarna Authentication API. Each request to the Automower API must include the following headers:

- `Authorization-Provider: husqvarna`
- `Authorization: Bearer {access_token}`
- `X-Api-Key: {app_key}`
- `Content-Type: application/vnd.api+json` (for POST requests)

### Authentication Flow

There are two main ways to authenticate with the Husqvarna API:

1. **Client Credentials Grant** - Only for the developer's own user account
2. **Authorization Code Grant** - For end users of your application (implemented in our app)

#### Authorization Code Flow

1. Direct the user to the Husqvarna login page:
   ```
   https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize?client_id={APP_KEY}&redirect_uri={REDIRECT_URI}
   ```

2. After user authorizes, they are redirected to your redirect URI with an authorization code:
   ```
   {REDIRECT_URI}?code={AUTHORIZATION_CODE}&state={STATE}
   ```

3. Exchange the code for tokens:
   ```javascript
   const response = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded'
     },
     body: new URLSearchParams({
       grant_type: 'authorization_code',
       code: authorizationCode,
       redirect_uri: redirectUri,
       client_id: appKey,
       client_secret: clientSecret
     })
   });
   
   const data = await response.json();
   // Store access_token and refresh_token securely
   ```

4. The response will include:
   - `access_token` - Valid for 1 hour
   - `refresh_token` - Valid for 24 hours
   - `expires_in` - Token expiration time in seconds
   - `user_id` - Husqvarna user ID
   
#### Refreshing Tokens

```javascript
const response = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: appKey,
    refresh_token: refreshToken
  })
});

const data = await response.json();
// Update stored tokens
```

#### Logging Out / Revoking Tokens

```javascript
const response = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/revoke', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: new URLSearchParams({
    token: accessToken
  })
});
```

## Mower API Endpoints

### Get All Mowers

```
GET /mowers
```

Returns a list of all mowers linked to the authenticated user.

### Get Specific Mower

```
GET /mowers/{id}
```

Returns detailed information about a specific mower.

### Mower Actions

```
POST /mowers/{id}/actions
```

Sends commands to control a mower. The action type is specified in the request body. Common actions include:

- **Start** - Start mowing
- **Pause** - Pause the mower
- **Park** - Return to charging station
- **ParkUntilNextSchedule** - Park until next scheduled run
- **ParkUntilFurtherNotice** - Park indefinitely
- **ResumeSchedule** - Resume the normal schedule

### Additional Endpoints

- `GET /mowers/{id}/messages` - Get last messages for a mower
- `GET /mowers/{id}/stayOutZones` - Get all stay out zones
- `GET /mowers/{id}/workAreas` - Get all work areas
- `POST /mowers/{id}/calendar` - Update the mower's schedule
- `POST /mowers/{id}/settings` - Update mower settings (cutting height, headlight, etc.)

## Implementation Details

In the MowerMind AI project, we've implemented the Husqvarna API integration using the following components:

1. **HusqvarnaClient** (`src/lib/husqvarna/api.ts`) - Core client for interacting with the API
2. **Add Mower Flow** (`src/app/mowers/add/page.tsx`) - UI for connecting Husqvarna accounts
3. **Authentication API** (`src/app/api/mowers/auth/route.ts`) - Backend handling of OAuth tokens

### Security Considerations

- Tokens should be stored securely server-side and associated with user accounts
- The current implementation returns tokens to the client for demo purposes, but in production:
  - Store tokens in a database
  - Use server sessions to manage authentication state
  - Implement automatic token refresh

## Common Operations

### Start Mower for a Duration

```javascript
const response = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/actions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Api-Key': appKey,
    'Authorization-Provider': 'husqvarna',
    'Content-Type': 'application/vnd.api+json'
  },
  body: JSON.stringify({
    data: {
      type: 'Start',
      attributes: {
        duration: 60 // minutes
      }
    }
  })
});
```

### Pause Mower

```javascript
const response = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/actions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Api-Key': appKey,
    'Authorization-Provider': 'husqvarna',
    'Content-Type': 'application/vnd.api+json'
  },
  body: JSON.stringify({
    data: {
      type: 'Pause'
    }
  })
});
```

### Park Until Next Schedule

```javascript
const response = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/actions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Api-Key': appKey,
    'Authorization-Provider': 'husqvarna',
    'Content-Type': 'application/vnd.api+json'
  },
  body: JSON.stringify({
    data: {
      type: 'ParkUntilNextSchedule'
    }
  })
});
```

### Update Mower Schedule

```javascript
const response = await fetch(`https://api.amc.husqvarna.dev/v1/mowers/${mowerId}/calendar`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Api-Key': appKey,
    'Authorization-Provider': 'husqvarna',
    'Content-Type': 'application/vnd.api+json'
  },
  body: JSON.stringify({
    data: {
      type: 'calendar',
      attributes: {
        tasks: [{
          start: 662,         // Minutes from midnight (11:02 AM)
          duration: 120,      // Minutes
          monday: false,
          tuesday: true,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        }]
      }
    }
  })
});
```

## Limitations

The following limitations apply to the Husqvarna Automower Connect API:

- Max 1 request per second per application key
- Max 10,000 requests per month per application key
- Max 3 access tokens per user and client
- Max 10 logins per minute
- Not more than one login every 5 seconds

## Error Codes and Status

The API returns detailed error codes and status information to help diagnose issues with mowers:

- `mode` - Operating mode (MAIN_AREA, SECONDARY_AREA, HOME, DEMO, UNKNOWN)
- `activity` - Current activity (MOWING, GOING_HOME, CHARGING, etc.)
- `state` - Current state (IN_OPERATION, PAUSED, RESTRICTED, ERROR, etc.)
- `errorCode` - Specific error code if in error state (0-148, 701-717, 724)

For a detailed list of error codes, refer to the complete API documentation. 