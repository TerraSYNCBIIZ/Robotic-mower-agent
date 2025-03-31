"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/layout/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

export function AuthStatus() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const { logout } = useAuth();
  const router = useRouter();
  
  // Check authentication status on mount and whenever window is focused
  useEffect(() => {
    const checkAuth = () => {
      setAuthenticated(isAuthenticated());
    };
    
    // Initial check
    checkAuth();
    
    // Add listeners for focus events to recheck auth when user returns to tab
    window.addEventListener("focus", checkAuth);
    
    // Periodic check every 5 minutes
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener("focus", checkAuth);
      clearInterval(interval);
    };
  }, []);
  
  const handleLogout = () => {
    logout();
    router.push('/');
  };
  
  // Don't render anything during SSR/initial mount to prevent hydration mismatch
  if (authenticated === null) return null;
  
  return (
    <div className="flex items-center gap-2">
      {authenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="hidden md:inline">Connected</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild size="sm" variant="outline" className="gap-1">
          <Link href="/mowers/add">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span>Connect</span>
          </Link>
        </Button>
      )}
    </div>
  );
} 