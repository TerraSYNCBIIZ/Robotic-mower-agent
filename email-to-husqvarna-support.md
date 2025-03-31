Subject: WebSocket Authentication Issue with Husqvarna Automower Connect API

Dear Husqvarna Developer Support Team,

I am writing regarding authentication issues we're experiencing with the Husqvarna Automower Connect API's WebSocket functionality. We've been developing a monitoring application for robotic mowers using your API and have encountered consistent authentication failures with the WebSocket connection.

## Issue Description

When attempting to establish a WebSocket connection to `wss://api.amc.husqvarna.dev/v1/websocket`, we're consistently receiving `401 Unauthorized` errors despite using valid OAuth access tokens that work correctly with your REST API endpoints.

Our debugging has revealed that while the same access token works for all other API endpoints, the WebSocket connection specifically fails with:

```
Error: Failed to connect to WebSocket: 401 Unauthorized
Reason: simultaneous.logins
```

## Steps to Reproduce

1. Authenticate with Husqvarna OAuth2 API and obtain a valid access token
2. Successfully use this token to access various REST API endpoints (mowers, status, etc.)
3. Attempt to connect to WebSocket using the same token either:
   - As a query parameter: `wss://api.amc.husqvarna.dev/v1/websocket?token=<token>`
   - Or as an Authorization header (where applicable)
   - Or using subprotocols: `new WebSocket(url, ['bearer:<token>'])`

All methods result in the same 401 error with "simultaneous.logins" message.

## Our Investigation Findings

We've determined that the issue appears to be related to how the Husqvarna API handles WebSocket connections for authenticated users:

1. The API seems to be treating WebSocket connections as separate login sessions from REST API calls
2. The "simultaneous.logins" error suggests the API has a restriction preventing multiple active sessions using the same credentials
3. The same token that authenticates REST API calls is being rejected for WebSocket connections

Our application works perfectly with the REST API but cannot utilize real-time updates through WebSockets, causing us to fall back to polling.

## Questions

1. Is there a specific authentication method or additional permission required specifically for WebSocket connections?
2. Does the API intentionally restrict simultaneous connections from the same account (REST + WebSocket)?
3. Is there a recommended approach for applications that need both REST API access and WebSocket connections?
4. Are there specific scopes or permissions we need to request when obtaining the OAuth token for WebSocket access?

We would greatly appreciate any insight or guidance on this issue. Our application's real-time functionality depends on resolving this WebSocket authentication problem.

Thank you for your assistance.

Sincerely,
[Your Name]
[Your Company]
[Contact Information] 