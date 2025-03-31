/**
 * Client for interacting with the Husqvarna API for mower operations
 */
export default class HusqvarnaClient {
  private token: string;
  private baseUrl = 'https://api.amc.husqvarna.dev/v1';
  private headers: Record<string, string>;

  constructor(token: string) {
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'X-Api-Key': process.env.HUSQVARNA_APP_KEY || '',
      'Authorization-Provider': 'husqvarna',
      'Content-Type': 'application/vnd.api+json',
    };
  }

  /**
   * Get all mowers associated with the authenticated user
   */
  async getMowers() {
    const response = await fetch(`${this.baseUrl}/mowers`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch mowers: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get information about a specific mower
   */
  async getMower(mowerId: string) {
    const response = await fetch(`${this.baseUrl}/mowers/${mowerId}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch mower ${mowerId}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get the zones for a specific mower
   */
  async getZonesForMower(mowerId: string) {
    const response = await fetch(`${this.baseUrl}/mowers/${mowerId}/zones`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch zones for mower ${mowerId}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  }

  /**
   * Get the calendar for a specific mower
   */
  async getMowerCalendar(mowerId: string) {
    const response = await fetch(`${this.baseUrl}/mowers/${mowerId}/calendar`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar for mower ${mowerId}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Update the calendar for a specific mower
   */
  async updateMowerCalendar(mowerId: string, scheduleData: any) {
    const calendarData = {
      data: {
        type: 'calendar',
        attributes: {
          tasks: scheduleData.tasks
        }
      }
    };

    const response = await fetch(`${this.baseUrl}/mowers/${mowerId}/calendar`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(calendarData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update calendar for mower ${mowerId}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Send an action command to a mower
   */
  async sendMowerAction(mowerId: string, action: string, duration?: number) {
    const actionData = {
      data: {
        type: 'actions',
        attributes: {
          action,
          duration
        }
      }
    };

    const response = await fetch(`${this.baseUrl}/mowers/${mowerId}/actions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(actionData)
    });

    if (!response.ok) {
      throw new Error(`Failed to send action to mower ${mowerId}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }
} 