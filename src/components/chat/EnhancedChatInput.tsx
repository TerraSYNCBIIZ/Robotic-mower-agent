"use client";

import * as React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, 
  Mic, 
  CornerDownLeft, 
  Smile, 
  X, 
  FileUp, 
  Send,
  Image as ImageIcon,
  FileText,
  Video
} from "lucide-react";

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-muted/50">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="text-foreground"
        aria-label="Loading indicator"
      >
        <circle cx="4" cy="12" r="2" fill="currentColor">
          <animate
            id="spinner_qFRN"
            begin="0;spinner_OcgL.end+0.25s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        </circle>
        <circle cx="12" cy="12" r="2" fill="currentColor">
          <animate
            begin="spinner_qFRN.begin+0.1s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        </circle>
        <circle cx="20" cy="12" r="2" fill="currentColor">
          <animate
            id="spinner_OcgL"
            begin="spinner_qFRN.begin+0.2s"
            attributeName="cy"
            calcMode="spline"
            dur="0.6s"
            values="12;6;12"
            keySplines=".33,.66,.66,1;.33,0,.66,.33"
          />
        </circle>
      </svg>
      <span className="text-xs text-muted-foreground">Someone is typing...</span>
    </div>
  );
}

// Emoji picker component
interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const emojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "👍", "👎", "❤️", "🔥", "🎉", "✨", "👋", "👏", "🙏", "🤔"
  ];

  return (
    <div className="grid grid-cols-5 gap-2 p-2">
      {emojis.map((emoji, index) => (
        <button
          key={index}
          className="text-xl hover:bg-muted p-2 rounded-md transition-colors"
          onClick={() => onEmojiSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// File display component
interface FileDisplayProps {
  fileName: string;
  fileType: string;
  onClear: () => void;
}

function FileDisplay({ fileName, fileType, onClear }: FileDisplayProps) {
  const getFileIcon = () => {
    if (fileType.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
    if (fileType.startsWith("video/")) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 bg-muted/50 w-fit px-3 py-1 rounded-lg border"
    >
      {getFileIcon()}
      <span className="text-sm max-w-[150px] truncate">{fileName}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 p-0.5 rounded-full hover:bg-muted transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// Suggestion item component
interface SuggestionItemProps {
  suggestion: string;
  onSelect: (suggestion: string) => void;
}

function SuggestionItem({ suggestion, onSelect }: SuggestionItemProps) {
  return (
    <CommandItem
      onSelect={() => onSelect(suggestion)}
      className="flex items-center gap-2 px-2 py-1 cursor-pointer"
    >
      <span>{suggestion}</span>
    </CommandItem>
  );
}

// Auto-resize textarea hook
interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

// File input hook
interface UseFileInputOptions {
  accept?: string;
  maxSize?: number;
}

function useFileInput({ accept, maxSize }: UseFileInputOptions = {}) {
  const [fileName, setFileName] = useState<string>("");
  const [fileType, setFileType] = useState<string>("");
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File | undefined) => {
    setError("");

    if (file) {
      if (maxSize && file.size > maxSize * 1024 * 1024) {
        setError(`File size must be less than ${maxSize}MB`);
        return;
      }

      if (accept && !file.type.match(accept.replace("/*", "/"))) {
        setError(`File type must be ${accept}`);
        return;
      }

      setFileType(file.type);
      setFileName(file.name);
      setSelectedFile(file);
    }
  };

  const clearFile = () => {
    setFileName("");
    setFileType("");
    setError("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    fileName,
    fileType,
    error,
    fileInputRef,
    handleFileSelect,
    clearFile,
    selectedFile,
  };
}

// Enhanced Chat Input Component
interface EnhancedChatInputProps {
  onSubmit?: (message: string, file?: File | null) => void;
  placeholder?: string;
  suggestions?: string[];
  showTypingIndicator?: boolean;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  accept?: string;
  maxFileSize?: number;
}

export function EnhancedChatInput({
  onSubmit,
  placeholder = "Type your message here...",
  suggestions = [],
  showTypingIndicator = false,
  className,
  minHeight = 52,
  maxHeight = 200,
  accept = "image/*,video/*,application/pdf",
  maxFileSize = 5,
}: EnhancedChatInputProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });
  
  const {
    fileName,
    fileType,
    error,
    fileInputRef,
    handleFileSelect,
    clearFile,
    selectedFile,
  } = useFileInput({ accept, maxSize: maxFileSize });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (inputValue.trim() || selectedFile) {
      onSubmit?.(inputValue, selectedFile);
      setInputValue("");
      clearFile();
      adjustHeight(true);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    setTimeout(() => adjustHeight(), 0);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustHeight();
      }
    }, 0);
  };

  useEffect(() => {
    if (inputValue === "/" && suggestions.length > 0) {
      setShowSuggestions(true);
    } else if (showSuggestions && !inputValue.startsWith("/")) {
      setShowSuggestions(false);
    }
  }, [inputValue, suggestions, showSuggestions]);

  return (
    <div className={cn("w-full", className)}>
      <form 
        className="relative rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring p-1"
        onSubmit={handleSubmit}
      >
        {showTypingIndicator && (
          <div className="absolute -top-8 left-0">
            <TypingIndicator />
          </div>
        )}
        
        <AnimatePresence>
          {fileName && (
            <div className="px-3 pt-2">
              <FileDisplay 
                fileName={fileName} 
                fileType={fileType}
                onClear={clearFile} 
              />
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>
          )}
        </AnimatePresence>
        
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            adjustHeight();
          }}
          placeholder={placeholder}
          className="min-h-12 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        
        {showSuggestions && (
          <div className="absolute bottom-full mb-1 w-full">
            <Command className="rounded-lg border shadow-md">
              <CommandInput placeholder="Search suggestions..." />
              <CommandList>
                <CommandEmpty>No suggestions found.</CommandEmpty>
                <CommandGroup heading="Suggestions">
                  {suggestions.map((suggestion, index) => (
                    <SuggestionItem
                      key={index}
                      suggestion={suggestion}
                      onSelect={handleSuggestionSelect}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
        
        <div className="flex items-center p-3 pt-0">
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept={accept}
          />
          
          <Button 
            variant="ghost" 
            size="icon" 
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-4" />
            <span className="sr-only">Attach file</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" type="button">
                <Smile className="size-4" />
                <span className="sr-only">Insert emoji</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" type="button">
            <Mic className="size-4" />
            <span className="sr-only">Use Microphone</span>
          </Button>

          <Button
            type="submit"
            size="sm"
            className="ml-auto gap-1.5"
            disabled={!inputValue.trim() && !selectedFile}
          >
            Send
            <Send className="size-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// Usage example
export function EnhancedChatInputDemo() {
  const [messages, setMessages] = useState<Array<{text: string, file?: File | null}>>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const exampleSuggestions = [
    "What's the weather today?",
    "Tell me a joke",
    "How can I help you?",
    "What time is it?",
    "Show me the latest news"
  ];

  const handleSubmit = (message: string, file?: File | null) => {
    setMessages(prev => [...prev, {text: message, file}]);
    
    // Simulate typing indicator
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  };

  return (
    <div className="max-w-3xl min-w-[400px] p-4 space-y-4">
      <div className="space-y-4 mb-4">
        {messages.map((msg, index) => (
          <div key={index} className="flex items-start gap-2 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop" />
              <AvatarFallback>US</AvatarFallback>
            </Avatar>
            <div className="bg-primary text-primary-foreground rounded-lg p-3">
              {msg.text}
              {msg.file && (
                <div className="mt-2 text-xs">
                  Attached: {msg.file.name}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <EnhancedChatInput 
        onSubmit={handleSubmit}
        placeholder="Type a message or / for suggestions..."
        suggestions={exampleSuggestions}
        showTypingIndicator={isTyping}
      />
    </div>
  );
} 