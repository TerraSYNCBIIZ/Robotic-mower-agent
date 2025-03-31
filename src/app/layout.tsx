'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { Navbar } from '@/components/layout/Navbar';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { MowerDataProvider } from '@/contexts/MowerDataContext';
import { ServiceInitializer } from '@/components/ServiceInitializer';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider>
          <AuthProvider>
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
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
} 