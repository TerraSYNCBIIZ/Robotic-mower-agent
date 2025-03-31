import { useState, useRef } from "react";
import { Search, Plus, Trash2, Edit2, Check, X, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Conversation } from "@/types/chat";

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onCreateNewChat?: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onUpdateConversation?: (conversationId: string, updates: Partial<Conversation>) => void;
  formatMessageWithMentions?: (content: string) => React.ReactNode;
}

export function ChatSidebar({
  conversations,
  currentConversationId,
  onCreateNewChat,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversation,
  formatMessageWithMentions,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // Filter conversations based on search query
  const filteredConversations = conversations.filter(
    (conversation) => 
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    onDeleteConversation(conversationId);
  };
  
  const startEditingTitle = () => {
    if (currentConversationId) {
      const conversation = conversations.find(c => c.id === currentConversationId);
      if (conversation) {
        setEditTitleValue(conversation.title);
        setIsEditingTitle(true);
        setTimeout(() => {
          if (titleInputRef.current) {
            titleInputRef.current.focus();
          }
        }, 0);
      }
    }
  };
  
  const handleUpdateConversationTitle = () => {
    if (currentConversationId && editTitleValue.trim() && onUpdateConversation) {
      onUpdateConversation(currentConversationId, { title: editTitleValue.trim() });
      setIsEditingTitle(false);
    } else {
      setIsEditingTitle(false);
    }
  };
  
  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
  };

  return (
    <div className="w-80 flex flex-col border-r border-border h-full">
      <div className="p-4 flex items-center justify-between border-b border-border">
        <h2 className="text-lg font-semibold">Conversations</h2>
        {onCreateNewChat && (
          <Button onClick={onCreateNewChat} size="icon" variant="ghost">
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      <div className="p-4">
        <div className={`flex items-center px-3 rounded-md border ${isSearchFocused ? 'border-primary ring-2 ring-primary/20' : 'border-input'}`}>
          <Search className="h-4 w-4 mr-2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search conversations..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-transparent"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`flex flex-col p-3 rounded-lg cursor-pointer hover:bg-accent group ${
                  conversation.id === currentConversationId
                    ? "bg-accent"
                    : "bg-background"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium line-clamp-1">
                      {conversation.title}
                    </span>
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onUpdateConversation && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (conversation.id === currentConversationId) {
                            startEditingTitle();
                          }
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleDeleteConversation(e, conversation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {conversation.snippet}
                </p>
                <span className="text-xs text-muted-foreground mt-2">
                  {conversation.lastMessageDate}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-6">
              No conversations found
            </div>
          )}
        </div>
      </ScrollArea>
      
      {currentConversationId && isEditingTitle && onUpdateConversation && (
        <div className="absolute top-14 left-4 right-4 z-10 bg-popover p-4 rounded-md shadow-md border border-border">
          <h3 className="text-sm font-medium mb-2">Rename conversation</h3>
          <div className="flex space-x-2">
            <Input
              ref={titleInputRef}
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleUpdateConversationTitle();
                } else if (e.key === "Escape") {
                  cancelEditingTitle();
                }
              }}
              autoFocus
            />
            <Button size="icon" onClick={handleUpdateConversationTitle}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={cancelEditingTitle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 