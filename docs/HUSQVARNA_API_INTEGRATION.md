# Husqvarna Automower Connect API Integration Guide

This document describes the correct implementation for integrating with the Husqvarna Automower Connect API, with a focus on proper authentication and common pitfalls to avoid.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Requirements](#authentication-requirements)
3. [OAuth Flow Implementation](#oauth-flow-implementation)
4. [Required Headers](#required-headers)
5. [Handling Tokens](#handling-tokens)
6. [Common API Endpoints](#common-api-endpoints)
7. [Troubleshooting](#troubleshooting)

## API Overview

The Husqvarna Automower Connect API allows you to:
- Retrieve mower information and status
- Send commands to mowers (start, stop, park)
- Access mower statistics, settings, and positions
- Manage calendar schedules and work areas

The API is RESTful and uses JSON API format for requests and responses.

## Authentication Requirements

Authentication with the Husqvarna API requires several important components:

1. **Developer Application Registration**:
   - Register your application in the Husqvarna Developer Portal
   - Obtain Application Key (Client ID) and Client Secret
   - Register the exact redirect URI that will be used in your OAuth flow

2. **OAuth Scopes**:
   - `iam:read` - Required for basic account access
   - `amc:api` - **Critical** for Automower Connect API access

3. **Authorization Flow Type**:
   - Use OAuth Authorization Code flow (not Client Credentials) for accessing user's mowers
   - Client Credentials flow does not provide access to user resources

## OAuth Flow Implementation

### Step 1: Authorization Request

Create an authorization URL that redirects the user to Husqvarna's OAuth page:

```typescript
const authUrl = new URL('https://api.authentication.husqvarnagroup.dev/v1/oauth2/authorize');
authUrl.searchParams.append('client_id', clientId);
authUrl.searchParams.append('redirect_uri', redirectUri);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('state', encodedState);
authUrl.searchParams.append('scope', 'iam:read amc:api'); // Explicit scope is critical
```

**CRITICAL**: Your `redirectUri` must exactly match the one registered in the Husqvarna Developer Portal. The most common error occurs when these don't match.

### Step 2: Handle the Callback

When Husqvarna redirects back to your application:

```typescript
// Extract the authorization code from query parameters
const code = req.query.code;

// Exchange the code for tokens
const tokenResponse = await fetch('https://api.authentication.husqvarnagroup.dev/v1/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri, // Must match what was used in authorization
    scope: 'iam:read amc:api' // Include scope explicitly 
  }).toString()
});

const tokenData = await tokenResponse.json();
```

**CRITICAL**: The `redirect_uri` in the token request must match exactly what was used in the authorization request.

## Required Headers

When making requests to the Husqvarna API, you must include these headers:

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'X-Api-Key': apiKey,
  'Authorization-Provider': 'husqvarna',
  'Accept': 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json'
};
```

**CRITICAL**: The `Authorization-Provider: husqvarna` header is required. Omitting this header will result in 401 Unauthorized errors even with a valid token.

## Handling Tokens

Store the token securely and make it available for API requests:

```typescript
// Store in cookies (for web applications)
response.cookies.set('mowerAccessToken', tokenData.access_token, {
  httpOnly: false, // Allow client access if needed for UI display
  secure: process.env.NODE_ENV === 'production',
  maxAge: tokenData.expires_in,
  path: '/'
});

// Also store refresh token if provided
if (tokenData.refresh_token) {
  response.cookies.set('refreshToken', tokenData.refresh_token, {
    httpOnly: true, // Keep refresh token secure
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86400 * 30, // 30 days
    path: '/'
  });
}
```

## Common API Endpoints

All endpoints are relative to the base URL: `https://api.amc.husqvarna.dev/v1`

| Endpoint | Description |
|----------|-------------|
| `/mowers` | List all mowers linked to the user |
| `/mowers/{id}` | Get data for a specific mower |
| `/mowers/{id}/actions` | Send commands to a mower |
| `/mowers/{id}/calendar` | Update mower schedule |
| `/mowers/{id}/settings` | Update mower settings |
| `/mowers/{id}/statistics` | Get mower statistics |

## Troubleshooting

### Common Error: 401 Unauthorized

If you receive a 401 Unauthorized error, check these common causes:

1. **Missing Authorization-Provider header**:
   - Ensure you're including `Authorization-Provider: husqvarna` in your headers

2. **Invalid or expired token**:
   - Verify the token is valid and not expired
   - Ensure the token was obtained through Authorization Code flow (not Client Credentials)

3. **Missing required scope**:
   - Ensure your token includes the `amc:api` scope
   - You can decode your JWT token to check its scopes (middle section, base64 decoded)

4. **Wrong redirect URI**:
   - The redirect URI in your OAuth flow must exactly match what's registered in the Husqvarna Developer Portal

### Common Error: Invalid client: `redirect_uri` does not match client value

This error indicates that the redirect URI in your authorization request doesn't match what's registered in the Husqvarna Developer Portal.

Solution:
1. Check the exact redirect URI registered in your Husqvarna Developer account
2. Use exactly that URI in your authorization request
3. Make sure there are no trailing slashes or other small differences

### Debugging Authentication

To debug authentication issues:

1. **Decode your JWT token** to check its content:
   ```javascript
   const parts = token.split('.');
   if (parts.length === 3) {
     const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
     console.log('Token scopes:', payload.scope || payload.scopes);
     console.log('Token expiry:', new Date(payload.exp * 1000).toISOString());
   }
   ```

2. **Test API access directly** with a tool like Postman or curl:
   ```bash
   curl -X GET "https://api.amc.husqvarna.dev/v1/mowers" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Api-Key: YOUR_API_KEY" \
     -H "Authorization-Provider: husqvarna" \
     -H "Accept: application/vnd.api+json"
   ```

## Sample Response

A successful mower data response will look something like this:

```json
{
  "data": [
    {
      "type": "mower",
      "id": "mower-id-here",
      "attributes": {
        "system": {
          "name": "My Mower",
          "model": "HUSQVARNA AUTOMOWER® 450X",
          "serialNumber": 123456789
        },
        "battery": {
          "batteryPercent": 100
        },
        "mower": {
          "mode": "HOME",
          "activity": "CHARGING",
          "state": "IN_OPERATION",
          "errorCode": 0
        },
        // Additional mower data...
      }
    }
  ]
}
```

---

## Implementation Checklist

✅ Register app in Husqvarna Developer Portal with exact redirect URI  
✅ Request both `iam:read` and `amc:api` scopes in authorization  
✅ Use Authorization Code flow (not Client Credentials)  
✅ Include all required headers, especially `Authorization-Provider: husqvarna`  
✅ Securely store the access token and refresh token  
✅ Handle token refresh when tokens expire  

By following these guidelines, you should be able to successfully integrate with the Husqvarna Automower Connect API. 