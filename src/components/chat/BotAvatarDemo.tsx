import { useState } from 'react';
import { BotAvatar } from './BotAvatar';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function BotAvatarDemo() {
  const [activeState, setActiveState] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [activeColor, setActiveColor] = useState('#10b981'); // Default green
  
  // Available colors
  const colors = [
    { name: 'Green', value: '#10b981' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Amber', value: '#f59e0b' }
  ];
  
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6">
        <h3 className="text-lg font-medium">MowerMind AI Avatar</h3>
        
        <div className="flex justify-center gap-6">
          <BotAvatar state={activeState} color={activeColor} size="sm" />
          <BotAvatar state={activeState} color={activeColor} size="md" />
          <BotAvatar state={activeState} color={activeColor} size="lg" />
        </div>
        
        <div className="grid grid-cols-3 gap-2 w-full max-w-md">
          <Button 
            variant={activeState === 'idle' ? "default" : "outline"} 
            onClick={() => setActiveState('idle')}
            className="w-full"
          >
            Idle
          </Button>
          <Button 
            variant={activeState === 'thinking' ? "default" : "outline"} 
            onClick={() => setActiveState('thinking')}
            className="w-full"
          >
            Thinking
          </Button>
          <Button 
            variant={activeState === 'speaking' ? "default" : "outline"} 
            onClick={() => setActiveState('speaking')}
            className="w-full"
          >
            Speaking
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          {colors.map((color) => (
            <Button 
              key={color.value}
              variant="outline"
              className="h-8 w-12 p-0 border-2"
              style={{ 
                backgroundColor: activeColor === color.value ? color.value : 'transparent',
                borderColor: color.value,
                color: activeColor === color.value ? 'white' : undefined
              }}
              onClick={() => setActiveColor(color.value)}
            />
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground mt-4">
          <p>This avatar component can be used to indicate AI activity in chats</p>
          <p>with different states and customizable colors.</p>
        </div>
      </div>
    </Card>
  );
} 