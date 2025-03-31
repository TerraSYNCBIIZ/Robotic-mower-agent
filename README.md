# Robotic Mower AI Agent

## Description

An intelligent AI agent designed to monitor, control, and optimize Husqvarna robotic mowers. The platform provides a chat-based interface for users to interact with their mowers and leverages AI to provide proactive assistance, optimized scheduling, and error handling.

## Key Features

*   **AI Chat Interface:** Interact with the mower(s) using natural language.
*   **Husqvarna API Integration:** Connects to the Husqvarna Automower® Connect API for status updates and control commands.
*   **Intelligent Scheduling:** Automatically adjusts mowing schedules based on weather forecasts and potentially other factors.
*   **Proactive Error Handling:** Detects common mower errors (e.g., stuck, low battery), attempts automated fixes, and notifies the user if necessary.
*   **Pattern Detection:** Identifies recurring issues like frequently getting stuck in the same area ("hot spots") and suggests solutions.
*   **Map View:** Visual representation of mower locations.
*   **User Management & Authentication:** Securely manages user accounts and mower connections.

## Tech Stack

*   **Backend Framework:** Google Genkit ([https://firebase.google.com/docs/genkit](https://firebase.google.com/docs/genkit))
*   **Cloud Platform:** Google Firebase (Firestore, Authentication, Hosting/Cloud Functions/Cloud Run for Genkit deployment)
*   **AI Model Provider:** Google Vertex AI (Gemini family, via Genkit plugin)
*   **Language:** TypeScript/Node.js
*   **Frontend:** React/Next.js
*   **UI Components:** shadcn/ui
*   **External APIs:**
    *   Husqvarna Automower® Connect API
    *   Weather API (TBD)

## Architecture Overview

*   **Frontend:** A web application (Next.js) providing the chat UI, map view, and user account management. Uses shadcn/ui for components.
*   **Backend:** Genkit flows deployed on Firebase (likely Cloud Functions or Cloud Run). These flows handle:
    *   API interactions (Husqvarna, Weather)
    *   AI model calls (Gemini via Vertex AI)
    *   Chat logic and state management
    *   Background optimization tasks
    *   Database interactions
*   **Database:** Firestore to store user data, mower details, API credentials (securely), schedules, historical data, identified patterns, etc.
*   **Authentication:** Firebase Authentication to manage user logins.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- A Firebase account and project
- Husqvarna Developer Account with API credentials
- Weather API credentials (optional)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/robotic-mower-agent.git
   cd robotic-mower-agent
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Fill in the required variables:
     - Firebase configuration
     - Husqvarna API credentials
     - Weather API key (if using)

4. Run the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── src/
│   ├── app/                  # Next.js app directory
│   │   ├── chat/             # Chat page component
│   │   ├── dashboard/        # Dashboard page component
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   ├── components/           # Reusable components
│   └── lib/                  # Utilities and API clients
│       ├── firebase/         # Firebase configuration
│       ├── genkit/           # Genkit AI agent
│       ├── husqvarna/        # Husqvarna API client
│       └── weather/          # Weather API client
├── public/                   # Static assets
├── .env.local.example        # Example environment variables
└── README.md                 # This file
```

## Initial Next Steps

1.  **Set up Firebase Project:** Create a new Firebase project, enable Firestore, Authentication.
2.  **Obtain Husqvarna API Credentials:** Register an application on the Husqvarna Developer Portal to get an App Key and Secret.
3.  **Initialize Genkit Project:** Set up a basic Genkit project locally with TypeScript.
4.  **Configure Genkit:** Add Firebase and Vertex AI plugins.
5.  **Implement Authentication:** Set up basic user login/signup using Firebase Auth.
6.  **Husqvarna Auth Flow:** Implement the OAuth 2.0 Authorization Code Grant flow to allow users to link their Husqvarna accounts.
7.  **Basic Genkit Flow:** Create a simple Genkit flow to fetch mower list using stored credentials.
8.  **Frontend Setup:** Initialize a basic Next.js project with shadcn/ui.

## Development Roadmap

### Current Status

- [x] Project setup with Next.js, Firebase, and TypeScript
- [x] Basic UI components and pages
- [x] Husqvarna API client implementation
- [x] Genkit agent configuration
- [ ] Firebase authentication integration
- [ ] Husqvarna OAuth2 flow implementation
- [ ] Working chat interface connected to Genkit
- [ ] Weather API integration
- [ ] Mower status monitoring and visualization
- [ ] Pattern detection for problem areas
- [ ] Intelligent scheduling based on weather and lawn growth patterns
- [ ] Proactive error handling and automated fixes
- [ ] Deployment to Firebase Hosting and Cloud Functions

### Next Steps

1. **Complete Authentication:** Implement Firebase authentication
2. **Connect Genkit Agent:** Integrate the Genkit agent with the chat interface
3. **Implement OAuth Flow:** Complete the Husqvarna OAuth2 authorization flow
4. **Add Weather API:** Integrate a weather forecast API service
5. **Implement Status Monitoring:** Add real-time status updates from mowers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## UI Development Guidelines

This project uses a combination of:

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Accessible components built with Radix UI and Tailwind CSS
- [21st Magic](https://21st.dev) - AI-powered UI component generation

### Creating New UI Components

When creating new UI components, use the 21st Magic component builder to generate the base code, then adapt it to the project's needs. This approach ensures consistent, accessible, and visually appealing components.

To use the 21st Magic component builder:

1. Start your request with `/ui` followed by a description of the component you need
2. Customize the generated component as needed to match the project's style and requirements
3. Ensure all components are properly typed and accessible

### Theme and Styling

The project uses a custom theme built on Tailwind CSS with dark mode support. Key color variables are:

- Primary: Green-based palette (representing grass/lawn)
- Background: Clean white/dark backgrounds with subtle gray accents
- Accent colors: Yellow, blue, and red for status indicators

### Component Library

The main components used in this project:

- **LawnMowerStatusCard**: Displays key information about a mower including status, battery level, and environmental data
- **MapView**: Shows the location and movement of mowers (placeholder)
- **ChatInterface**: Provides an AI assistant for mower management (in progress)

### Accessibility

All UI components should be accessible, including:

- Proper ARIA attributes
- Keyboard navigation support
- Color contrast compliance
- Screen reader support

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## WebSocket Real-Time Updates

This application uses WebSockets to provide real-time updates for mower status. Due to restrictions in the Husqvarna API regarding browser-based WebSocket connections, we've implemented a proxy solution:

### Architecture

The system consists of two main components:

1. **WebSocket Proxy Server**: A standalone Node.js server that handles connections to Husqvarna's WebSocket API
2. **Client WebSocket Integration**: Browser-side integration that connects to the proxy server

### Running the WebSocket Proxy

The WebSocket proxy server can be started in two ways:

```bash
# Run only the WebSocket proxy
npm run proxy

# Run both the Next.js app and the WebSocket proxy
npm run dev:all
```

### Configuration

The WebSocket proxy is configured using these environment variables:

```
WEBSOCKET_PROXY_PORT=3001 # Port for the WebSocket proxy server
WEBSOCKET_PROXY_HOST=localhost # Host for the WebSocket proxy server
```

### Testing WebSocket Connectivity

You can test WebSocket connectivity by visiting `/test-websocket` in the app.

For more details, see the [WebSocket Proxy README](./websocket-proxy/README.md). 