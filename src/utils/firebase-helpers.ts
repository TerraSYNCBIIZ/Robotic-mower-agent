import { Functions, httpsCallable } from 'firebase/functions';

/**
 * Safely call a Firebase function with proper error handling
 * @param functions Firebase Functions instance
 * @param functionName Name of the function to call
 * @param data Data to pass to the function
 * @returns Result of the function call or null if there was an error
 */
export async function safeCallFunction<T = any>(
  functions: Functions | null,
  functionName: string,
  data?: any
): Promise<{ success: boolean; data?: T; error?: Error }> {
  if (!functions) {
    console.error(`Cannot call function ${functionName} - Firebase Functions not available`);
    return { 
      success: false, 
      error: new Error('Firebase Functions not available') 
    };
  }

  try {
    const functionCall = httpsCallable<any, T>(functions, functionName);
    const result = await functionCall(data || {});
    return { success: true, data: result.data };
  } catch (error) {
    console.error(`Error calling function ${functionName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
}

/**
 * Try to fetch from an endpoint with proper error handling
 * @param url URL to fetch from
 * @param options Fetch options
 * @returns Response data or null if there was an error
 */
export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: Error; status?: number }> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data, status: response.status };
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error)) 
    };
  }
} 