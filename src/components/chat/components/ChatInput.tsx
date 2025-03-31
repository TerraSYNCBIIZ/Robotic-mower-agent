import React, { useState } from "react";
import { Send, Paperclip, Smile, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PromptTemplate } from "../types";

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSendMessage: () => void;
  showPromptTemplates: boolean;
  setShowPromptTemplates: (show: boolean) => void;
  promptTemplates: PromptTemplate[];
  handleApplyTemplate: (template: PromptTemplate) => void;
}

export function ChatInput({
  inputValue,
  setInputValue,
  handleSendMessage,
  showPromptTemplates,
  setShowPromptTemplates,
  promptTemplates,
  handleApplyTemplate
}: ChatInputProps) {
  return (
    <div className="border-t p-4 bg-muted/5">
      <div className="relative">
        {/* Prompt templates */}
        <AnimatePresence>
          {showPromptTemplates && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-full mb-2 w-full bg-card rounded-md border shadow-md p-2 z-10"
            >
              <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="text-sm font-medium">Quick Prompts</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => setShowPromptTemplates(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {promptTemplates.map(template => (
                  <Button
                    key={template.id}
                    variant="outline"
                    className="flex justify-start items-center h-auto py-2 px-3"
                    onClick={() => handleApplyTemplate(template)}
                  >
                    <div className="mr-2 text-primary">
                      {template.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-xs">{template.title}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Suggestion chip */}
        <AnimatePresence>
          {!showPromptTemplates && inputValue.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute bottom-full mb-2 left-0 right-0 flex justify-center"
            >
              <div className="bg-card px-3 py-1 rounded-full border shadow-sm flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span>Try asking about your mower's cutting schedule!</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Chat input form */}
        <form onSubmit={(e) => {
          e.preventDefault();
          if (inputValue.trim()) {
            handleSendMessage();
          }
        }} className="relative">
          <div className="rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring p-1">
            <div className="flex items-center px-3 py-2 border-r">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPromptTemplates(!showPromptTemplates);
                      }}
                    >
                      <Zap className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Quick prompts</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add attachment</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Smile className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add emoji</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <TextareaAutosize
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-full min-h-[40px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim()) {
                    handleSendMessage();
                  }
                }
              }}
              minRows={1}
              maxRows={5}
            />
            
            <div className="flex items-center p-2">
              <Button
                type="submit"
                size="sm"
                className={cn(
                  "ml-auto flex items-center gap-1",
                  !inputValue.trim() && "opacity-70"
                )}
                disabled={!inputValue.trim()}
              >
                Send
                <Send className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 