import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, MessageCircle, X, Paperclip, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Define local types since we're having trouble importing from @/types/chat
interface ActiveMention {
  id: string;
  type: 'mower' | 'conversation';
  name: string;
  status?: 'mowing' | 'charging' | 'idle' | 'error';
}

interface MentionItem {
  id: string;
  type: 'mower' | 'conversation';
  name: string;
  status?: 'mowing' | 'charging' | 'idle' | 'error';
}

interface Conversation {
  id: string;
  title: string;
  snippet: string;
  lastMessageDate: string;
  messages: Record<string, unknown>[];
  mowerId?: string;
  mowerName?: string;
}

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isTyping: boolean;
  mentionItems?: MentionItem[];
  showMentionMenu?: boolean;
  selectedMentionIndex?: number;
  onMentionSelect?: (item: MentionItem) => void;
  onMentionKeyDown?: (e: React.KeyboardEvent) => void;
  activeMentions?: ActiveMention[];
  onRemoveMention?: (mentionId: string, mentionType: 'mower' | 'conversation') => void;
  conversations?: Conversation[];
  mowers?: Array<{id: string; name: string; status: 'mowing' | 'charging' | 'idle' | 'error'}>;
}

// Chat UI styles
const styles = {
  container: "border-t border-border p-3 bg-background/80 backdrop-blur-sm",
  inputContainer: "relative flex flex-col rounded-lg border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-primary/20",
  textarea: "min-h-[52px] w-full resize-none border-0 bg-transparent p-3 pr-14 focus-visible:ring-0 text-sm placeholder:text-muted-foreground",
  buttonRow: "absolute bottom-1 right-2 flex items-center gap-2 text-muted-foreground",
  actionButton: "h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors",
  sendButton: "h-8 w-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-200",
  mentionMenu: "absolute top-0 -translate-y-full left-0 w-full max-h-[300px] overflow-y-auto bg-popover rounded-lg shadow-lg border border-border z-50 p-1.5 space-y-1",
  mentionItem: {
    base: "w-full text-left flex items-center gap-2 px-3 py-2 rounded-md",
    active: "bg-accent",
    hover: "hover:bg-accent/50",
  },
  activeMentions: "flex flex-wrap gap-2 mb-2",
  mentionBadge: {
    base: "pl-2 h-6 gap-2 inline-flex items-center",
    status: {
      mowing: "bg-emerald-500",
      charging: "bg-blue-600",
      idle: "bg-amber-500",
      error: "bg-rose-600",
      default: "bg-gray-400",
    },
  },
  mentionBadgeCloseBtn: "h-4 w-4 rounded-full hover:bg-destructive/20 ml-1",
};

export function ChatInput({
  onSendMessage,
  isTyping,
  mentionItems = [],
  showMentionMenu = false,
  selectedMentionIndex = 0,
  onMentionSelect,
  onMentionKeyDown,
  activeMentions = [],
  onRemoveMention,
  conversations = [],
  mowers = [],
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  
  // Local state for mention handling
  const [localShowMentionMenu, setLocalShowMentionMenu] = useState(false);
  const [localMentionItems, setLocalMentionItems] = useState<MentionItem[]>([]);
  const [localSelectedMentionIndex, setLocalSelectedMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  // Use either the prop values or the local values
  const effectiveShowMentionMenu = showMentionMenu || localShowMentionMenu;
  const effectiveMentionItems = mentionItems.length > 0 ? mentionItems : localMentionItems;
  const effectiveSelectedMentionIndex = showMentionMenu ? selectedMentionIndex : localSelectedMentionIndex;

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  // Handle mention detection
  useEffect(() => {
    const checkForMentions = () => {
      if (!inputRef.current) return;
      
      const inputText = inputValue;
      const cursorPos = inputRef.current.selectionStart || 0;
      
      // Check for @ symbol before cursor
      let startPos = cursorPos - 1;
      while (startPos >= 0 && inputText[startPos] !== '@' && inputText[startPos] !== ' ') {
        startPos--;
      }
      
      if (startPos >= 0 && inputText[startPos] === '@') {
        // Get the query text after the @ symbol
        const query = inputText.substring(startPos + 1, cursorPos).toLowerCase();
        
        // Filter mowers and conversations based on query
        const filteredItems: MentionItem[] = [
          ...mowers
            .filter(m => m.name.toLowerCase().includes(query))
            .map(m => ({ 
              id: m.id, 
              type: 'mower' as const, 
              name: m.name, 
              status: m.status
            })),
          ...conversations
            .filter(c => c.title.toLowerCase().includes(query))
            .map(c => ({ id: c.id, type: 'conversation' as const, name: c.title }))
        ];
        
        setLocalMentionItems(filteredItems);
        setLocalShowMentionMenu(filteredItems.length > 0);
        setCursorPosition(cursorPos);
        setLocalSelectedMentionIndex(0); // Reset selection to first item
      } else {
        // Only hide menu, don't clear other state
        setLocalShowMentionMenu(false);
      }
    };
    
    checkForMentions();
  }, [inputValue, conversations, mowers]);

  // Handle selecting a mention item when no parent handler is provided
  const handleLocalSelectMention = (item: MentionItem) => {
    // Get any text that was in the input before selecting a mention
    const currentText = inputValue;
    
    if (inputRef.current && cursorPosition !== null) {
      // Find the starting position of @ that triggered the mention
      let startPos = cursorPosition - 1;
      while (startPos >= 0 && currentText[startPos] !== '@') {
        startPos--;
      }
      
      if (startPos >= 0) {
        // Text before the @ character should remain in the input field
        // We'll keep it there and just remove the @ and any characters after it until cursor
        const fullText = currentText;
        const textBeforeAt = fullText.substring(0, startPos);
        const textAfterCursor = fullText.substring(cursorPosition);
        
        // Keep the text before @ in the input and add text after cursor
        setInputValue(textBeforeAt + textAfterCursor);
        
        // If parent handler exists, use it, otherwise handle locally
        if (onMentionSelect) {
          onMentionSelect(item);
        } else {
          // Add the selected item to active mentions if we have a local handler
          const newMention: ActiveMention = {
            id: item.id,
            type: item.type,
            name: item.name,
            status: item.type === 'mower' ? item.status : undefined
          };
          
          // If we had local state for active mentions, we'd update it here
          // For now we'll just log that we would need parent handler
          console.log("Would add mention:", newMention);
        }
        
        // Close the mention menu
        setLocalShowMentionMenu(false);
        
        // Keep focus on input for continued typing
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 0);
      }
    }
  };

  // Handle arrow key navigation for mention menu
  const handleLocalMentionKeyDown = (e: React.KeyboardEvent) => {
    if (effectiveShowMentionMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLocalSelectedMentionIndex(prev => 
          prev < effectiveMentionItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLocalSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : effectiveMentionItems.length - 1
        );
      } else if (e.key === 'Enter' && effectiveMentionItems.length > 0) {
        e.preventDefault();
        // Use parent handler if available, otherwise use local handler
        if (onMentionSelect) {
          onMentionSelect(effectiveMentionItems[effectiveSelectedMentionIndex]);
        } else {
          handleLocalSelectMention(effectiveMentionItems[effectiveSelectedMentionIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setLocalShowMentionMenu(false);
      }
      
      // Also call parent handler if available
      if (onMentionKeyDown) {
        onMentionKeyDown(e);
      }
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (inputValue.trim() || activeMentions.length > 0) {
      // Format message with active mentions
      let formattedMessage = inputValue;
      
      // Add mentions to the message
      if (activeMentions.length > 0) {
        const mentionTexts = activeMentions.map(mention => {
          const statusSuffix = mention.status ? `:${mention.status}` : '';
          return `@${mention.type}:${mention.id}:${mention.name}${statusSuffix}`;
        }).join(' ');
        
        formattedMessage = `${mentionTexts} ${formattedMessage}`;
      }
      
      setInputValue("");
      await onSendMessage(formattedMessage.trim());
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention menu navigation
    if (effectiveShowMentionMenu) {
      handleLocalMentionKeyDown(e);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Apply the proper handlers
  const handleClickMention = (item: MentionItem) => {
    if (onMentionSelect) {
      onMentionSelect(item);
    } else {
      handleLocalSelectMention(item);
    }
  };

  return (
    <div className={styles.container}>
      {/* Active Mentions */}
      {activeMentions.length > 0 && (
        <div className={styles.activeMentions}>
          {activeMentions.map((mention) => {
            // Get color based on status for mower mentions
            let statusColor = styles.mentionBadge.status.default;
            if (mention.type === 'mower' && mention.status) {
              statusColor = styles.mentionBadge.status[mention.status] || styles.mentionBadge.status.default;
            }
            
            return (
              <Badge 
                key={mention.id} 
                variant="secondary"
                className={styles.mentionBadge.base}
              >
                {mention.type === 'mower' ? (
                  <div className={cn(
                    "h-4 w-4 relative rounded-sm overflow-hidden flex items-center justify-center", 
                    statusColor
                  )}>
                    <div className="h-3 w-3 relative z-10">
                      <Image
                        src="/images/monochrome_large.webp"
                        alt="Mower"
                        fill
                        className="object-contain brightness-0 invert"
                      />
                    </div>
                  </div>
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                <span className="text-xs">{mention.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.mentionBadgeCloseBtn}
                  onClick={() => onRemoveMention?.(mention.id, mention.type)}
                  aria-label={`Remove ${mention.name}`}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
      
      {/* Input Container with proper positioning for mention menu */}
      <div className={styles.inputContainer}>
        <Textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message... (Use @ to mention mowers or conversations)"
          className={styles.textarea}
          rows={1}
        />
        
        {/* Button Row */}
        <div className={styles.buttonRow}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={styles.actionButton}
                  onClick={() => {/* TODO: Implement attachment logic */}}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add attachment</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={styles.actionButton}
                  onClick={() => {/* TODO: Implement emoji picker */}}
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add emoji</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            type="button"
            size="icon"
            className={styles.sendButton}
            onClick={handleSendMessage}
            disabled={isTyping || (!inputValue.trim() && activeMentions.length === 0)}
            aria-label="Send message"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Mention Menu - positioned above the input */}
        {effectiveShowMentionMenu && effectiveMentionItems.length > 0 && (
          <div 
            ref={mentionMenuRef}
            className={styles.mentionMenu}
          >
            {effectiveMentionItems.map((item, index) => {
              // Get color based on status for mower mentions
              let statusColor = styles.mentionBadge.status.default;
              if (item.type === 'mower' && item.status) {
                statusColor = styles.mentionBadge.status[item.status] || styles.mentionBadge.status.default;
              }
              
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    styles.mentionItem.base,
                    index === effectiveSelectedMentionIndex 
                      ? styles.mentionItem.active 
                      : styles.mentionItem.hover
                  )}
                  onClick={() => handleClickMention(item)}
                >
                  {item.type === 'mower' ? (
                    <div className={cn(
                      "h-6 w-6 relative rounded-sm overflow-hidden flex items-center justify-center",
                      statusColor
                    )}>
                      <div className="h-5 w-5 relative z-10">
                        <Image
                          src="/images/monochrome_large.webp"
                          alt="Mower"
                          fill
                          className="object-contain brightness-0 invert"
                        />
                      </div>
                    </div>
                  ) : (
                    <MessageCircle className="h-4 w-4 text-primary" />
                  )}
                  <span className="truncate">{item.name}</span>
                  <Badge variant="outline" className="ml-auto text-xs px-1 py-0">
                    {item.type}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
} 