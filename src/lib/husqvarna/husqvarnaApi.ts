/**
 * Get all messages for a mower
 */
async getMowerMessages(mowerId: string): Promise<any> {
  const url = `/api/proxy/mowers/${mowerId}/messages`;
  
  try {
    const response = await fetch(url, {
      headers: this.headers,
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch mower messages: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data?.data?.attributes || { messages: [] };
  } catch (error) {
    console.error(`Error getting mower messages: ${error}`);
    throw error;
  }
}

/**
 * Get statistics for a mower
 */
async getMowerStatistics(mowerId: string): Promise<any> {
  // Note: This is accessing consolidated statistics data via the main mower endpoint
  // There is no separate statistics endpoint in the Husqvarna API
  try {
    const mowerData = await this.getMower(mowerId);
    return mowerData?.attributes?.statistics || {};
  } catch (error) {
    console.error(`Error getting mower statistics: ${error}`);
    throw error;
  }
}

/**
 * Get settings for a mower
 */
async getMowerSettings(mowerId: string): Promise<any> {
  // Note: This is accessing consolidated settings data via the main mower endpoint
  // There is no separate GET settings endpoint in the Husqvarna API (only POST to update)
  try {
    const mowerData = await this.getMower(mowerId);
    return mowerData?.attributes?.settings || {};
  } catch (error) {
    console.error(`Error getting mower settings: ${error}`);
    throw error;
  }
}

/**
 * Get stay out zones for a mower
 */
async getMowerStayOutZones(mowerId: string): Promise<any> {
  const url = `/api/proxy/mowers/${mowerId}/stayOutZones`;
  
  try {
    const response = await fetch(url, {
      headers: this.headers,
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch mower stay out zones: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data?.data?.attributes || { zones: [] };
  } catch (error) {
    console.error(`Error getting mower stay out zones: ${error}`);
    throw error;
  }
} 