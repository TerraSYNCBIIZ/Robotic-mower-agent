import { EnhancedChatInputDemo } from "@/components/chat/EnhancedChatInput";

export default function ChatInputDemoPage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Enhanced Chat Input Component</h1>
      <p className="mb-8 text-muted-foreground">
        This page demonstrates the enhanced chat input with emoji picker, file uploads, and suggestions.
      </p>
      
      <div className="bg-card rounded-lg border p-4">
        <EnhancedChatInputDemo />
      </div>
    </div>
  );
} 