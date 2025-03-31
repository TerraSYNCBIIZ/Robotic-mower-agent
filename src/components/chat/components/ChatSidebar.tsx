import React from "react";
import { MessageSquare, PlusCircle, Search, Filter, Clock, GripVertical, Edit2, Trash2, MoreVertical, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ConversationList } from "./ConversationList";
import { Conversation } from "../types";

interface ChatSidebarProps {
  conversations: Conversation[];
  filteredConversations: Conversation[];
  currentConversationId: string | null;
  sidebarCollapsed: boolean;
  activeTab: string;
  filterStatus: "all" | "active" | "pending" | "resolved";
  filterDateRange: "all" | "today" | "week" | "month";
  searchQuery: string;
  renameModalOpen: string | null;
  newTitle: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: "all" | "active" | "pending" | "resolved") => void;
  setFilterDateRange: (range: "all" | "today" | "week" | "month") => void;
  handleCreateNewConversation: () => void;
  handleSelectConversation: (conversationId: string) => void;
  togglePinConversation: (conversationId: string) => void;
  startRenameConversation: (conversationId: string) => void;
  completeRenameConversation: (conversationId: string) => void;
  handleDeleteConversation: (conversationId: string) => void;
  setNewTitle: (title: string) => void;
  toggleSidebar: () => void;
}

export function ChatSidebar({
  filteredConversations,
  currentConversationId,
  sidebarCollapsed,
  activeTab,
  filterStatus,
  filterDateRange,
  searchQuery,
  renameModalOpen,
  newTitle,
  renameInputRef,
  setActiveTab,
  setSearchQuery,
  setFilterStatus,
  setFilterDateRange,
  handleCreateNewConversation,
  handleSelectConversation,
  togglePinConversation,
  startRenameConversation,
  completeRenameConversation,
  handleDeleteConversation,
  setNewTitle,
  toggleSidebar
}: ChatSidebarProps) {
  return (
    <div 
      className={cn(
        "h-full flex-shrink-0 transition-all duration-300 ease-in-out border-r relative",
        sidebarCollapsed ? "w-0 opacity-0" : "w-[280px] opacity-100"
      )}
      style={{ overflow: "hidden" }}
    >
      <div className="h-full w-[280px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-sm z-10">
          <h2 className="text-xl font-semibold flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            <span>Conversations</span>
          </h2>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleCreateNewConversation}
              className="h-8 w-8"
            >
              <PlusCircle className="h-5 w-5" />
              <span className="sr-only">New Conversation</span>
            </Button>
            
            {/* Sidebar toggle button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleSidebar}
              className="h-8 w-8 ml-1 text-muted-foreground hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-4 pt-4">
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-2 w-full">
              <TabsTrigger value="all">All Chats</TabsTrigger>
              <TabsTrigger value="pinned">Pinned</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Search and filters */}
        <div className="px-4 pb-2">
          <div className="mb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search conversations..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center">
                  <Filter className="h-4 w-4 mr-1" />
                  <span className="truncate max-w-[70px]">{filterStatus === "all" ? "All Status" : filterStatus}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>All Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("active")}>
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    Active
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("pending")}>
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                    Pending
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("resolved")}>
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    Resolved
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  <span className="truncate max-w-[70px]">{filterDateRange === "all" ? "All Time" : filterDateRange}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFilterDateRange("all")}>All Time</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterDateRange("today")}>Today</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterDateRange("week")}>This Week</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterDateRange("month")}>This Month</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Conversation list */}
        <ConversationList
          filteredConversations={filteredConversations}
          currentConversationId={currentConversationId}
          renameModalOpen={renameModalOpen}
          newTitle={newTitle}
          renameInputRef={renameInputRef}
          handleCreateNewConversation={handleCreateNewConversation}
          handleSelectConversation={handleSelectConversation}
          togglePinConversation={togglePinConversation}
          startRenameConversation={startRenameConversation}
          completeRenameConversation={completeRenameConversation}
          handleDeleteConversation={handleDeleteConversation}
          setNewTitle={setNewTitle}
        />
      </div>
    </div>
  );
} 