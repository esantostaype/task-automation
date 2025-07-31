/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/login/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Button,
  Input,
  FormControl,
  FormLabel,
  Alert,
  Card,
  Typography,
  Box,
  CssVarsProvider,
} from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserIcon,
  LockPasswordIcon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
import { dynamicTheme } from "@/themes/dynamicTheme";

export default function LoginPage() {
  const [email, setEmail] = useState("esantos@inszoneins.com");
  const [password, setPassword] = useState("Ersa#123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (!authLoading && user) {
      console.log("🔄 User already authenticated, redirecting...");
      router.push("/");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDebugInfo("Starting login process...");

    try {
      console.log("🔐 Starting login with:", { email, password: "***" });
      setDebugInfo("Attempting login...");

      const success = await login(email, password);

      if (success) {
        console.log("✅ Login successful!");
        setDebugInfo("Login successful! Redirecting...");
        
        // Usar router.push para navegar
        router.push("/");
        router.refresh();
      } else {
        console.log("❌ Login failed");
        setError("Invalid credentials");
        setDebugInfo("Login failed!");
      }
    } catch (error) {
      console.error("❌ Login error:", error);
      setError("Network error occurred");
      setDebugInfo("Network error: " + String(error));
    } finally {
      setLoading(false);
    }
  };

  // Función para testing manual
  const testCookies = () => {
    console.log("🧪 Testing cookies...");
    const cookies = document.cookie;
    console.log("Current cookies:", cookies);
    setDebugInfo("Current cookies: " + (cookies || "None"));
  };

  const testVerify = async () => {
    console.log("🧪 Testing verify endpoint...");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();
      console.log("Verify test result:", data);
      setDebugInfo("Verify result: " + JSON.stringify(data));
    } catch (error) {
      console.log("Verify test error:", error);
      setDebugInfo("Verify error: " + String(error));
    }
  };

  // Mostrar loading si aún se está verificando la autenticación
  if (authLoading) {
    return (
      <CssVarsProvider theme={dynamicTheme} defaultMode="dark">
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <Typography>Loading...</Typography>
        </Box>
      </CssVarsProvider>
    );
  }

  return (
    <CssVarsProvider theme={dynamicTheme} defaultMode="dark">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: 2,
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 500,
            padding: 4,
            boxShadow: "lg",
          }}
        >
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography level="h2" sx={{ mb: 1 }}>
              Welcome Back
            </Typography>
            <Typography level="body-md" color="neutral">
              Sign in to your account
            </Typography>
          </Box>

          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {debugInfo && (
            <Alert color="neutral" sx={{ mb: 2, fontSize: "xs" }}>
              <strong>Debug:</strong> {debugInfo}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <FormControl sx={{ mb: 2 }}>
              <FormLabel>
                <HugeiconsIcon
                  icon={UserIcon}
                  size={16}
                  style={{ marginRight: 8 }}
                />
                Email
              </FormLabel>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </FormControl>

            <FormControl sx={{ mb: 3 }}>
              <FormLabel>
                <HugeiconsIcon
                  icon={LockPasswordIcon}
                  size={16}
                  style={{ marginRight: 8 }}
                />
                Password
              </FormLabel>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </FormControl>

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={loading}
              startDecorator={<HugeiconsIcon icon={Login01Icon} size={16} />}
              sx={{ mb: 2 }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Debug buttons */}
          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
            <Button size="sm" variant="outlined" onClick={testCookies}>
              Check Cookies
            </Button>
            <Button size="sm" variant="outlined" onClick={testVerify}>
              Test Verify
            </Button>
          </Box>

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Typography level="body-sm" color="neutral">
              Credentials pre-filled for testing
            </Typography>
          </Box>
        </Card>
      </Box>
    </CssVarsProvider>
  );
}