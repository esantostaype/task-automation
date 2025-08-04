"use client";

import React, { useState } from "react";
import {
  Button,
  Input,
  FormControl,
  FormLabel,
  Alert,
} from "@mui/joy";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserIcon,
  LockPasswordIcon,
  Login02Icon,
} from "@hugeicons/core-free-icons";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("esantos@inszoneins.com");
  const [password, setPassword] = useState("Ersa#123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("🔐 Starting login process");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();
      console.log("📡 Login response:", { success: data.success, status: response.status });

      if (data.success) {
        console.log("✅ Login successful, redirecting...");
        
        // Redirección inmediata sin delay
        window.location.href = '/tasks';
        
      } else {
        console.log("❌ Login failed:", data.message);
        setError(data.message || "Login failed");
      }
    } catch (error) {
      console.error("❌ Network error:", error);
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface p-10 rounded-lg">
          <Image src="/images/logo.svg" alt="Assignify" width={160} height={38} className="mx-auto mb-8" />
          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <FormControl sx={{ mb: 2 }}>
              <FormLabel>
                <HugeiconsIcon
                  icon={UserIcon}
                  size={20}
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

            <FormControl sx={{ mb: 4 }}>
              <FormLabel>
                <HugeiconsIcon
                  icon={LockPasswordIcon}
                  size={20}
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
              startDecorator={<HugeiconsIcon icon={Login02Icon} size={20} />}
              sx={{ mb: 2 }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
  );
}