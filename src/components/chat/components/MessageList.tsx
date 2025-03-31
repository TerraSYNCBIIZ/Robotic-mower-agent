import React from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, ThumbsUp, ThumbsDown, 
  BookOpen, Copy, Share2, MoreVertical 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Avatar, AvatarFallback, AvatarImage 
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu, DropdownMenuContent, 
  DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Message, Conversation } from "../types";

interface MessageListProps {
  conversation: Conversation;
  userAvatar: string;
  aiAvatar: string;
  toggleMessageReaction: (conversationId: string, messageId: string, reactionType: "like" | "dislike") => void;
  toggleSaveMessage: (conversationId: string, messageId: string) => void;
}

export function MessageList({
  conversation,
  userAvatar,
  aiAvatar,
  toggleMessageReaction,
  toggleSaveMessage
}: MessageListProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-6">
        {conversation.messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            index={index}
            conversationId={conversation.id}
            userAvatar={userAvatar}
            aiAvatar={aiAvatar}
            toggleMessageReaction={toggleMessageReaction}
            toggleSaveMessage={toggleSaveMessage}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface MessageItemProps {
  message: Message;
  index: number;
  conversationId: string;
  userAvatar: string;
  aiAvatar: string;
  toggleMessageReaction: (conversationId: string, messageId: string, reactionType: "like" | "dislike") => void;
  toggleSaveMessage: (conversationId: string, messageId: string) => void;
}

function MessageItem({
  message,
  index,
  conversationId,
  userAvatar,
  aiAvatar,
  toggleMessageReaction,
  toggleSaveMessage
}: MessageItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "flex gap-3",
        message.sender === "user" ? "justify-end" : "justify-start"
      )}
    >
      {message.sender === "ai" && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Avatar className="h-9 w-9 mt-1 border-2 border-background shadow-sm">
            <AvatarImage src={aiAvatar} alt="AI" />
            <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
          </Avatar>
        </motion.div>
      )}
      
      <div className={cn("max-w-[80%] flex flex-col", message.sender === "user" && "items-end")}>
        <div 
          className={cn(
            "px-4 py-3 rounded-lg",
            message.sender === "user" 
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          <div className="prose dark:prose-invert prose-sm">
            {message.content}
          </div>
          
          {message.tags && message.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.tags.map(tag => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  <span className={cn(
                    "inline-block w-2 h-2 rounded-full mr-1",
                    tag.status === "charging" && "bg-blue-500",
                    tag.status === "mowing" && "bg-green-500",
                    tag.status === "idle" && "bg-amber-500",
                    tag.status === "error" && "bg-red-500"
                  )} />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center mt-1 text-xs text-muted-foreground">
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          
          <div className="flex ml-2 items-center gap-1">
            {message.sender === "ai" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 rounded-full",
                    message.reactions?.some(r => r.type === "like") && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  )}
                  onClick={() => toggleMessageReaction(conversationId, message.id, "like")}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 rounded-full",
                    message.reactions?.some(r => r.type === "dislike") && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  )}
                  onClick={() => toggleMessageReaction(conversationId, message.id, "dislike")}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 rounded-full",
                    message.isSaved && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                  )}
                  onClick={() => toggleSaveMessage(conversationId, message.id)}
                >
                  <BookOpen className="h-3 w-3" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy text
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
      
      {message.sender === "user" && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Avatar className="h-9 w-9 mt-1 border-2 border-background shadow-sm">
            <AvatarImage src={userAvatar} alt="User" />
            <AvatarFallback className="bg-secondary text-secondary-foreground">ME</AvatarFallback>
          </Avatar>
        </motion.div>
      )}
    </motion.div>
  );
} 