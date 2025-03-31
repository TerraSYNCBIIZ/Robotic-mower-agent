import React from "react";
import { Clock, GripVertical, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Conversation } from "../types";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  togglePinConversation: (conversationId: string) => void;
  startRenameConversation: (conversationId: string) => void;
  handleDeleteConversation: (conversationId: string) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
  togglePinConversation,
  startRenameConversation,
  handleDeleteConversation
}: ConversationItemProps) {
  return (
    <div
      className={cn(
        "flex flex-col p-3 rounded-lg cursor-pointer transition-all border",
        "hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/10",
        "relative mb-1 max-w-full",
        isActive 
          ? "bg-accent/80 text-accent-foreground border-accent" 
          : "bg-card border-transparent"
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start w-full gap-1">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {conversation.isPinned && (
            <div className="text-amber-500 flex-shrink-0 mt-1">
              <GripVertical className="h-4 w-4 rotate-45" />
            </div>
          )}
          <h3 className="font-medium truncate text-sm">
            {conversation.title}
          </h3>
        </div>
        <Badge 
          variant="outline"
          className={cn(
            "text-xs h-5 px-1 border transition-colors flex-shrink-0",
            conversation.status === "active" && "border-green-500/50 bg-green-500/10 text-green-700",
            conversation.status === "pending" && "border-amber-500/50 bg-amber-500/10 text-amber-700",
            conversation.status === "resolved" && "border-blue-500/50 bg-blue-500/10 text-blue-700"
          )}
        >
          {conversation.status}
        </Badge>
      </div>
      
      <p className="text-xs text-muted-foreground truncate mt-1">
        {conversation.snippet}
      </p>
      
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span className="flex items-center">
          <Clock className="h-3 w-3 mr-1" />
          {new Date(conversation.lastMessageDate).toLocaleDateString()}
        </span>
        
        <div 
          className="opacity-0 hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => togglePinConversation(conversation.id)}>
                <GripVertical className="h-4 w-4 mr-2 rotate-45" />
                {conversation.isPinned ? "Unpin Conversation" : "Pin Conversation"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => startRenameConversation(conversation.id)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteConversation(conversation.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
} 