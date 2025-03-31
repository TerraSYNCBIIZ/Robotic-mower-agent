import { type ReactNode } from 'react';
import { Metadata } from "next";
import { ProtectedRouteWrapper } from "@/components/layout/ProtectedRouteWrapper";

// Dashboard layout metadata for SEO
export const metadata: Metadata = {
  title: "Dashboard",
  description: "View your mowers' status and activity.",
};

// Server component that defines layout
export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRouteWrapper>
      {children}
    </ProtectedRouteWrapper>
  );
} 