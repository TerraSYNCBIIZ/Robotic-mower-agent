declare module '@genkit-ai/ai' {
  export interface Config {
    plugins: any[];
  }

  export interface Flow {
    setSystemInstruction(instruction: string): Flow;
    setTools(tools: any[], callbacks: Record<string, Function>): Flow;
    onUserMessage(handler: (message: string, context: any) => Promise<any>): Flow;
  }

  export function createAI(config: Config): {
    flow(name: string): Flow;
  };
}

declare module '@genkit-ai/vertex-ai' {
  export function vertexai(config: {
    projectId: string;
    model?: string;
    location?: string;
  }): any;
}

declare module '@genkit-ai/firebase' {
  export function firebase(config: {
    projectId: string;
  }): any;
}

declare module 'firebase/app' {
  export interface FirebaseApp {}
  
  export function initializeApp(config: any): FirebaseApp;
  export function getApps(): FirebaseApp[];
}

declare module 'firebase/analytics' {
  export interface Analytics {}
  
  export function getAnalytics(app: any): Analytics;
}

declare module 'firebase/firestore' {
  export interface Firestore {}
  
  export function getFirestore(app: any): Firestore;
}

declare module 'firebase/auth' {
  export interface Auth {}
  
  export function getAuth(app: any): Auth;
} 