/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/providers.tsx - MEJORADO
"use client";
import { ToastNotification } from "@/components";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/joy";

// Componente de loading para auth
function AuthLoadingWrapper({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  
  // Si estamos en login, no mostrar loading
  if (pathname === '/login') {
    return <>{children}</>;
  }
  
  // Mostrar loading mientras verifica auth
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <CircularProgress size="lg" />
        <Typography level="body-md" color="neutral">
          Verificando autenticación...
        </Typography>
      </Box>
    );
  }
  
  return <>{children}</>;
}

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
      <AuthLoadingWrapper>
        {children}
      </AuthLoadingWrapper>
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