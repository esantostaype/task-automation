// src/app/page.tsx - Página raíz que redirige
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/joy';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir automáticamente a /tasks
    console.log('🏠 Root page: Redirecting to /tasks...');
    router.replace('/tasks');
  }, [router]);

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
        Redirigiendo...
      </Typography>
    </Box>
  );
}