import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendIcon } from 'lucide-react';
import { useMowerData } from '@/contexts/MowerDataContext';

export default function MowerChat() {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { isLoading } = useMowerData();
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Automatically scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // Mock available mowers for now
      const demoMowers = [
        { id: 'demo-mower-1', name: 'Front Yard Mower', model: 'Automower 430X' },
        { id: 'demo-mower-2', name: 'Back Yard Mower', model: 'Automower 450X' }
      ];
      
      // Send to backend which handles the AI + MCP
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          availableMowers: demoMowers
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add AI response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Ask me anything about your mower!</p>
            <p className="text-sm mt-2">For example:</p>
            <ul className="text-sm mt-1 space-y-1">
              <li>"What's the battery level of my mower?"</li>
              <li>"Start mowing now for 2 hours"</li>
              <li>"Show me my current mowing schedule"</li>
              <li>"Park the mower until tomorrow"</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>
      
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex space-x-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your mower..."
            disabled={isProcessing || isLoading}
          />
          <Button type="submit" size="icon" disabled={isProcessing || isLoading}>
            {isProcessing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
} 