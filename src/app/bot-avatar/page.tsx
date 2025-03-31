import { AnimatedBotAvatarDemo } from "@/components/chat/AnimatedBotAvatar";

export default function BotAvatarPage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Bot Avatar Component</h1>
      <p className="mb-8 text-muted-foreground">
        This page demonstrates the animated bot avatar component with various states and sizes.
      </p>
      
      <div className="bg-card rounded-lg border">
        <AnimatedBotAvatarDemo />
      </div>
    </div>
  );
} 