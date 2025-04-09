# Husqvarna API Integration Guide

This document provides a comprehensive guide to integrating with the Husqvarna Automower Connect API. The integration enables control and monitoring of Husqvarna robotic mowers through our application.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [WebSocket Integration](#websocket-integration)
5. [Development Workflow](#development-workflow)
6. [Implementation Details](#implementation-details)
7. [Troubleshooting](#troubleshooting)

## API Overview

The Husqvarna Automower Connect API allows developers to:

- Retrieve information about connected mowers
- Send commands to mowers (start, stop, pause, etc.)
- Monitor mower status in real-time
- Access historical data and statistics

API Documentation: [Husqvarna Developer Portal](https://developer.husqvarnagroup.cloud/)

## Authentication

The Husqvarna API uses OAuth 2.0 for authentication.

### Prerequisites

Before you begin, you need:

1. A Husqvarna Developer account
2. API application credentials
   - Client ID
   - Client Secret
   - API Key

### Authentication Flow

1. **Get OAuth Token**
   - Endpoint: `https://api.authentication.husqvarnagroup.dev/v1/oauth2/token`
   - Method: `POST`
   - Headers: `Content-Type: application/x-www-form-urlencoded`
   - Body:
     ```
     grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
     ```
   - Response: Contains `access_token` and `expires_in`

2. **Using the Token**
   - Include the token in request headers: `Authorization: Bearer YOUR_ACCESS_TOKEN`
   - Include your API key: `X-Api-Key: YOUR_API_KEY`
   - **IMPORTANT**: Include the Authorization Provider: `Authorization-Provider: husqvarna` (This is required for all API requests)
   - Tokens expire after the time specified in `expires_in` (typically 1 hour)

### Required Headers for All API Requests

Every request to the Husqvarna API must include these headers:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
Authorization-Provider: husqvarna
X-Api-Key: YOUR_API_KEY
```

Omitting any of these headers will result in authentication failures, typically with a 403 status code.

## API Endpoints

### Core Endpoints

1. **Get All Mowers**
   - Endpoint: `https://api.amc.husqvarna.dev/v1/mowers`
   - Method: `GET`
   - Headers: 
     - `Authorization: Bearer YOUR_ACCESS_TOKEN`
     - `X-Api-Key: YOUR_API_KEY`

2. **Get Mower Details**
   - Endpoint: `https://api.amc.husqvarna.dev/v1/mowers/{mowerId}`
   - Method: `GET`
   - Headers: Same as above

3. **Send Command to Mower**
   - Endpoint: `https://api.amc.husqvarna.dev/v1/mowers/{mowerId}/actions`
   - Method: `POST`
   - Headers: 
     - Same as above
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "action": "START",
       "parameters": {
         "duration": 60
       }
     }
     ```

### Available Mower Commands

- `START` - Start mowing
- `PAUSE` - Pause the mower
- `PARK` - Return to charging station
- `PARK_UNTIL_NEXT_SCHEDULE` - Park until next scheduled task
- `PARK_UNTIL_FURTHER_NOTICE` - Park indefinitely
- `RESUME_SCHEDULE` - Resume the scheduled operation

### Additional Endpoints

- **Get Mower Calendar**: `GET /v1/mowers/{mowerId}/calendar`
- **Get Mower Settings**: `GET /v1/mowers/{mowerId}/settings`
- **Get Mower Statistics**: `GET /v1/mowers/{mowerId}/statistics`
- **Get Mower Work Areas**: `GET /v1/mowers/{mowerId}/workareas`
- **Get Mower Geofences**: `GET /v1/mowers/{mowerId}/geofence`

## WebSocket Integration

For real-time communication with mowers, use the Husqvarna WebSocket API.

### WebSocket Connection Flow

1. **Get WebSocket URL**
   - Endpoint: `https://api.amc.husqvarna.dev/v1/websocket`
   - Method: `GET`
   - Headers: 
     - `Authorization: Bearer YOUR_ACCESS_TOKEN`
     - `X-Api-Key: YOUR_API_KEY`

2. **Connect to WebSocket**
   - Connect to the URL returned in the previous step
   - Authentication is handled through the connection URL

3. **Subscribe to Mower Updates**
   - Send a subscription message:
     ```json
     {
       "id": "unique-message-id",
       "type": "subscription",
       "subject": "mower-state",
       "parameters": {
         "mowerId": "YOUR_MOWER_ID"
       }
     }
     ```

4. **Handle Incoming Messages**
   - The server will send real-time updates about the mower's state
   - Process these messages to update your UI

### Message Types

- **Authentication**: Initial authentication
- **Subscription**: Subscribe to specific mower updates
- **Data**: Incoming data from subscribed mowers
- **Heartbeat**: Connection maintenance messages
- **Error**: Error messages

## Development Workflow

1. **Setup API Credentials**
   - Register on the Husqvarna Developer Portal
   - Create an application
   - Note the Client ID, Client Secret, and API Key

2. **Authentication**
   - Implement the OAuth 2.0 flow
   - Store tokens securely
   - Handle token refresh

3. **API Integration**
   - Start with basic mower information retrieval
   - Implement command sending functionality
   - Add more advanced features (scheduling, statistics, etc.)

4. **WebSocket Integration**
   - Implement real-time updates
   - Handle connection maintenance (reconnection, heartbeats)
   - Update UI in real-time

## Implementation Details

### API Client Structure

We've implemented a structured API client in our application with these components:

1. **Authentication Service**
   - Handles OAuth token acquisition and renewal
   - Securely stores credentials
   - Provides authenticated requests

2. **Mower Service**
   - Fetches mower information
   - Sends commands to mowers
   - Handles errors and retries

3. **WebSocket Service**
   - Manages WebSocket connections
   - Handles subscription management
   - Processes incoming real-time updates

### Data Model

The key data models used in our implementation:

- **Mower**: Represents a single mower with its properties
- **MowerStatus**: Represents the current status of a mower
- **MowerCommand**: Represents a command to be sent to a mower
- **MowerCalendar**: Represents a mower's scheduled tasks

### API Sandbox

Our application includes an API Sandbox page that allows you to:

- Configure API credentials
- Test API endpoints
- View raw API responses
- Try different commands

## Troubleshooting

### Common Errors

1. **Authentication Failures**
   - Check that your Client ID and Secret are correct
   - Ensure your token hasn't expired
   - Verify your application permissions

2. **API Request Failures**
   - Ensure you're including the correct headers
   - Check mower IDs for typos
   - Verify the request body format

3. **WebSocket Issues**
   - Ensure your authentication is valid
   - Check network connectivity
   - Verify subscription message format

### Debugging Tips

1. Use the API Sandbox to test raw API requests
2. Check browser console for detailed error messages
3. Enable verbose logging in development mode
4. Test with a single mower before scaling to multiple units

### Rate Limits

Be aware of Husqvarna API rate limits:
- 300 requests per minute for most endpoints
- 10 WebSocket connections per application
- Exceeded rate limits result in HTTP 429 responses

## Resources

- [Husqvarna Developer Portal](https://developer.husqvarnagroup.cloud/)
- [API Documentation](https://developer.husqvarnagroup.cloud/apis/automower-connect-api)
- [OAuth Documentation](https://developer.husqvarnagroup.cloud/apis/authentication-api)
- [WebSocket Documentation](https://developer.husqvarnagroup.cloud/apis/automower-connect-api/documentation/websocket) 