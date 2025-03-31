"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MowersPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to dashboard
    router.replace("/dashboard");
  }, [router]);
  
  // Return a loading state while redirecting
  return (
    <div className="container flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-medium">Redirecting to Dashboard...</h2>
        <p className="text-muted-foreground">
          Mower management is now integrated into the dashboard for a better experience.
        </p>
      </div>
    </div>
  );
} 