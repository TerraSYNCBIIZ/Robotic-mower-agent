'use client';

import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { Navbar } from '@/components/layout/Navbar';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { MowerDataProvider } from '@/contexts/MowerDataContext';
import { ServiceInitializer } from '@/components/ServiceInitializer';
import { WebSocketProvider } from "@/contexts/WebSocketContext";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <MowerDataProvider>
            <ConfirmProvider>
              <ServiceInitializer />
              <Navbar />
              <main className="pt-16">
                {children}
              </main>
              <Toaster position="top-right" />
            </ConfirmProvider>
          </MowerDataProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 