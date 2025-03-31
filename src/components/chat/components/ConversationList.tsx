import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Conversation } from "../types";
import { ConversationItem } from "./ConversationItem";

interface ConversationListProps {
  filteredConversations: Conversation[];
  currentConversationId: string | null;
  renameModalOpen: string | null;
  newTitle: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  handleCreateNewConversation: () => void;
  handleSelectConversation: (conversationId: string) => void;
  togglePinConversation: (conversationId: string) => void;
  startRenameConversation: (conversationId: string) => void;
  completeRenameConversation: (conversationId: string) => void;
  handleDeleteConversation: (conversationId: string) => void;
  setNewTitle: (title: string) => void;
}

export function ConversationList({
  filteredConversations,
  currentConversationId,
  renameModalOpen,
  newTitle,
  renameInputRef,
  handleCreateNewConversation,
  handleSelectConversation,
  togglePinConversation,
  startRenameConversation,
  completeRenameConversation,
  handleDeleteConversation,
  setNewTitle
}: ConversationListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <MessageSquare className="h-8 w-8 mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No conversations found
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={handleCreateNewConversation}
          >
            Start New Conversation
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredConversations.map((conversation) => (
            renameModalOpen === conversation.id ? (
              <div 
                key={conversation.id} 
                className="p-3 rounded-lg border bg-accent/20"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  ref={renameInputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      completeRenameConversation(conversation.id);
                    } else if (e.key === "Escape") {
                      setNewTitle(conversation.title);
                    }
                  }}
                  onBlur={() => completeRenameConversation(conversation.id)}
                  className="h-7 py-1 text-sm"
                  autoFocus
                />
              </div>
            ) : (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={currentConversationId === conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                togglePinConversation={togglePinConversation}
                startRenameConversation={startRenameConversation}
                handleDeleteConversation={handleDeleteConversation}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
} 