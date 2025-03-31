"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import Image from "next/image"
import {
  CircleFadingPlus,
  CircleOff,
  CircleUserRound,
  ListFilter,
  Menu,
  MessageCircle,
  MessageSquareDashed,
  MessageSquareDot,
  Paperclip,
  Phone,
  Search,
  Send,
  Settings,
  Smile,
  Star,
  User,
  User2,
  Users,
  Calendar,
  AlertTriangle,
  BarChart
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CardDescription, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getAIResponse, createMowerSystemPrompt } from '@/lib/google-ai'
import { BsFileBarGraph } from "react-icons/bs"

// Get mower name from API instead of using hardcoded values
const getMowerNameFromId = async (id: string | null): Promise<string | null> => {
  if (!id) return null;
  
  try {
    // Get token from localStorage using the correct key
    const token = localStorage.getItem('mowerAccessToken');
    if (!token) {
      console.log('No mower access token found, cannot fetch mower info');
      return null;
    }
    
    // Get details for the specific mower
    const response = await fetch(`/api/mowers/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch mower: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.mower) {
      return data.mower.name;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching mower info:', error);
    return null;
  }
};

// Message and Conversation types
interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  isLoading?: boolean;
}

// Store chat history for AI context
interface AIMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Conversation type for the chat sidebar
interface Conversation {
  id: string;
  title: string;
  snippet: string;
  lastMessageDate: string;
  messages: Message[];
  mowerId?: string;
  mowerName?: string;
}

// Prompt template type
interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  icon: React.ReactNode;
  requiresMower: boolean;
}

// Custom hook for mobile detection
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  React.useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Initial check
    checkIfMobile()
    
    // Add event listener
    window.addEventListener("resize", checkIfMobile)
    
    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  return isMobile
}

// SidebarProvider context
type SidebarContextType = {
  isOpen: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true)
  const isMobile = useIsMobile()

  // Close sidebar by default on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false)
    }
  }, [isMobile])

  const toggleSidebar = React.useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const value = React.useMemo(() => ({
    isOpen,
    toggleSidebar
  }), [isOpen, toggleSidebar])

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

// Sidebar component
function Sidebar({ 
  conversations, 
  onSelectConversation, 
  onCreateNewChat, 
  onDeleteConversation,
  onUpdateConversation,
  currentConversationId 
}: { 
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onUpdateConversation?: (id: string, updates: Partial<Conversation>) => void;
  currentConversationId: string | null;
}) {
  const { toggleSidebar } = useSidebar()
  const [searchQuery, setSearchQuery] = useState("")
  
  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => {
    return (
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.snippet.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });
  
  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User2 className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Search and New Chat */}
      <div className="p-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search conversations" 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={onCreateNewChat}>
          <CircleFadingPlus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      {/* Filter */}
      <div className="px-4 py-2 flex justify-between items-center">
        <h3 className="text-sm font-medium">Recent Chats</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <ListFilter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter By</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Star className="mr-2 h-4 w-4" /> Favorites
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CircleUserRound className="mr-2 h-4 w-4" /> Mower Chats
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageCircle className="mr-2 h-4 w-4" /> General Chats
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Conversation List */}
      <ScrollArea className="flex-grow">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <div
              role="button"
              tabIndex={0}
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectConversation(conversation.id);
                }
              }}
              className={`w-full px-4 py-3 hover:bg-secondary cursor-pointer text-left border-b border-border/50 last:border-0 group ${
                conversation.id === currentConversationId ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {conversation.mowerId ? (
                    <div className="flex items-center justify-center bg-primary/10 h-full w-full">
                      <Image
                        src="/images/monochrome_large.webp"
                        alt="Mower"
                        width={24}
                        height={24}
                        className="object-contain brightness-0 opacity-70"
                      />
                    </div>
                  ) : (
                    <AvatarFallback>
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-1 flex-1 overflow-hidden min-w-0">
                  <div className="flex justify-between items-center w-full">
                    <CardTitle className="text-sm truncate max-w-[80%]">{conversation.title}</CardTitle>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardDescription className="text-xs line-clamp-1 w-full">
                    {conversation.snippet}
                  </CardDescription>
                  <div className="text-xs text-muted-foreground">
                    {conversation.lastMessageDate}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            No conversations found
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// Message component
function MessageItem({ message }: { message: Message }) {
  return (
    <div className={`w-full py-4 ${message.sender === 'user' ? 'bg-secondary/20' : 'bg-background'} border-b border-border/40`}>
      <div className="max-w-4xl mx-auto w-full flex items-start gap-4">
        {message.sender === 'ai' ? (
          <Avatar className="h-8 w-8 mt-1">
            <div className="flex items-center justify-center bg-primary/10 h-full w-full">
              <Image
                src="/images/monochrome_large.webp"
                alt="MowerMind AI"
                width={20}
                height={20}
                className="object-contain brightness-0 opacity-70"
              />
            </div>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-8 w-8 mt-1">
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1">
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
              <p className="text-sm">Thinking...</p>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-line">{message.content}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// Empty state with template buttons
function EmptyState({ 
  onTemplateSelect, 
  hasMowerContext 
}: { 
  onTemplateSelect: (template: PromptTemplate) => void;
  hasMowerContext: boolean;
}) {
  // Define prompt templates
  const promptTemplates: PromptTemplate[] = [
    {
      id: 'schedule-analysis',
      title: 'Optimize Mowing Schedule',
      prompt: 'Create an optimal mowing schedule based on weather, lawn growth rate, and battery efficiency.',
      icon: <Calendar className="h-5 w-5" />,
      requiresMower: true
    },
    {
      id: 'diagnostics',
      title: 'Run Mower Diagnostics',
      prompt: 'Run diagnostics on my mower. Check for errors and suggest performance improvements.',
      icon: <AlertTriangle className="h-5 w-5" />,
      requiresMower: true
    },
    {
      id: 'property-analysis',
      title: 'Property Area Analysis',
      prompt: 'Analyze my lawn for optimal mower settings. Check size, terrain, obstacles, and boundaries.',
      icon: <BsFileBarGraph className="h-5 w-5" />,
      requiresMower: true
    },
    {
      id: 'maintenance-tips',
      title: 'Maintenance Tips',
      prompt: 'What maintenance should I perform on my robotic mower to keep it working properly?',
      icon: <Settings className="h-5 w-5" />,
      requiresMower: false
    },
    {
      id: 'efficiency-report',
      title: 'Efficiency Report',
      prompt: 'Create an efficiency report for my mower. How can I improve battery life and cutting performance?',
      icon: <BarChart className="h-5 w-5" />,
      requiresMower: true
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-3xl w-full text-center mb-8">
        <h2 className="text-2xl font-semibold mb-3">Welcome to MowerMind AI</h2>
        <p className="text-muted-foreground mx-auto max-w-md">
          Ask questions about your robotic mower, get maintenance tips, or control your device.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {promptTemplates.map((template) => (
          <Button
            key={template.id}
            variant="outline"
            className={`h-auto p-4 flex flex-col items-start gap-2 ${!hasMowerContext && template.requiresMower ? 'opacity-60' : ''}`}
            onClick={() => onTemplateSelect(template)}
            disabled={!hasMowerContext && template.requiresMower}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {template.icon}
            </div>
            <div className="text-left">
              <h3 className="font-medium">{template.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{template.prompt}</p>
            </div>
            {!hasMowerContext && template.requiresMower && (
              <div className="text-xs text-muted-foreground mt-1">
                Requires a mower connection
              </div>
            )}
          </Button>
        ))}
      </div>
    </div>
  )
}

// Chat component
function Chat({ 
  messages, 
  onSendMessage, 
  showEmptyState,
  onTemplateSelect,
  hasMowerContext,
  aiName
}: { 
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  showEmptyState: boolean;
  onTemplateSelect: (template: PromptTemplate) => void;
  hasMowerContext: boolean;
  aiName: string;
}) {
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesLengthRef = useRef(messages.length)
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);
  
  // Additional effect to scroll when messages update
  useEffect(() => {
    // Only scroll if the messages array length has changed
    if (messagesLengthRef.current !== messages.length) {
      messagesLengthRef.current = messages.length;
      
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);
  
  const handleSendMessage = async () => {
    if (newMessage.trim() === "") return
    
    // Send message to parent component
    await onSendMessage(newMessage);
    setNewMessage("")
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <div className="flex items-center justify-center bg-primary/10 h-full w-full">
              <Image
                src="/images/monochrome_large.webp"
                alt="MowerMind AI"
                width={24}
                height={24}
                className="object-contain brightness-0 opacity-70"
              />
            </div>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-sm">{aiName}</CardTitle>
            <CardDescription className="text-xs">Online</CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Messages or Empty State */}
      {showEmptyState ? (
        <EmptyState onTemplateSelect={onTemplateSelect} hasMowerContext={hasMowerContext} />
      ) : (
        <div className="flex-grow overflow-y-auto">
          <div>
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      )}
      
      {/* Message Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Button type="button" variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Type a message"
            className="flex-grow"
          />
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            onClick={handleSendMessage}
            disabled={newMessage.trim() === ""}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Main Chat Layout
function ChatLayout() {
  const searchParams = useSearchParams();
  const mowerId = searchParams.get('mower');
  const agent = searchParams.get('agent') || 'MowerMind AI';
  const context = searchParams.get('context');
  const [mowerName, setMowerName] = useState<string | null>(null);
  
  // AI chat history for context
  const aiChatHistory = useRef<AIMessage[]>([]);
  
  // Initial welcome message based on whether a specific mower was selected
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  
  // Conversations history state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(true);
  const { isOpen } = useSidebar();

  // Effect to load saved conversations from local storage
  useEffect(() => {
    const savedConversations = localStorage.getItem('chatConversations');
    if (savedConversations) {
      try {
        setConversations(JSON.parse(savedConversations));
      } catch (error) {
        console.error('Error parsing saved conversations:', error);
      }
    }
  }, []);

  // Fetch mower name
  useEffect(() => {
    async function fetchMowerName() {
      if (mowerId) {
        const name = await getMowerNameFromId(mowerId);
        setMowerName(name);
      }
    }
    
    fetchMowerName();
  }, [mowerId]);

  // Save conversations to local storage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('chatConversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    // Only initialize messages once we have mower name
    if (mowerId && !mowerName) {
      return; // Wait until mower name is loaded
    }
    
    const messages: Message[] = [];
    const currentTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    
    // Initialize AI chat history with a dummy user message to satisfy the API requirement
    // The first message must be from the user according to Gemini API requirements
    aiChatHistory.current = [{
      role: 'user',
      parts: [{ text: 'Hello' }]
    }];
    
    // Add an agent message with the provided context if available
    if (context) {
      // If there's a context, first add it as a past user message
      messages.push({
        id: '1',
        content: context,
        sender: "user",
        timestamp: currentTime,
      });
      
      // Add to AI chat history
      aiChatHistory.current.push({
        role: 'user',
        parts: [{ text: context }]
      });
      
      // Then add a response from the agent/support
      messages.push({
        id: '2',
        content: `I see you were asking about: "${context}". Let me help you with that.`,
        sender: "ai",
        timestamp: currentTime,
      });
      
      // Add to AI chat history
      aiChatHistory.current.push({
        role: 'model',
        parts: [{ text: `I see you were asking about: "${context}". Let me help you with that.` }]
      });
    } else {
      // Create a system message with the mower context
      const systemPrompt = createMowerSystemPrompt(mowerName || undefined);
      
      // Add system message to AI chat history as a response to the initial "Hello"
      aiChatHistory.current.push({
        role: 'model',
        parts: [{ text: systemPrompt }]
      });
      
      // No welcome message - this will allow conversation starters to show
    }
    
    setInitialMessages(messages);
  }, [context, mowerName, mowerId]);

  // Get messages to display
  const getDisplayMessages = () => {
    if (currentConversationId) {
      const conversation = conversations.find(c => c.id === currentConversationId);
      return conversation ? conversation.messages : initialMessages;
    }
    return initialMessages;
  };

  // Real message handler that connects to the Google Generative AI API
  const handleSendMessage = async (message: string): Promise<void> => {
    try {
      // Track the active conversation ID (original or newly created)
      let activeConversationId = currentConversationId;
      
      // Create timestamp and date for messages
      const timestamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      // Create user message
      const newUserMessage: Message = {
        id: Date.now().toString(),
        content: message,
        sender: "user",
        timestamp,
      };
      
      // Add user message to AI chat history
      aiChatHistory.current.push({
        role: 'user',
        parts: [{ text: message }]
      });
      
      // IMMEDIATELY update the UI with the user message
      if (currentConversationId) {
        // Update existing conversation with just the user message
        setConversations(prevConversations => {
          return prevConversations.map(convo => {
            if (convo.id === currentConversationId) {
              return {
                ...convo,
                messages: [...convo.messages, newUserMessage],
                lastMessageDate: dateStr,
              };
            }
            return convo;
          });
        });
      } else {
        // Create a new conversation with just the user message initially
        const newConversationId = uuidv4();
        activeConversationId = newConversationId; // Update our tracking variable
        
        // Generate title from user message
        const conversationTitle = message.length > 40 
          ? `${message.substring(0, 40)}...` 
          : message;
          
        const newConversation: Conversation = {
          id: newConversationId,
          title: conversationTitle,
          snippet: message, // Use user message as snippet initially
          lastMessageDate: dateStr,
          messages: [...initialMessages, newUserMessage],
          mowerId: mowerId || undefined,
          mowerName: mowerName || undefined,
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversationId);
        setShowEmptyState(false);
      }

      // Create AI thinking message
      const thinkingMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Thinking...",
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        isLoading: true,
      };

      // Add thinking message to UI
      setConversations(prevConversations => {
        return prevConversations.map(convo => {
          if (convo.id === activeConversationId) {
            return {
              ...convo,
              messages: [...convo.messages, thinkingMessage],
            };
          }
          return convo;
        });
      });
      
      // Get response from AI (this might take some time)
      const response = await getAIResponse(message, aiChatHistory.current);
      
      // Add AI response to chat history
      aiChatHistory.current.push({
        role: 'model',
        parts: [{ text: response }]
      });
      
      // Create AI message object
      const newAiMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: response,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };
      
      // Update the conversation with the AI response (replacing thinking message)
      setConversations(prevConversations => {
        return prevConversations.map(convo => {
          if (convo.id === activeConversationId) {
            return {
              ...convo,
              messages: [...convo.messages.filter(m => !m.isLoading), newAiMessage],
              snippet: response, // Update snippet with AI response
              lastMessageDate: dateStr,
            };
          }
          return convo;
        });
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Update UI with error message
      if (currentConversationId) {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: "I'm sorry, I encountered an error processing your request. Please try again.",
          sender: "ai",
          timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        };
        
        setConversations(prevConversations => {
          return prevConversations.map(convo => {
            if (convo.id === currentConversationId) {
              return {
                ...convo,
                messages: [...convo.messages.filter(m => !m.isLoading), errorMessage],
              };
            }
            return convo;
          });
        });
      }
    }
  };

  // Handle creating a new chat
  const handleCreateNewChat = useCallback(() => {
    setCurrentConversationId(null);
    // Reset AI chat history
    const systemPrompt = createMowerSystemPrompt(mowerName || undefined);
    // Initialize with a dummy user message first
    aiChatHistory.current = [
      {
        role: 'user',
        parts: [{ text: 'Hello' }]
      },
      {
        role: 'model',
        parts: [{ text: systemPrompt }]
      }
    ];
    setShowEmptyState(true);
  }, [mowerName]);

  // Handle selecting an existing conversation
  const handleSelectConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
    
    // Reset AI chat history with the selected conversation
    const selectedConvo = conversations.find(c => c.id === conversationId);
    if (selectedConvo) {
      // Initialize with a dummy user message first
      aiChatHistory.current = [{
        role: 'user',
        parts: [{ text: 'Hello' }]
      }];
      
      // Add system prompt first
      const systemPrompt = createMowerSystemPrompt(selectedConvo.mowerName || undefined);
      aiChatHistory.current.push({
        role: 'model',
        parts: [{ text: systemPrompt }]
      });
      
      // Add all messages
      for (const msg of selectedConvo.messages) {
        aiChatHistory.current.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }
      
      setShowEmptyState(selectedConvo.messages.length === 0);
    }
  }, [conversations]);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(convo => convo.id !== conversationId));
    
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null);
      handleCreateNewChat();
    }
  }, [currentConversationId, handleCreateNewChat]);

  // Handle updating a conversation (title, etc.)
  const handleUpdateConversation = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(convo => {
      if (convo.id === conversationId) {
        return { ...convo, ...updates };
      }
      return convo;
    }));
  }, []);

  // Handle template selection
  const handleTemplateSelect = (template: PromptTemplate) => {
    handleSendMessage(template.prompt);
  };

  // Update empty state whenever conversation or messages change
  useEffect(() => {
    // Check if we should show empty state
    if (!currentConversationId) {
      setShowEmptyState(true);
    } else {
      const conversation = conversations.find(c => c.id === currentConversationId);
      setShowEmptyState(!conversation || conversation.messages.length === 0);
    }
  }, [currentConversationId, conversations]);

  return (
    <>
      {mowerId && (
        <div className="flex items-center bg-primary/5 px-4 py-2 gap-3 text-sm border-b border-border text-muted-foreground w-full">
          <div className="flex gap-2 items-center">
            <Image
              src="/images/monochrome_large.webp"
              alt="Mower"
              width={18}
              height={18}
              className="object-contain brightness-0 opacity-70"
            />
            <span>Connected to: {mowerName || mowerId}</span>
          </div>
        </div>
      )}
    
      <ResizablePanelGroup
        direction="horizontal"
        className="h-[calc(100vh-4rem)]"
        onLayout={(sizes: number[]) => {
          document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`
        }}
      >
        {isOpen && (
          <>
            <ResizablePanel 
              defaultSize={25} 
              collapsible={true}
              minSize={15}
              maxSize={40}
              className="hidden md:block"
            >
              <Sidebar
                conversations={conversations}
                onSelectConversation={handleSelectConversation}
                onCreateNewChat={handleCreateNewChat}
                onDeleteConversation={handleDeleteConversation}
                currentConversationId={currentConversationId}
              />
            </ResizablePanel>
            <ResizableHandle className="hidden md:flex" />
          </>
        )}
        <ResizablePanel defaultSize={75}>
          <Chat
            messages={getDisplayMessages()}
            onSendMessage={handleSendMessage}
            showEmptyState={showEmptyState}
            onTemplateSelect={handleTemplateSelect}
            hasMowerContext={Boolean(mowerName)}
            aiName={agent}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  )
}

// Main component with provider
export default function ImprovedChatLayout() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <SidebarProvider>
        <ChatLayout />
      </SidebarProvider>
    </div>
  )
} 