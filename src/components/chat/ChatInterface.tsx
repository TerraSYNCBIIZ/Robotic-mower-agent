"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: string;
  isLoading?: boolean;
}

interface ChatInterfaceProps {
  initialMessages?: Message[];
  onSendMessage?: (message: string) => Promise<string>;
  className?: string;
  userAvatar?: string;
  aiName?: string;
}

export function ChatInterface({
  initialMessages = [],
  onSendMessage,
  className,
  userAvatar,
  aiName = "MowerMind AI",
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // This effect runs when messages change
  useEffect(() => {
    setShouldScroll(true);
  }, [messages]);

  // This effect handles the scrolling
  useEffect(() => {
    if (shouldScroll) {
      scrollToBottom();
      setShouldScroll(false);
    }
  }, [shouldScroll, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      let aiResponse: string;

      if (onSendMessage) {
        // If callback provided, use it to get the AI response
        aiResponse = await onSendMessage(inputValue);
      } else {
        // Fallback mock response
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock responses for the mower context
        const mockResponses = [
          "I've analyzed your lawn mowing pattern. Would you like me to optimize your mowing schedule?",
          "Your mower's battery is currently at 78%. It should finish the current job without needing to recharge.",
          "I've detected an area where your mower frequently gets stuck. Would you like me to suggest a solution?",
          "Based on the weather forecast, I've rescheduled tomorrow's mowing session to avoid the rain.",
          "Your mower's blades may need sharpening soon. They've been in use for approximately 120 hours.",
        ];
        
        aiResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      }

      const aiResponseMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      };
      
      setMessages((prev) => [...prev, aiResponseMessage]);
    } catch (error) {
      // Handle errors
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error processing your request. Please try again.",
        sender: "ai",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col border-border bg-background shadow-sm",
        className
      )}
    >
      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full max-w-[85%] flex-col gap-2",
                message.sender === "user" ? "ml-auto items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2",
                  message.sender === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {message.sender === "ai" ? (
                  <Avatar className="h-7 w-7 border border-primary/10">
                    <AvatarFallback className="bg-primary/5 text-primary">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-7 w-7">
                    {userAvatar ? (
                      <AvatarImage src={userAvatar} alt="You" />
                    ) : (
                      <AvatarFallback>You</AvatarFallback>
                    )}
                  </Avatar>
                )}
                <span className="text-xs text-muted-foreground">
                  {message.sender === "user" ? "You" : aiName}
                </span>
              </div>
              <div
                className={cn(
                  "rounded-lg px-4 py-2.5",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex w-full max-w-[85%] flex-col gap-2 items-start">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7 border border-primary/10">
                  <AvatarFallback className="bg-primary/5 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{aiName}</span>
              </div>
              <div className="rounded-lg bg-secondary px-4 py-2.5 text-secondary-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isTyping}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
} 