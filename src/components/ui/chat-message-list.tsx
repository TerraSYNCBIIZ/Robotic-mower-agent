"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatBubble, ChatBubbleMessage } from "@/components/ui/chat-bubble";
import { Badge } from "@/components/ui/badge";

export interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  isLoading?: boolean;
  reactions?: {
    type: "like" | "dislike";
    timestamp: string;
  }[];
  isSaved?: boolean;
  tags?: any[];
}

interface ChatMessageListProps {
  messages: Message[];
  userAvatar?: string;
  aiAvatar?: string;
  className?: string;
  onReact?: (messageId: string, type: "like" | "dislike") => void;
  onSaveMessage?: (messageId: string) => void;
  showDateSeparators?: boolean;
}

export function ChatMessageList({
  messages,
  userAvatar = "/images/user-avatar.png",
  aiAvatar = "/images/ai-avatar.png",
  className,
  onReact,
  onSaveMessage,
  showDateSeparators = true,
}: ChatMessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  
  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollRef.current && atBottom) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, atBottom]);
  
  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Consider "at bottom" if within 100px of the bottom
    setAtBottom(scrollHeight - scrollTop - clientHeight < 100);
  };
  
  // Function to format the date
  const formatDate = React.useCallback((date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= today) {
      return "Today";
    } else if (date >= yesterday) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString(undefined, { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }, []);
  
  // Group messages by date if needed
  const messageGroups = React.useMemo(() => {
    if (!showDateSeparators) return { all: messages || [] };
    
    const groups: Record<string, Message[]> = {};
    
    if (messages) {
      messages.forEach(message => {
        const date = new Date(message.timestamp);
        const dateString = formatDate(date);
        
        if (!groups[dateString]) {
          groups[dateString] = [];
        }
        
        groups[dateString].push(message);
      });
    }
    
    return groups;
  }, [messages, showDateSeparators, formatDate]);
  
  return (
    <ScrollArea 
      ref={scrollRef} 
      className={cn("h-full px-4", className)}
      onScroll={handleScroll}
    >
      <div className="py-4 space-y-6">
        {showDateSeparators ? (
          Object.entries(messageGroups).map(([date, dateMessages]) => (
            <div key={date} className="space-y-6">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-2 text-xs text-muted-foreground">
                    {date}
                  </span>
                </div>
              </div>
              
              {dateMessages.map((message, index) => (
                <MessageItem 
                  key={message.id}
                  message={message}
                  userAvatar={userAvatar}
                  aiAvatar={aiAvatar}
                  index={index}
                  onReact={onReact}
                  onSaveMessage={onSaveMessage}
                />
              ))}
            </div>
          ))
        ) : (
          (messages || []).map((message, index) => (
            <MessageItem 
              key={message.id}
              message={message}
              userAvatar={userAvatar}
              aiAvatar={aiAvatar}
              index={index}
              onReact={onReact}
              onSaveMessage={onSaveMessage}
            />
          ))
        )}
        
        {/* Bottom auto-scroll button */}
        <AnimatePresence>
          {!atBottom && messages && messages.length > 5 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="sticky bottom-4 flex justify-center"
            >
              <button
                onClick={() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollTo({
                      top: scrollRef.current.scrollHeight,
                      behavior: "smooth",
                    });
                  }
                }}
                className="bg-primary text-primary-foreground shadow-lg rounded-full px-3 py-1.5 text-xs font-medium flex items-center"
              >
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="mr-1"
                >
                  <path d="M12 5L12 19M12 19L19 12M12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Latest messages
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}

function MessageItem({
  message,
  userAvatar,
  aiAvatar,
  index,
  onReact,
  onSaveMessage,
}: {
  message: Message;
  userAvatar: string;
  aiAvatar: string;
  index: number;
  onReact?: (messageId: string, type: "like" | "dislike") => void;
  onSaveMessage?: (messageId: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
    >
      <ChatBubble
        variant={message.sender === "user" ? "sent" : "received"}
      >
        {message.sender === "ai" && (
          <Avatar className="h-9 w-9 mt-1">
            <AvatarImage src={aiAvatar} alt="AI" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        )}
        
        <div className={cn("max-w-[80%] flex flex-col", message.sender === "user" && "items-end")}>
          <ChatBubbleMessage
            variant={message.sender === "user" ? "sent" : "received"}
            isLoading={message.isLoading}
          >
            <div className="prose dark:prose-invert prose-sm max-w-none">
              {message.content}
            </div>
            
            {message.tags && message.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.tags.map(tag => (
                  <Badge key={tag.id} variant="outline" className="text-xs py-0">
                    {tag.status && (
                      <span 
                        className={cn(
                          "inline-block w-2 h-2 rounded-full mr-1",
                          tag.status === "charging" && "bg-blue-500",
                          tag.status === "mowing" && "bg-green-500",
                          tag.status === "idle" && "bg-amber-500",
                          tag.status === "error" && "bg-red-500"
                        )} 
                      />
                    )}
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </ChatBubbleMessage>
          
          <div className={cn("text-xs text-muted-foreground mt-1", message.sender === "user" ? "text-right" : "")}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        {message.sender === "user" && (
          <Avatar className="h-9 w-9 mt-1">
            <AvatarImage src={userAvatar} alt="User" />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
        )}
      </ChatBubble>
    </motion.div>
  );
} 