"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { 
  Send, 
  Loader2, 
  Bot, 
  Plus, 
  Search,
  MessageSquare,
  Trash2,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  Edit2,
  Check,
  X,
  ChevronDown,
  MessageCircle,
  Calendar,
  AlertTriangle,
  Settings,
  BarChart
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { BsFileBarGraph } from "react-icons/bs";
import { 
  Message, 
  Conversation, 
  ChatWithSidebarProps, 
  MentionItem, 
  ActiveMention,
  PromptTemplate
} from "@/types/chat";
import { ChatSidebar } from "./ChatSidebar";
import { MessageList } from "./MessageList";
import { EnhancedChatInput } from "./EnhancedChatInput";
import { PromptTemplates } from "./PromptTemplates";

export function ChatWithSidebar({
  initialMessages = [],
  onSendMessage,
  className,
  userAvatar,
  aiName = "MowerMind AI",
  conversations = [],
  currentConversationId,
  onCreateNewChat,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversation,
  mowerId,
  mowerName,
}: ChatWithSidebarProps) {
  // State
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // Mention state
  const [activeMentions, setActiveMentions] = useState<ActiveMention[]>([]);
  // Real mowers state
  const [mowers, setMowers] = useState<Array<{ id: string; name: string; status: 'mowing' | 'charging' | 'idle' | 'error' }>>([]);
  const [isLoadingMowers, setIsLoadingMowers] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Fetch real mowers from API and Firestore
  useEffect(() => {
    async function fetchMowers() {
      try {
        setIsLoadingMowers(true);
        
        // Get token from localStorage using the correct key name
        const token = localStorage.getItem('mowerAccessToken');
        console.log('MOWER ACCESS TOKEN AVAILABLE:', !!token);
        
        if (!token) {
          console.log('No mower access token found, cannot fetch mowers');
          return;
        }
        
        console.log('Attempting to fetch mowers from API...');
        const response = await fetch('/api/mowers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('Mowers API response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch mowers: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Mowers API response data:', data);
        
        if (data.success && Array.isArray(data.mowers)) {
          // Map API mowers to the format needed for mentions
          const formattedMowers = data.mowers.map((mower: {id: string; name: string; status: string}) => ({
            id: mower.id,
            name: mower.name,
            // Map API status to our status types
            status: mower.status as 'mowing' | 'charging' | 'idle' | 'error'
          }));
          
          setMowers(formattedMowers);
          console.log('Fetched real mowers for chat mentions:', formattedMowers);
        } else {
          console.log('No mowers found in API response or unexpected format');
        }
      } catch (error) {
        console.error('Error fetching mowers for chat:', error);
      } finally {
        setIsLoadingMowers(false);
      }
    }
    
    fetchMowers();
  }, []);

  // Auto-add the current mower as a mention if mowerId is provided
  useEffect(() => {
    if (mowerId && mowerName && !activeMentions.some(m => m.id === mowerId)) {
      // Find the mower in our fetched mowers to get its status
      const mowerWithStatus = mowers.find(m => m.id === mowerId);
      
      setActiveMentions(prev => [...prev, {
        id: mowerId,
        type: 'mower',
        name: mowerName,
        status: mowerWithStatus?.status || 'idle'
      }]);
    }
  }, [mowerId, mowerName, mowers, activeMentions]);

  // Derive messages to display from props
  const displayMessages = currentConversationId
    ? conversations.find(c => c.id === currentConversationId)?.messages || []
    : initialMessages;

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

  // Reset the input field and focus when we start a new chat to clear any stored state
  useEffect(() => {
    // Reset text state when conversation changes
    setInputValue("");
    setActiveMentions([]);
    
    // Focus the input field
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Check if we should show empty state
  useEffect(() => {
    setShowEmptyState(!currentConversationId || 
      (currentConversationId && displayMessages.length === 0));
  }, [currentConversationId, displayMessages.length]);

  // Handle selecting a mention item - simplified version
  const handleSelectMention = (item: MentionItem) => {
    // Just add the selected item to active mentions
    setActiveMentions(prev => [...prev, {
      id: item.id,
      type: item.type,
      name: item.name,
      status: item.type === 'mower' ? item.status : undefined
    }]);
  };

  // Add function to remove an active mention
  const handleRemoveMention = (mentionId: string, mentionType: 'mower' | 'conversation') => {
    setActiveMentions(prev => 
      prev.filter(m => !(m.id === mentionId && m.type === mentionType))
    );
  };

  // Function to handle message sending
  const handleSendMessage = async (message: string, file?: File | null) => {
    if (!message.trim() && activeMentions.length === 0 && !file) return;
    
    // Create formatted message
    let formattedMessage = message.trim();
    
    // Add mentions to the message if needed
    if (activeMentions.length > 0) {
      const mentionTexts = activeMentions.map(mention => {
        if (mention.type === 'mower') {
          return `@${mention.type}:${mention.id}:${mention.name}:${mention.status || 'idle'}`;
        }
        return `@${mention.type}:${mention.id}:${mention.name}`;
      }).join(' ');
      
      formattedMessage = `${mentionTexts} ${formattedMessage}`;
    }
    
    setIsTyping(true);
    setActiveMentions([]); // Clear active mentions

    // Add a temporary "thinking" message from the AI
    const tempMessageId = Math.random().toString(36).substring(2, 15);
    
    // If we have a current conversation, add a temporary message to it
    if (currentConversationId) {
      const conversation = conversations.find(c => c.id === currentConversationId);
      if (conversation) {
        const updatedMessages = [
          ...conversation.messages,
          {
            id: tempMessageId,
            content: "Thinking...",
            sender: "ai" as const,
            timestamp: new Date().toISOString(),
            isLoading: true,
          }
        ];
        
        if (onUpdateConversation) {
          onUpdateConversation(currentConversationId, {
            ...conversation,
            messages: updatedMessages,
          });
        }
      }
    }

    try {
      if (onSendMessage) {
        await onSendMessage(formattedMessage, currentConversationId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsTyping(false);
      
      // If needed, remove the temporary thinking message
      // This might not be necessary if the parent component already handles updating messages
    }
  };

  // Function to handle template selection
  const handleTemplateSelect = (template: PromptTemplate) => {
    // If the template requires a mower but none is selected
    if (template.requiresMower && !activeMentions.some(m => m.type === 'mower') && !mowerId) {
      // Auto-select a mower if available
      if (mowers.length > 0) {
        const defaultMower = mowers[0];
        setActiveMentions(prev => [...prev, {
          id: defaultMower.id,
          type: 'mower',
          name: defaultMower.name,
          status: defaultMower.status
        }]);
        
        // Set the input field with the template prompt
        setInputValue("@");
        
        // Focus on the input to let the user tag a mower
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 0);
        
        return;
      }
    }
    
    // Otherwise, just use the template
    handleSendMessage(template.prompt);
  };

  // Function to format message content with mentions
  const formatMessageWithMentions = useCallback((content: string) => {
    // Remove any remaining asterisks that might be causing formatting issues
    const cleanedContent = content.replace(/\*([^*]+)\*/g, '$1');
    
    // Match pattern @type:id:name or @type:id:name:status
    const mentionPattern = /@(mower|conversation):([^:]+):([^:@]+)(?::([^@]+))?/g;
    
    // Split the content at mention patterns
    const parts = cleanedContent.split(mentionPattern);
    
    if (parts.length <= 1) {
      return <>{cleanedContent}</>;
    }
    
    const formattedParts: React.ReactNode[] = [];
    let key = 0;
    
    for (let i = 0; i < parts.length; i++) {
      if (i % 5 === 0) {
        // Regular text
        if (parts[i]) {
          formattedParts.push(<span key={key++}>{parts[i]}</span>);
        }
      } else if (i % 5 === 1) {
        // This is the mention type
        const type = parts[i];
        const id = parts[i+1];
        const name = parts[i+2];
        const status = parts[i+3]; // May be undefined for conversation type
        
        if (type && id && name) {
          // Get color based on status - use more vibrant colors
          let statusColor = 'bg-gray-400'; // Default color
          
          if (type === 'mower' && status) {
            switch(status.trim()) {
              case 'mowing':
                statusColor = 'bg-emerald-500'; // Bright green for mowing
                break;
              case 'charging':
                statusColor = 'bg-blue-600'; // Brighter blue for charging
                break;
              case 'idle':
                statusColor = 'bg-amber-500'; // Brighter amber for idle
                break;
              case 'error':
                statusColor = 'bg-rose-600'; // Bright rose/red for error
                break;
            }
          }
          
          formattedParts.push(
            <Badge 
              key={key++} 
              variant={type === 'mower' ? "outline" : "secondary"}
              className={cn(
                "px-2 py-0.5 text-xs gap-1 ml-1 mr-1 inline-flex items-center",
                type === 'conversation' && "bg-secondary"
              )}
            >
              {type === 'mower' ? (
                <span className={cn(
                  "h-5 w-5 relative rounded-sm overflow-hidden flex items-center justify-center", 
                  statusColor
                )}>
                  <span className="h-4 w-4 relative z-10">
                    <Image
                      src="/images/monochrome_large.webp"
                      alt="Mower"
                      fill
                      className="object-contain brightness-0 invert" // Make icon white
                    />
                  </span>
                </span>
              ) : (
                <MessageCircle className="h-3 w-3 mr-1" />
              )}
              <span className="ml-1">{name.trim()}</span>
            </Badge>
          );
          
          // Skip the next three parts (id, name, and possibly status) as we've already used them
          i += 3;
        } else {
          // Skip the next two parts (id and name) as they're incomplete
          i += 2;
        }
      }
    }
    
    return <>{formattedParts}</>;
  }, []);

  // Effects
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Set shouldScroll when component mounts
  useEffect(() => {
    setShouldScroll(true);
  }, []);
  
  // Set shouldScroll when displayMessages change
  useEffect(() => {
    if (displayMessages.length > 0) {
      setShouldScroll(true);
    }
  }, [displayMessages]);

  // Handle the actual scrolling
  useEffect(() => {
    if (shouldScroll) {
      scrollToBottom();
      setShouldScroll(false);
    }
  }, [shouldScroll, scrollToBottom]);

  const handleCreateNewChat = () => {
    if (onCreateNewChat) {
      onCreateNewChat();
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId);
    }
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (onDeleteConversation) {
      onDeleteConversation(conversationId);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => {
    return (
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.snippet.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Add function to update conversation title
  const handleUpdateConversationTitle = () => {
    if (!currentConversationId || !editTitleValue.trim()) {
      setIsEditingTitle(false);
      return;
    }

    if (onUpdateConversation) {
      onUpdateConversation(currentConversationId, { title: editTitleValue.trim() });
    }

    setIsEditingTitle(false);
  };

  // Handle starting edit mode
  const startEditingTitle = () => {
    const currentConvo = conversations.find(c => c.id === currentConversationId);
    if (currentConvo) {
      setEditTitleValue(currentConvo.title);
      setIsEditingTitle(true);
      // Focus input after state update
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 0);
    }
  };

  // Handle canceling edit
  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
  };

  // Replace the mobile sidebar toggle button with a more modern design
  const MobileSidebarToggle = ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="lg:hidden h-8 w-8 rounded-full bg-background/80 hover:bg-background border border-border/30 shadow-sm"
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isOpen ? (
        <PanelLeftClose className="h-4 w-4" />
      ) : (
        <PanelLeftOpen className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="flex h-full overflow-hidden bg-gradient-to-b from-background/80 to-background border rounded-lg shadow-sm">
      {/* Sidebar Section */}
      <div
        className={cn(
          "border-r border-border h-full transition-all duration-300 ease-in-out bg-background/90 backdrop-blur-sm",
          sidebarOpen
            ? "w-64 lg:w-80 opacity-100"
            : "w-0 opacity-0 lg:opacity-100 lg:w-80"
        )}
      >
        {sidebarOpen && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Conversations</h2>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 gap-1"
                onClick={handleCreateNewChat}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="text-xs">New Chat</span>
              </Button>
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={cn(
                    "pl-9 h-9 text-sm bg-muted/50 border-muted",
                    isSearchFocused ? "ring-1 ring-primary/50" : ""
                  )}
                />
              </div>
            </div>
            <ChatSidebar
              conversations={filteredConversations}
              currentConversationId={currentConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onUpdateConversation={handleUpdateConversationTitle}
              onCreateNewChat={handleCreateNewChat}
              formatMessageWithMentions={formatMessageWithMentions}
            />
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile sidebar toggle and header */}
        <div className="w-full h-12 px-3 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <MobileSidebarToggle isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
            
            {/* Current conversation or mower info */}
            <div className="flex items-center">
              {mowerId && mowerName ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative h-6 w-6 rounded-sm overflow-hidden bg-primary/10 flex items-center justify-center">
                    <Image
                      src="/images/monochrome_large.webp"
                      alt="Mower"
                      fill
                      className="object-contain brightness-0 opacity-70"
                    />
                  </div>
                  <span className="font-medium text-sm">{mowerName}</span>
                </div>
              ) : (
                <span className="text-sm font-medium">
                  {currentConversationId 
                    ? conversations.find(c => c.id === currentConversationId)?.title || 'Chat'
                    : 'New Chat'
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chat messages or empty state */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showEmptyState ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/30">
              <div className="max-w-3xl w-full text-center mb-8">
                <h2 className="text-2xl font-semibold mb-3">Welcome to MowerMind AI</h2>
                <p className="text-muted-foreground mx-auto max-w-md">
                  Ask questions about your robotic mower, get maintenance tips, or control your device.
                </p>
              </div>
              
              {/* Prompt Templates */}
              <PromptTemplates 
                onTemplateSelect={handleTemplateSelect}
                hasMowerContext={!!mowerId}
              />
            </div>
          ) : (
            <MessageList
              messages={displayMessages}
              userAvatar={userAvatar}
              aiName={aiName}
              formatMessageWithMentions={formatMessageWithMentions}
            />
          )}
          
          {/* Chat Input */}
          <EnhancedChatInput
            onSubmit={handleSendMessage}
            showTypingIndicator={isTyping}
            placeholder="Type a message... (Use @ to mention mowers or conversations)"
            suggestions={[
              "What is the status of my mower?",
              "Create a mowing schedule for my lawn",
              "How can I optimize battery life?",
              "When should I replace the blades?",
              "Help me troubleshoot an error"
            ]}
          />
        </div>
      </div>
    </div>
  );
} 