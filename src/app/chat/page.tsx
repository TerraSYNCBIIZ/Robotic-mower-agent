"use client";

import React, { useState, useEffect } from "react";
import { MowerChatPlatform } from "@/components/chat/MowerChatPlatform";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from 'uuid';

// Mock mower state for initial development - this would come from an API in production
const MOCK_MOWERS = [
  {
    id: "mower-1",
    name: "Front Yard Mower",
    model: "Automower 450X",
    battery: 85,
    status: "charging",
    lastActive: new Date().toISOString()
  },
  {
    id: "mower-2",
    name: "Back Yard Mower",
    model: "Automower 430X",
    battery: 67,
    status: "mowing",
    lastActive: new Date().toISOString()
  },
  {
    id: "mower-3",
    name: "Side Garden Mower",
    model: "Automower 315X",
    battery: 23,
    status: "idle",
    lastActive: new Date().toISOString()
  }
];

// Mock conversations
const MOCK_CONVERSATIONS = [
  {
    id: "conv-1",
    title: "Mowing Schedule Setup",
    snippet: "Let's set up an optimal mowing schedule for your Front Yard Mower",
    lastMessageDate: new Date().toISOString(),
    status: "active",
    tags: [
      { id: "mower-1", type: "mower", name: "Front Yard Mower", status: "charging" }
    ],
    messages: [
      {
        id: "msg-1",
        content: "Hello! I'd like to set up a mowing schedule for my front yard.",
        sender: "user",
        timestamp: new Date().toISOString()
      },
      {
        id: "msg-2",
        content: "Sure, I can help you set up an optimal mowing schedule for your Front Yard Mower. What times of day would you prefer the mower to operate?",
        sender: "ai",
        timestamp: new Date().toISOString()
      }
    ]
  },
  {
    id: "conv-2",
    title: "Battery Issues",
    snippet: "Troubleshooting battery drain on Side Garden Mower",
    lastMessageDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    status: "pending",
    tags: [
      { id: "mower-3", type: "mower", name: "Side Garden Mower", status: "idle" }
    ],
    messages: [
      {
        id: "msg-3",
        content: "My Side Garden Mower's battery is draining too quickly. Can you help?",
        sender: "user",
        timestamp: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: "msg-4",
        content: "I'm sorry to hear that. Let's troubleshoot the battery drain issue. How old is the battery in your Side Garden Mower?",
        sender: "ai",
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  }
];

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [mowers, setMowers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate API fetch for mowers and conversations
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Simulating API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Use mock data for now, would be replaced with real API call
        setMowers(MOCK_MOWERS);
        setConversations(MOCK_CONVERSATIONS);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast({
          title: "Connection Error",
          description: "Could not connect to the service. Using mock data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  // Function to send message to Claude API
  const handleSendMessage = async (message: string, conversationId: string, tags: any[]) => {
    try {
      // Get relevant mowers from tags
      const mowerTags = tags.filter(tag => tag.type === "mower");
      const selectedMowers = mowerTags.length > 0 
        ? mowers.filter(mower => mowerTags.some(tag => tag.id === mower.id))
        : mowers;
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
          availableMowers: selectedMowers,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      
      // This would normally be handled by returning updated conversations from the API
      // Here we're just simulating the update locally
      setConversations(prev => 
        prev.map(conv => {
          if (conv.id === conversationId) {
            const newUserMessage = {
              id: `user-${uuidv4()}`,
              content: message,
              sender: "user",
              timestamp: new Date().toISOString(),
              tags: tags
            };
            
            const newAiMessage = {
              id: `ai-${uuidv4()}`,
              content: data.message || "I've processed your request.",
              sender: "ai",
              timestamp: new Date().toISOString()
            };
            
            return {
              ...conv,
              snippet: message.length > 50 ? message.substring(0, 50) + "..." : message,
              lastMessageDate: new Date().toISOString(),
              messages: [...conv.messages, newUserMessage, newAiMessage]
            };
          }
          return conv;
        })
      );
      
    } catch (err) {
      console.error("Error sending message:", err);
      throw new Error("Failed to get response from assistant");
    }
  };

  // Function to create support ticket
  const handleCreateTicket = async (conversationId: string, message: string) => {
    try {
      // This would be replaced with an actual API call to create a ticket
      console.log(`Creating ticket for conversation ${conversationId} with message: ${message}`);
      
      // Simulate API response delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update the conversation status
      setConversations(prev => 
        prev.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              status: "pending"
            };
          }
          return conv;
        })
      );
      
      toast({
        title: "Support Ticket Created",
        description: "A specialist will review your case soon.",
        variant: "default",
      });
      
    } catch (err) {
      console.error("Error creating ticket:", err);
      toast({
        title: "Failed to Create Ticket",
        description: "Please try again later.",
        variant: "destructive",
      });
      throw new Error("Failed to create support ticket");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Connecting to your mowers...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 h-[calc(100vh-2rem)]">
      <MowerChatPlatform 
        initialMowers={mowers}
        initialConversations={conversations}
        onSendMessage={handleSendMessage}
        onCreateTicket={handleCreateTicket}
        userAvatar="/images/user-avatar.png"
        aiAvatar="/images/ai-avatar.png"
      />
    </div>
  );
} 