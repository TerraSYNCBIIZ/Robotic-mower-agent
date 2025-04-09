import './globals.css';
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "@/styles/globals.css";
import { cn } from "@/lib/utils";
import ClientLayout from '@/components/layout/ClientLayout';
import { FirebaseProvider } from '@/contexts/FirebaseContext'
import ProxyWebSocketInitializer from '@/components/ProxyWebSocketInitializer';

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Robotic Mower Agent",
  description: "Control your Automower with intelligent automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable
      )}>
        <FirebaseProvider>
          <ProxyWebSocketInitializer />
          <ClientLayout>
            {children}
          </ClientLayout>
        </FirebaseProvider>
      </body>
    </html>
  );
} 