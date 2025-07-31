// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated on app load
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 AuthContext: Checking authentication...');
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ AuthContext: User authenticated:', data.user);
        setUser(data.user);
      } else {
        console.log('❌ AuthContext: User not authenticated');
        setUser(null);
      }
    } catch (error) {
      console.error('❌ AuthContext: Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 AuthContext: Attempting login...');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ AuthContext: Login successful');
        
        // Actualizar el estado del usuario inmediatamente
        setUser(data.user);
        
        // Dar un pequeño delay para asegurar que la cookie se establezca
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return true;
      } else {
        console.log('❌ AuthContext: Login failed:', data.message);
        return false;
      }
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error);
      return false;
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
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('❌ AuthContext: Logout failed:', error);
      // Incluso si falla la petición, limpiar estado local
      setUser(null);
      router.push('/login');
    }
  };

  const refreshAuth = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshAuth }}>
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