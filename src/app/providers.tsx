"use client";
import { ToastNotification } from "@/components";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryProvider>
          {children}
          <ToastNotification />
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
