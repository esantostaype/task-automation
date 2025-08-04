/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/login/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  FormControl,
  FormLabel,
  Alert,
  Card,
  Typography,
  Box,
} from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserIcon,
  LockPasswordIcon,
  Login01Icon,
} from "@hugeicons/core-free-icons";

export default function LoginPage() {
  const [email, setEmail] = useState("esantos@inszoneins.com");
  const [password, setPassword] = useState("Ersa#123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDebugInfo("Starting login process...");

    try {
      console.log("🔐 Starting login with:", { email, password: "***" });
      setDebugInfo("Sending login request...");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      console.log("📡 Response status:", response.status);
      const data = await response.json();
      console.log("📡 Response data:", data);

      if (data.success) {
        console.log("✅ Login successful!");
        setDebugInfo("Login successful! Redirecting...");

        // Dar tiempo para que la cookie se establezca completamente
        // y luego hacer la redirección
        setTimeout(() => {
          console.log("🔄 Redirecting to dashboard...");
          // Usar router.push y también router.refresh para asegurar que el middleware vea la cookie
          router.push("/tasks");
          router.refresh();
        }, 100);

      } else {
        console.log("❌ Login failed:", data.message);
        setError(data.message || "Login failed");
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

  return (
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

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Typography level="body-sm" color="neutral">
              Credentials pre-filled for testing
            </Typography>
          </Box>
        </Card>
      </Box>
  );
}