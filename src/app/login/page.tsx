// src/app/login/page.tsx
"use client";

import React, { useState, useEffect } from "react";
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
  CircularProgress,
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
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, loading: authLoading, user } = useAuth();

  // Si ya está autenticado, no mostrar la página de login
  useEffect(() => {
    if (user && !authLoading) {
      // El AuthContext se encargará de la redirección
      return;
    }
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError("");

    try {
      const result = await login(email, password);
      
      if (!result.success) {
        setError(result.message || "Login failed");
      }
      // Si el login es exitoso, el AuthContext se encarga de la redirección
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mostrar loading mientras se verifica la autenticación
  if (authLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <CircularProgress size="lg" />
      </Box>
    );
  }

  // Si ya está autenticado, mostrar mensaje
  if (user) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <Card sx={{ padding: 4, textAlign: "center" }}>
          <Typography level="h3" sx={{ mb: 2 }}>
            Already logged in
          </Typography>
          <Typography level="body-md" color="neutral">
            Redirecting to dashboard...
          </Typography>
          <CircularProgress size="sm" sx={{ mt: 2 }} />
        </Card>
      </Box>
    );
  }

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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </FormControl>

          <Button
            type="submit"
            fullWidth
            loading={isSubmitting}
            disabled={isSubmitting}
            startDecorator={
              !isSubmitting && <HugeiconsIcon icon={Login01Icon} size={16} />
            }
            sx={{ mb: 2 }}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
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