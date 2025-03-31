import { ReactNode } from "react";

export interface Mower {
  id: string;
  name: string;
  model: string;
  battery: number;
  status: string;
  lastActive: string;
}

export interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  tags?: any[];
  reactions?: {
    type: "like" | "dislike";
    timestamp: string;
  }[];
  isSaved?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  snippet: string;
  lastMessageDate: string;
  status: "active" | "pending" | "resolved";
  tags: any[];
  messages: Message[];
  isPinned?: boolean;
}

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  icon: ReactNode;
}

export interface MowerChatPlatformProps {
  initialMowers: Mower[];
  initialConversations: Conversation[];
  onSendMessage: (message: string, conversationId: string, tags: any[]) => Promise<void>;
  onCreateTicket: (conversationId: string, message: string) => Promise<void>;
  userAvatar?: string;
  aiAvatar?: string;
} 