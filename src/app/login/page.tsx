/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, FormControl, FormLabel, Alert, Card, Typography, Box } from '@mui/joy';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon, LockPasswordIcon, Login01Icon } from '@hugeicons/core-free-icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to dashboard or home page
        router.push('/');
        router.refresh();
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 400,
          padding: 4,
          boxShadow: 'lg',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
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
              <HugeiconsIcon icon={UserIcon} size={16} style={{ marginRight: 8 }} />
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
              <HugeiconsIcon icon={LockPasswordIcon} size={16} style={{ marginRight: 8 }} />
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
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography level="body-sm" color="neutral">
            Demo credentials available for testing
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}