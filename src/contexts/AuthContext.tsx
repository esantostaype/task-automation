// src/contexts/AuthContext.tsx - MEJORADO
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Solo verificar auth si no estamos en una ruta pública
    if (pathname !== '/login') {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, [pathname]);

  const checkAuth = async () => {
    try {
      console.log('🔍 AuthContext: Checking authentication...');
      
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('✅ AuthContext: User authenticated', data.user);
        setUser(data.user);
      } else {
        console.log('❌ AuthContext: User not authenticated', data.message);
        setUser(null);
        
        // Solo redirigir si estamos en una ruta protegida y no hay token válido
        if (data.requiresLogin && pathname !== '/login') {
          console.log('🔄 AuthContext: Redirecting to login...');
          router.push('/login');
        }
      }
    } catch (error) {
      console.error('❌ AuthContext: Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 AuthContext: Logging out...');
      
      await fetch('/api/auth/login', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      setUser(null);
      console.log('✅ AuthContext: Logout successful, redirecting to login...');
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('❌ AuthContext: Logout failed:', error);
      setUser(null);
      router.push('/login');
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      logout, 
      isAuthenticated 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}