import React from "react";
import { MoreVertical, AlertCircle, GripVertical, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Conversation } from "../types";

interface ChatHeaderProps {
  conversation: Conversation;
  togglePinConversation: (conversationId: string) => void;
  startRenameConversation: (conversationId: string) => void;
  handleDeleteConversation: (conversationId: string) => void;
  handleCreateSupportTicket: (conversationId: string) => void;
}

export function ChatHeader({
  conversation,
  togglePinConversation,
  startRenameConversation,
  handleDeleteConversation,
  handleCreateSupportTicket
}: ChatHeaderProps) {
  return (
    <div className="py-3 px-4 border-b flex items-center justify-between bg-background/80 backdrop-blur-sm z-10">
      <div className="flex items-center">
        <h2 className="text-xl font-semibold">{conversation.title}</h2>
        <Badge 
          variant="outline"
          className={cn(
            "ml-2 px-2 py-0 h-6 border transition-colors",
            conversation.status === "active" && "border-green-500/50 bg-green-500/10 text-green-700",
            conversation.status === "pending" && "border-amber-500/50 bg-amber-500/10 text-amber-700",
            conversation.status === "resolved" && "border-blue-500/50 bg-blue-500/10 text-blue-700"
          )}
        >
          {conversation.status}
        </Badge>
      </div>
      <div className="flex items-center space-x-2">
        {conversation.status === "active" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCreateSupportTicket(conversation.id)}
                  className="bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Request Support
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Request human support for this conversation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => togglePinConversation(conversation.id)}>
              <GripVertical className="h-4 w-4 mr-2 rotate-45" />
              {conversation.isPinned ? "Unpin Conversation" : "Pin Conversation"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => startRenameConversation(conversation.id)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename Conversation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDeleteConversation(conversation.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
} 