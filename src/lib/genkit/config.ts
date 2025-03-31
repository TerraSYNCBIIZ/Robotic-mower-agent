import { createAI } from '@genkit-ai/ai';
import { vertexai } from '@genkit-ai/vertex-ai';
import { firebase } from '@genkit-ai/firebase';

// Initialize Genkit with Vertex AI plugin
export const ai = createAI({
  plugins: [
    vertexai({ 
      projectId: 'robotic-mower-agent',
      // Default model to use if not otherwise specified
      model: 'gemini-pro',
      location: 'us-central1', 
    }),
    firebase({
      projectId: 'robotic-mower-agent',
    }),
  ],
});

// System instructions for the AI agent
export const AGENT_SYSTEM_INSTRUCTIONS = `
You are an AI assistant for robotic lawn mowers. Your name is MowerMind.
You help users manage and optimize their Husqvarna robotic mowers.

When interacting with users:
- Be friendly, helpful, and concise
- Focus on mower-related topics
- Offer proactive suggestions when appropriate

You have access to the following capabilities:
- Get mower status and location
- Send commands to mowers (start, pause, park)
- Get and update mower schedules
- Add time restrictions to specific zones
- Check weather forecasts to optimize mowing schedules
- Analyze mower usage patterns and suggest optimizations
- Monitor for errors and offer troubleshooting
- Identify problem areas in the lawn based on mower behavior

For schedule management:
- You can retrieve a mower's current schedule
- You can add "no-mow" time restrictions (e.g., "don't mow the back yard on Monday afternoons")
- You can regenerate schedules that respect all time restrictions
- You can update schedules with specific time slots

Always prioritize safety, lawn health, and optimal mowing outcomes.
`;

// Tool definitions
export const TOOLS = [
  {
    name: 'getMowerStatus',
    description: 'Get the current status of a mower',
    parameters: {
      type: 'object',
      properties: {
        mowerId: {
          type: 'string',
          description: 'ID of the mower to get status for',
        },
      },
      required: ['mowerId'],
    },
  },
  {
    name: 'sendMowerCommand',
    description: 'Send a command to a mower',
    parameters: {
      type: 'object',
      properties: {
        mowerId: {
          type: 'string',
          description: 'ID of the mower',
        },
        command: {
          type: 'string',
          description: 'Command to send (Start, Pause, ParkUntilNextSchedule, ParkUntilFurtherNotice, Park, ResumeSchedule)',
          enum: ['Start', 'Pause', 'ParkUntilNextSchedule', 'ParkUntilFurtherNotice', 'Park', 'ResumeSchedule'],
        },
        duration: {
          type: 'number',
          description: 'Duration in minutes (for Start and Park commands)',
        },
      },
      required: ['mowerId', 'command'],
    },
  },
  {
    name: 'getWeatherForecast',
    description: 'Get the weather forecast for a location',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude of the location',
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the location',
        },
        days: {
          type: 'number',
          description: 'Number of days to get forecast for (1-7)',
          default: 3,
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
  // New tools for schedule management
  {
    name: 'getMowerSchedule',
    description: 'Get the current schedule for a mower',
    parameters: {
      type: 'object',
      properties: {
        mowerId: {
          type: 'string',
          description: 'ID of the mower to get the schedule for',
        },
      },
      required: ['mowerId'],
    },
  },
  {
    name: 'updateScheduleRestriction',
    description: 'Add a time restriction to a mower zone schedule',
    parameters: {
      type: 'object',
      properties: {
        mowerId: {
          type: 'string',
          description: 'ID of the mower'
        },
        zoneId: {
          type: 'string',
          description: 'ID of the zone to add a restriction to'
        },
        zoneName: {
          type: 'string',
          description: 'Name of the zone (used as fallback if zoneId not provided)'
        },
        day: {
          type: 'string',
          description: 'Day of the week (Monday-Sunday) or "all" for every day',
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'all']
        },
        startHour: {
          type: 'number',
          description: 'Start hour (0-23) of the restriction'
        },
        endHour: {
          type: 'number',
          description: 'End hour (0-23) of the restriction'
        },
        restrictionType: {
          type: 'string',
          description: 'Type of restriction',
          enum: ['no-mow', 'morning', 'afternoon', 'evening']
        }
      },
      required: ['mowerId', 'day', 'restrictionType'],
    },
  },
  {
    name: 'updateMowerSchedule',
    description: 'Update a mower\'s schedule with new time slots',
    parameters: {
      type: 'object',
      properties: {
        mowerId: {
          type: 'string',
          description: 'ID of the mower'
        },
        schedule: {
          type: 'object',
          description: 'Schedule data for each day of the week',
          properties: {
            Monday: { type: 'array', items: { type: 'object' } },
            Tuesday: { type: 'array', items: { type: 'object' } },
            Wednesday: { type: 'array', items: { type: 'object' } },
            Thursday: { type: 'array', items: { type: 'object' } },
            Friday: { type: 'array', items: { type: 'object' } },
            Saturday: { type: 'array', items: { type: 'object' } },
            Sunday: { type: 'array', items: { type: 'object' } }
          }
        },
        regenerate: {
          type: 'boolean',
          description: 'Whether to regenerate the full schedule respecting restrictions',
          default: true
        }
      },
      required: ['mowerId'],
    },
  },
]; 