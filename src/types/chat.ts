import { ReactNode } from "react";

// Message type for chat messages
export interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  isLoading?: boolean;
}

// Conversation type for chat history
export interface Conversation {
  id: string;
  title: string;
  snippet: string;
  lastMessageDate: string;
  messages: Message[];
  mowerId?: string;
  mowerName?: string;
}

// MentionItem type for @ mentions
export interface MentionItem {
  id: string;
  type: 'mower' | 'conversation';
  name: string;
  status?: 'mowing' | 'charging' | 'idle' | 'error';
}

// ActiveMention type for selected mentions
export interface ActiveMention {
  id: string;
  type: 'mower' | 'conversation';
  name: string;
  status?: 'mowing' | 'charging' | 'idle' | 'error';
}

// PromptTemplate type for conversation starters
export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  icon: ReactNode;
  requiresMower: boolean;
}

// Props for the main ChatWithSidebar component
export interface ChatWithSidebarProps {
  initialMessages?: Message[];
  onSendMessage?: (message: string, conversationId: string | null) => Promise<string>;
  className?: string;
  userAvatar?: string;
  aiName?: string;
  conversations?: Conversation[];
  currentConversationId: string | null;
  onCreateNewChat?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onUpdateConversation?: (conversationId: string, updates: Partial<Conversation>) => void;
  mowerId?: string;
  mowerName?: string;
} 