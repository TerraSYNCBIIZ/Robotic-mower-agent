'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export interface EnhancedChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function EnhancedChatInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  className,
  autoFocus = false
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  // Auto-resize textarea
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-10 max-h-32 resize-none rounded-lg py-3 pr-12"
          rows={1}
        />
        <div className="absolute right-2 bottom-2 flex">
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={!message.trim() || disabled}
            onClick={handleSend}
            className="h-8 w-8 rounded-full"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach</span>
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
            <Mic className="h-4 w-4" />
            <span className="sr-only">Voice</span>
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
            <Bot className="h-4 w-4" />
            <span className="sr-only">AI Suggestions</span>
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {message.length > 0 ? `${message.length} characters` : 'Press Enter to send'}
        </div>
      </div>
    </div>
  );
}

export function EnhancedChatInputDemo() {
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = (message: string) => {
    setMessages((prev) => [...prev, message]);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-2">Enhanced Chat Input Demo</h3>
        
        <div className="mb-4 h-64 overflow-y-auto border rounded-lg p-4 bg-muted/30">
          {messages.length === 0 ? (
            <div className="text-muted-foreground text-center h-full flex items-center justify-center">
              Messages will appear here
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className="p-2 rounded-lg bg-primary/10 break-words">
                  {msg}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <EnhancedChatInput onSend={handleSend} autoFocus />
      </div>
    </div>
  );
} 