# Husqvarna API WebSocket Authentication Issue

## Problem Summary
We're encountering authentication issues with the Husqvarna WebSocket API. The WebSocket connection initially establishes with our proxy server but then fails with a 401 Unauthorized error when the proxy attempts to connect to Husqvarna's WebSocket API.

Additionally, we're seeing 403 Forbidden errors with REST API calls, suggesting our DirectAPI token might have expired or been revoked.

## Client-Side Logs
```
WebSocket status changed: connecting
Connecting to WebSocket proxy at ws://localhost:3001
WebSocket connection established
WebSocket status changed: connected
Connection result: true
WebSocket connection status: error
WebSocket connection closed: 4001 Authentication failed with Husqvarna API
WebSocket status changed: disconnected
```

## WebSocket Proxy Server Logs
```
WebSocket proxy server running on port 3001
Proxying connections to wss://api.amc.husqvarna.dev/v1/websocket
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] New WebSocket connection established
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Connecting to Husqvarna WebSocket API...
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Husqvarna WebSocket error: Unexpected server response: 401
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Authentication error with Husqvarna API
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Husqvarna WebSocket closed (1006): 
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Client disconnected (4001): Authentication failed with Husqvarna API
```

## REST API Errors
```
Proxy request cookies found: 5 _ga_642084TXE8, _ga, __next_hmr_refresh_hash__, react-resizable-panels:layout, mowerAccessToken
Token found in cookies: directapi....
Proxying GET request to: https://api.amc.husqvarna.dev/v1/mowers
Using direct API key authentication
Proxy received response: 403 Forbidden
GET /api/proxy/mowers 403 in 333ms
🚫 Failed to fetch mowers: 403 Forbidden {"errors":[{"id":"74079dfc-336f-4e6a-a49b-2e5bfa44da18","status":"403","code":"missing.authorization.header","title":"Missing authorization header","detail":"Missing header: Authorization"}]}
```

## Key Observations
1. We're successfully connecting to our WebSocket proxy server
2. The proxy server correctly extracts the token and attempts to connect to Husqvarna's WebSocket API
3. Husqvarna's WebSocket API responds with a 401 Unauthorized error
4. REST API calls also fail with 403 errors about missing authorization headers, even though we're setting them

## Potential Issues
1. The DirectAPI token may have expired or been revoked
2. The WebSocket API might require different authentication than the REST API
3. The WebSocket API might require specific token scopes (like "amc:api")
4. The format for passing the Authorization header may be different for WebSockets

## Email Template for Husqvarna Support

```
Subject: WebSocket API Authentication Issue - 401 Unauthorized

Dear Husqvarna API Support Team,

I'm developing an application that integrates with the Husqvarna API, including the WebSocket API for real-time updates (wss://api.amc.husqvarna.dev/v1/websocket). I'm encountering persistent authentication issues with both the WebSocket and REST APIs.

Details:
- I'm using a DirectAPI token that has previously worked with your REST APIs
- I'm passing the token in the Authorization header as "Bearer [token]" for the WebSocket connection
- The WebSocket connection attempt consistently returns a 401 error
- REST API calls are returning 403 errors with "missing.authorization.header" messages

My proxy server logs show:
```
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Connecting to Husqvarna WebSocket API...
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Husqvarna WebSocket error: Unexpected server response: 401
[f5742cf3-9d0e-4d6e-8710-4d4fec0c199a] Authentication error with Husqvarna API
```

REST API error response:
```
403 Forbidden {"errors":[{"id":"74079dfc-336f-4e6a-a49b-2e5bfa44da18","status":"403","code":"missing.authorization.header","title":"Missing authorization header","detail":"Missing header: Authorization"}]}
```

Questions:
1. Does the WebSocket API require different authentication credentials than the REST API?
2. Are there specific token scopes required for WebSocket access (I understand "amc:api" might be needed)?
3. Does the WebSocket API support DirectAPI tokens, or is OAuth authentication required instead?
4. Is there a specific format or method for providing the authorization token to the WebSocket endpoint?
5. Has there been any change to the authentication requirements for your APIs recently?
6. Could my DirectAPI token have expired or been revoked?

Your documentation doesn't provide clear guidance on these specific authentication requirements for WebSocket connections. Any assistance would be greatly appreciated.

Sincerely,
[Your Name]
```

## Next Steps
1. Send the email to Husqvarna support for official guidance
2. Check your DirectAPI token expiration and validity
3. Try generating a new token through the Husqvarna developer portal
4. If possible, try using OAuth authentication instead of DirectAPI authentication
5. Verify the headers being sent in the WebSocket connection

The fact that both REST API and WebSocket API calls are failing suggests a broader authentication issue rather than something specific to WebSockets. Your token might have expired or been revoked, or Husqvarna might have changed their authentication requirements. 