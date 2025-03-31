import React, { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Bot, CheckCircle2 } from "lucide-react";
import { AnimatedBotAvatar, MessageLoading } from "./AnimatedBotAvatar";

// Define locally since we have import issues
interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  isLoading?: boolean;
}

interface MessageListProps {
  messages: Message[];
  userAvatar?: string;
  aiName?: string;
  formatMessageWithMentions?: (content: string) => React.ReactNode;
}

// Modern chat styles
const messageStyles = {
  container: "flex flex-col gap-6 py-4 px-2",
  messageBubble: {
    base: "rounded-2xl px-4 py-3 max-w-[85%] shadow-sm transition-all duration-200 ease-in-out",
    ai: "bg-muted border border-border/20 text-foreground hover:shadow-md",
    user: "bg-primary text-primary-foreground shadow-md",
  },
  messageContent: {
    base: "prose prose-sm dark:prose-invert max-w-none",
    typography: "prose-headings:font-semibold prose-headings:text-base prose-p:my-2 prose-pre:my-0 prose-pre:bg-primary/5 prose-pre:p-2 prose-pre:rounded prose-pre:text-xs"
  },
  list: {
    numbered: "pl-3 mt-2 space-y-2 list-decimal list-inside",
    bullet: "pl-3 mt-2 space-y-2 list-disc list-inside",
  },
  listItem: {
    base: "pl-1",
    nested: "ml-4 mt-1",
  },
  timestamp: "text-[10px] text-muted-foreground mt-2 text-right opacity-60",
  avatar: {
    container: "flex h-8 w-8 items-center justify-center rounded-full",
    ai: "bg-primary/10 text-primary",
    user: "bg-primary text-primary-foreground",
  }
};

export function MessageList({
  messages,
  userAvatar,
  aiName = "MowerMind AI",
  formatMessageWithMentions,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]); // Only scroll when message length changes

  // Process text content with enhanced formatting
  const renderFormattedContent = (content: string) => {
    // Pre-process content to properly format lists and spacing
    let formattedContent = content
      // Fix numbered lists - ensures space after numbers and adds line breaks if needed
      .replace(/(\d+\.)(\S)/g, '$1 $2')
      .replace(/(\d+\.\s+[^\d\n]+)(?=\d+\.)/g, '$1\n\n')
      // Fix asterisk & bullet formatting
      .replace(/\*(\w+):/g, '* $1:')
      .replace(/\s\*(\w+[^*\n]+)(?!\*)/g, '\n* $1')
      // Handle emphasis and paragraph spacing
      .replace(/\n{3,}/g, '\n\n');

    // Split into paragraphs
    const paragraphs = formattedContent.split(/\n\s*\n/);
    
    return (
      <>
        {paragraphs.map((paragraph, pIndex) => {
          const paragraphKey = `p-${pIndex}`;
          const trimmedParagraph = paragraph.trim();
          
          // Check if paragraph is a numbered list
          if (/^\d+\.\s/.test(trimmedParagraph)) {
            const listItems = trimmedParagraph.split(/\n/).filter(item => item.trim());
            
            return (
              <div key={paragraphKey} className="mb-3">
                <ol className={messageStyles.list.numbered}>
                  {listItems.map((item, i) => {
                    const match = item.match(/^(\d+)\.\s*(.*)/);
                    
                    if (match) {
                      return (
                        <li key={`item-${i}`} className={messageStyles.listItem.base}>
                          <span className="font-medium">{match[2]}</span>
                        </li>
                      );
                    }
                    
                    return <li key={`item-${i}`}>{item}</li>;
                  })}
                </ol>
              </div>
            );
          }
          
          // Check if paragraph is a bullet list
          if (/^[-*•]\s/.test(trimmedParagraph)) {
            const listItems = trimmedParagraph.split(/\n/).filter(item => item.trim());
            
            return (
              <div key={paragraphKey} className="mb-3">
                <ul className={messageStyles.list.bullet}>
                  {listItems.map((item, i) => {
                    const match = item.match(/^[-*•]\s+(.*)/);
                    
                    if (match) {
                      return (
                        <li key={`item-${i}`} className={messageStyles.listItem.base}>
                          {match[1]}
                        </li>
                      );
                    }
                    
                    return <li key={`item-${i}`}>{item}</li>;
                  })}
                </ul>
              </div>
            );
          }
          
          // Check if paragraph contains labeled sections (like "Category: Content")
          if (trimmedParagraph.includes(":") && /^[A-Z0-9][^:]+:/.test(trimmedParagraph)) {
            const lines = trimmedParagraph.split(/\n/).filter(line => line.trim());
            
            return (
              <div key={paragraphKey} className="mb-3 flex flex-col gap-1.5">
                {lines.map((line, i) => {
                  const labelMatch = line.match(/^([^:]+):(.*)/);
                  
                  if (labelMatch && labelMatch[1].length < 50) {
                    return (
                      <div key={`label-${i}`} className="flex">
                        <span className="font-semibold mr-1.5">{labelMatch[1]}:</span>
                        <span className="flex-1">{labelMatch[2].trim()}</span>
                      </div>
                    );
                  }
                  
                  return <div key={`text-${i}`} className="mb-1">{line}</div>;
                })}
              </div>
            );
          }
          
          // Regular paragraph
          return (
            <p key={paragraphKey} className="my-2 whitespace-pre-line leading-relaxed">
              {trimmedParagraph}
            </p>
          );
        })}
      </>
    );
  };

  // Format message content
  const formatContent = (content: string, isLoading: boolean | undefined) => {
    // If loading, show a thinking indicator
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
          <MessageLoading />
          <p className="text-sm">Thinking...</p>
        </div>
      );
    }
    
    // First handle any mentions if we have a formatter
    let processedContent = content;
    if (formatMessageWithMentions) {
      const mentionedContent = formatMessageWithMentions(content);
      
      if (React.isValidElement(mentionedContent)) {
        return mentionedContent;
      }
      
      if (typeof mentionedContent === 'string') {
        processedContent = mentionedContent;
      }
    }
    
    // Apply our improved text formatting
    return (
      <div className="space-y-1">
        {renderFormattedContent(processedContent)}
      </div>
    );
  };

  // Message delivery status indicator
  const MessageStatus = ({ delivered = true }) => {
    return delivered ? (
      <CheckCircle2 className="h-3 w-3 text-primary opacity-70" />
    ) : (
      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
    );
  };

  return (
    <ScrollArea className="flex-1 px-2 md:px-4">
      <div className={messageStyles.container}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-3 w-full",
              message.sender === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.sender === "ai" && (
              <AnimatedBotAvatar 
                state={message.isLoading ? 'thinking' : 'active'} 
                size="sm"
                fallback="M"
              />
            )}
            
            <div className="flex flex-col max-w-[80%] sm:max-w-[70%]">
              <div
                className={cn(
                  messageStyles.messageBubble.base,
                  message.sender === "user" 
                    ? messageStyles.messageBubble.user
                    : messageStyles.messageBubble.ai
                )}
              >
                <div className={cn(
                  messageStyles.messageContent.base,
                  messageStyles.messageContent.typography
                )}>
                  {formatContent(message.content, message.isLoading)}
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-1 mt-1 mr-1">
                <div className={messageStyles.timestamp}>
                  {message.timestamp}
                </div>
                {message.sender === "user" && <MessageStatus />}
              </div>
            </div>
            
            {message.sender === "user" && (
              <Avatar className={cn("h-8 w-8", messageStyles.avatar.container)}>
                <AvatarImage src={userAvatar} />
                <AvatarFallback className={messageStyles.avatar.user}>U</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
} 