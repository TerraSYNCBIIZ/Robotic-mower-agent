import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  try {
    console.log('PROXY REQUEST RECEIVED');
    
    // Get the target URL from query parameters
    const url = req.nextUrl.searchParams.get('url');
    
    if (!url) {
      console.error('Missing URL parameter');
      return NextResponse.json(
        { error: 'Missing URL parameter' },
        { status: 400 }
      );
    }
    
    console.log(`Proxying request to: ${url}`);
    
    // Get method, headers, and body from the original request
    const method = req.method;
    const headers = new Headers(req.headers);
    
    // Remove headers that should not be forwarded
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');
    
    // Check for user access token in cookies
    const userAccessToken = req.cookies.get('userAccessToken')?.value;
    const mowerAccessToken = req.cookies.get('mowerAccessToken')?.value;
    
    // Detailed debug about tokens
    console.log('Proxy AUTH DEBUG:', {
      hasUserAccessToken: !!userAccessToken,
      userTokenLength: userAccessToken?.length,
      hasMowerAccessToken: !!mowerAccessToken,
      mowerTokenLength: mowerAccessToken?.length,
      allCookies: req.cookies.getAll().map(c => c.name),
    });
    
    // If there's a mower access token in cookies, use it first (this should come from user login)
    if (mowerAccessToken && url.includes('husqvarna.dev')) {
      headers.set('Authorization', `Bearer ${mowerAccessToken}`);
      console.log('Added mower access token from cookies (from user login)');
    }
    // Fall back to userAccessToken if mowerAccessToken isn't available
    else if (userAccessToken && url.includes('husqvarna.dev')) {
      headers.set('Authorization', `Bearer ${userAccessToken}`);
      console.log('Added user access token from cookies');
    } else if (url.includes('husqvarna.dev')) {
      console.warn('No access token found in cookies for Husqvarna API request');
    }
    
    // Check for multiple possible environment variable names for API key
    const apiKey = process.env.HUSQVARNA_APP_KEY || 
                   process.env.HUSQVARNA_API_KEY || 
                   process.env.HUSQVARNA_CLIENT_ID || '';
    
    // Always add API key from environment variables for Husqvarna API requests
    if (url.includes('husqvarna.dev') && apiKey) {
      headers.set('X-Api-Key', apiKey);
      console.log(`Added API key from environment: ${apiKey.substring(0, 5)}...`);
    } else if (url.includes('husqvarna.dev')) {
      console.error('Missing API key in environment variables. Looking for HUSQVARNA_APP_KEY or HUSQVARNA_API_KEY');
      console.log('Available env variables:', Object.keys(process.env).filter(key => key.includes('HUSQ')));
    }
    
    // Add Authorization-Provider header required by Husqvarna API
    if (url.includes('husqvarna.dev')) {
      headers.set('Authorization-Provider', 'husqvarna');
      console.log('Added Authorization-Provider header for Husqvarna API');
    }
    
    // Create fetch options
    const options: RequestInit = {
      method,
      headers,
    };
    
    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = headers.get('content-type');
      
      let requestBody: string | undefined;
      
      if (contentType?.includes('application/json')) {
        try {
          const jsonBody = await req.json();
          requestBody = JSON.stringify(jsonBody);
          console.log('Processing JSON request body:', requestBody);
        } catch (e) {
          console.error('Error parsing JSON body:', e);
          requestBody = '{}';
        }
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        requestBody = await req.text();
        console.log('Processing form request body:', requestBody);
      } else {
        requestBody = await req.text();
        console.log('Processing text request body:', requestBody);
      }
      
      options.body = requestBody;
    }
    
    console.log(`Making ${method} request to ${url} with headers:`, Object.fromEntries(headers.entries()));
    
    // Make the request to the target URL
    const response = await fetch(url, options);
    
    // Log detailed response information
    console.log(`Response from ${url}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });
    
    // Get response data
    let data: any;
    const responseContentType = response.headers.get('content-type');
    
    if (responseContentType?.includes('application/json')) {
      data = await response.json();
      console.log('Received JSON response:', JSON.stringify(data).substring(0, 400) + (JSON.stringify(data).length > 400 ? '...' : ''));
    } else {
      data = await response.text();
      console.log('Received text response:', data.substring(0, 400) + (data.length > 400 ? '...' : ''));
      
      // Try to parse as JSON anyway in case the content type is wrong
      try {
        data = JSON.parse(data);
        console.log('Successfully parsed text response as JSON');
      } catch (e) {
        // Keep as text if parsing fails
      }
    }
    
    if (!response.ok) {
      console.error(`Request failed with status ${response.status}: ${JSON.stringify(data)}`);
      
      // Create a more helpful error response
      return NextResponse.json({
        error: `Request to Husqvarna API failed with status: ${response.status}`,
        details: typeof data === 'object' ? data : { message: data },
        status: response.status,
        url,
      }, { status: response.status });
    } else {
      console.log(`Request successful with status ${response.status}`);
    }
    
    // Create the response with appropriate headers
    const finalResponse = NextResponse.json(data, { status: response.status });
    
    // Forward relevant headers from the original response
    const allowedHeaders = [
      'cache-control',
      'content-type',
      'etag',
      'expires',
      'last-modified',
      'vary',
    ];
    
    response.headers.forEach((value, key) => {
      if (allowedHeaders.includes(key.toLowerCase())) {
        finalResponse.headers.set(key, value);
      }
    });
    
    return finalResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 