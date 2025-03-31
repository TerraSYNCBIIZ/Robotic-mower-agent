"use client";

import Link from "next/link";
import { Home, MessageSquare, Calendar, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthStatus } from "@/components/AuthStatus";
import { useAuth } from "./AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuth();
  
  // This useEffect ensures hydration is complete before rendering theme-dependent elements
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <Home className="h-5 w-5" />,
    },
    {
      label: "Chat",
      href: "/chat",
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      label: "Scheduler",
      href: "/mower-scheduler",
      icon: <Calendar className="h-5 w-5" />,
    }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b bg-background">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-2 font-bold">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-sm">M</span>
          </div>
          <span>MowerMind</span>
        </div>
        
        <nav className="mx-6 flex items-center space-x-4 lg:space-x-6">
          {navItems.map((item) => (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(
                "h-9 gap-1",
                pathname === item.href && "bg-muted font-medium"
              )}
            >
              <Link href={item.href}>
                {item.icon}
                <span className="hidden md:inline-block">{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        
        <div className="ml-auto flex items-center gap-4">
          {/* Auth status indicator */}
          <AuthStatus />
          
          {/* Logout button (only shown when authenticated) */}
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <Link href="/logout">
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline-block">Logout</span>
              </Link>
            </Button>
          )}
          
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted ? (
              <>
                {theme === "dark" ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </>
            ) : (
              // Placeholder with same dimensions during server rendering
              <div className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
} 