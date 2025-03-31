"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  PlusCircle,
  Filter,
  Search,
  Clock,
  ChevronLeft,
  MoreVertical,
  BookOpen,
  Zap,
  PanelLeftOpen,
  PanelLeftClose,
  Info,
  AlertCircle,
  CheckCircle2,
  Tag,
  Settings,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Share2,
  ChevronRight,
  GripVertical,
  Edit2,
  Trash2,
  Paperclip,
  Smile,
  Send,
  Calendar,
  BatteryMedium,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import TextareaAutosize from 'react-textarea-autosize';

// Define types for the component props
interface Mower {
  id: string;
  name: string;
  model: string;
  battery: number;
  status: string;
  lastActive: string;
}

interface Message {
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

interface Conversation {
  id: string;
  title: string;
  snippet: string;
  lastMessageDate: string;
  status: "active" | "pending" | "resolved";
  tags: any[];
  messages: Message[];
  isPinned?: boolean;
}

interface MowerChatPlatformProps {
  initialMowers: Mower[];
  initialConversations: Conversation[];
  onSendMessage: (message: string, conversationId: string, tags: any[]) => Promise<void>;
  onCreateTicket: (conversationId: string, message: string) => Promise<void>;
  userAvatar?: string;
  aiAvatar?: string;
}

// Define interface for prompt templates
interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  icon: React.ReactNode;
}

// Import components
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";

export function MowerChatPlatform({
  initialMowers,
  initialConversations,
  onSendMessage,
  onCreateTicket,
  userAvatar = "/images/user-avatar.png",
  aiAvatar = "/images/ai-avatar.png",
}: MowerChatPlatformProps) {
  // State management
  const [mowers, setMowers] = useState<Mower[]>(initialMowers);
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations.map(conv => ({ ...conv, isPinned: false }))
  );
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversations.length > 0 ? initialConversations[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "pending" | "resolved">("all");
  const [filterDateRange, setFilterDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [renameModalOpen, setRenameModalOpen] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);

  // Predefined prompt templates for quick access
  const promptTemplates = [
    {
      id: "schedule",
      title: "Create Schedule",
      prompt: "I'd like to create an optimal mowing schedule for my yard.",
      icon: <Calendar className="h-4 w-4" />
    },
    {
      id: "battery",
      title: "Battery Help",
      prompt: "My mower's battery seems to drain quickly. How can I improve its life?",
      icon: <BatteryMedium className="h-4 w-4" />
    },
    {
      id: "maintenance",
      title: "Maintenance",
      prompt: "What maintenance should I perform on my mower this month?",
      icon: <Settings className="h-4 w-4" />
    },
    {
      id: "error",
      title: "Diagnose Error",
      prompt: "My mower is showing an error code. How do I troubleshoot it?",
      icon: <AlertCircle className="h-4 w-4" />
    }
  ];

  // Handle applying a prompt template
  const handleApplyTemplate = (template: PromptTemplate) => {
    setInputValue(template.prompt);
    setShowPromptTemplates(false);
  };

  // Handle sidebar toggle
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Create a new conversation
  const handleCreateNewConversation = () => {
    const newConversationId = `conv-${uuidv4()}`;
    const newConversation: Conversation = {
      id: newConversationId,
      title: "New Conversation",
      snippet: "Start typing to begin a conversation",
      lastMessageDate: new Date().toISOString(),
      status: "active",
      tags: [],
      messages: [],
      isPinned: false
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversationId);
  };

  // Select a conversation
  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    if (sidebarCollapsed) {
      setSidebarCollapsed(false); // Auto-expand sidebar when selecting conversation on mobile
    }
  };

  // Delete a conversation
  const handleDeleteConversation = (conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    // If the deleted conversation was current, select another one
    if (currentConversationId === conversationId) {
      const remainingConversations = conversations.filter(conv => conv.id !== conversationId);
      setCurrentConversationId(remainingConversations.length > 0 ? remainingConversations[0].id : null);
    }
  };

  // Toggle pin status for a conversation
  const togglePinConversation = (conversationId: string) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, isPinned: !conv.isPinned };
        }
        return conv;
      })
    );
  };

  // Start rename for a conversation
  const startRenameConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setNewTitle(conversation.title);
      setRenameModalOpen(conversationId);
      // Focus the input after the modal appears
      setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
        }
      }, 50);
    }
  };

  // Complete rename for a conversation
  const completeRenameConversation = (conversationId: string) => {
    if (newTitle.trim()) {
      setConversations(prev => 
        prev.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, title: newTitle.trim() };
          }
          return conv;
        })
      );
    }
    setRenameModalOpen(null);
  };

  // Update a conversation
  const handleUpdateConversation = (conversationId: string, updates: Partial<Conversation>) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, ...updates };
        }
        return conv;
      })
    );
  };

  // Toggle reaction on a message
  const toggleMessageReaction = (conversationId: string, messageId: string, reactionType: "like" | "dislike") => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          const updatedMessages = conv.messages.map(message => {
            if (message.id === messageId) {
              const existingReactionIndex = message.reactions?.findIndex(r => r.type === reactionType);
              
              if (existingReactionIndex !== undefined && existingReactionIndex >= 0) {
                // Remove the reaction if it exists
                const newReactions = [...(message.reactions || [])];
                newReactions.splice(existingReactionIndex, 1);
                return { ...message, reactions: newReactions };
              } else {
                // Add the reaction
                return { 
                  ...message, 
                  reactions: [
                    ...(message.reactions || []).filter(r => r.type !== (reactionType === "like" ? "dislike" : "like")), // Remove opposite reaction
                    { type: reactionType, timestamp: new Date().toISOString() }
                  ] 
                };
              }
            }
            return message;
          });
          
          return { ...conv, messages: updatedMessages };
        }
        return conv;
      })
    );
  };

  // Toggle save status on a message
  const toggleSaveMessage = (conversationId: string, messageId: string) => {
    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          const updatedMessages = conv.messages.map(message => {
            if (message.id === messageId) {
              return { ...message, isSaved: !message.isSaved };
            }
            return message;
          });
          
          return { ...conv, messages: updatedMessages };
        }
        return conv;
      })
    );
  };

  // Send a message
  const handleSendMessage = async () => {
    if (!currentConversationId || !inputValue.trim()) return;
    
    try {
      // Add user message to conversation
      const newUserMessage: Message = {
        id: `user-${uuidv4()}`,
        content: inputValue.trim(),
        sender: "user",
        timestamp: new Date().toISOString(),
        tags: [],
        reactions: []
      };
      
      // Update the conversation
      const updatedConversations = conversations.map(conv => {
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            snippet: inputValue.length > 50 ? inputValue.substring(0, 50) + "..." : inputValue,
            lastMessageDate: new Date().toISOString(),
            messages: [...conv.messages, newUserMessage]
          };
        }
        return conv;
      });
      
      setConversations(updatedConversations);
      setInputValue("");
      
      // Send the message to the API
      await onSendMessage(inputValue, currentConversationId, []);
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
    }
  };

  // Create support ticket
  const handleCreateSupportTicket = async (conversationId: string) => {
    const conversation = conversations.find(conv => conv.id === conversationId);
    if (!conversation) return;
    
    try {
      const ticketMessage = `Support requested for: ${conversation.title}`;
      await onCreateTicket(conversationId, ticketMessage);
    } catch (error) {
      console.error("Error creating support ticket:", error);
    }
  };

  // Sort conversations with pinned ones first, then by date
  const sortedConversations = [...conversations].sort((a, b) => {
    // Pinned conversations come first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    // Then sort by date (newest first)
    return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
  });

  // Filter conversations based on search, filters, and active tab
  const filteredConversations = sortedConversations.filter(conversation => {
    // Text search
    const matchesSearch = searchQuery.trim() === "" || 
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.snippet.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Status filter
    if (filterStatus !== "all" && conversation.status !== filterStatus) {
      return false;
    }
    
    // Tab filter
    if (activeTab === "pinned" && !conversation.isPinned) {
      return false;
    }
    
    // Date filtering
    if (filterDateRange !== "all") {
      const lastMessageDate = new Date(conversation.lastMessageDate);
      const now = new Date();
      
      if (filterDateRange === "today") {
        const isToday = lastMessageDate.getDate() === now.getDate() && 
                         lastMessageDate.getMonth() === now.getMonth() && 
                         lastMessageDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (filterDateRange === "week") {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        if (lastMessageDate < oneWeekAgo) return false;
      } else if (filterDateRange === "month") {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        if (lastMessageDate < oneMonthAgo) return false;
      }
    }
    
    return true;
  });

  // Get the current conversation
  const currentConversation = currentConversationId 
    ? conversations.find(conv => conv.id === currentConversationId) 
    : null;

  return (
    <div className="flex h-full overflow-hidden rounded-lg border bg-background shadow-lg relative">
      {/* Sidebar Component */}
      <ChatSidebar
        conversations={conversations}
        filteredConversations={filteredConversations}
        currentConversationId={currentConversationId}
        sidebarCollapsed={sidebarCollapsed}
        activeTab={activeTab}
        filterStatus={filterStatus}
        filterDateRange={filterDateRange}
        searchQuery={searchQuery}
        renameModalOpen={renameModalOpen}
        newTitle={newTitle}
        renameInputRef={renameInputRef}
        setActiveTab={setActiveTab}
        setSearchQuery={setSearchQuery}
        setFilterStatus={setFilterStatus}
        setFilterDateRange={setFilterDateRange}
        handleCreateNewConversation={handleCreateNewConversation}
        handleSelectConversation={handleSelectConversation}
        togglePinConversation={togglePinConversation}
        startRenameConversation={startRenameConversation}
        completeRenameConversation={completeRenameConversation}
        handleDeleteConversation={handleDeleteConversation}
        setNewTitle={setNewTitle}
        toggleSidebar={toggleSidebar}
      />
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col relative">
        {/* Floating sidebar open button - only visible when sidebar is collapsed */}
        {sidebarCollapsed && (
          <div className="absolute top-0 left-0 h-full z-20 flex items-center">
            <button
              className="flex items-center justify-center h-10 w-6 bg-background border-y border-r rounded-r-md shadow-md hover:bg-accent/80 transition-all"
              onClick={toggleSidebar}
              aria-label="Open sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {currentConversation ? (
          <div className={cn("flex flex-col h-full", sidebarCollapsed && "pl-6")}>
            {/* Chat Header Component */}
            <ChatHeader
              conversation={currentConversation}
              togglePinConversation={togglePinConversation}
              startRenameConversation={startRenameConversation}
              handleDeleteConversation={handleDeleteConversation}
              handleCreateSupportTicket={handleCreateSupportTicket}
            />
            
            {/* Message List Component */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex flex-col">
                <MessageList
                  conversation={currentConversation}
                  userAvatar={userAvatar}
                  aiAvatar={aiAvatar}
                  toggleMessageReaction={toggleMessageReaction}
                  toggleSaveMessage={toggleSaveMessage}
                />
                
                {/* Chat Input Component */}
                <ChatInput
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  handleSendMessage={handleSendMessage}
                  showPromptTemplates={showPromptTemplates}
                  setShowPromptTemplates={setShowPromptTemplates}
                  promptTemplates={promptTemplates}
                  handleApplyTemplate={handleApplyTemplate}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-primary/5 h-24 w-24 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-medium mb-3">Start a New Conversation</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Chat with your mower assistant for help with scheduling, troubleshooting, or general questions about your devices.
              </p>
              <Button onClick={handleCreateNewConversation} size="lg" className="px-8">
                <MessageSquare className="h-5 w-5 mr-2" />
                New Conversation
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
} 