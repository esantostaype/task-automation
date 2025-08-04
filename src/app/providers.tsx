/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/providers.tsx - MEJORADO
"use client";
import { ToastNotification } from "@/components";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";

// Wrapper condicional para AuthProvider
function ConditionalAuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Rutas que NO necesitan AuthProvider
  const publicRoutes = ['/login'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;
  
  if (isPublicRoute) {
    console.log(`🔓 Public route: ${pathname} - Skipping AuthProvider`);
    return <>{children}</>;
  }
  
  console.log(`🔒 Protected route: ${pathname} - Using AuthProvider`);
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ConditionalAuthWrapper>
          {children}
          <ToastNotification />
        </ConditionalAuthWrapper>
      </QueryProvider>
    </ThemeProvider>
  );
};