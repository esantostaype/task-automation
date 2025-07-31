/* eslint-disable @typescript-eslint/no-unused-vars */
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('🛡️ Middleware: Checking path:', pathname);

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/verify'];
  
  // Si la ruta es pública, permitir acceso
  if (publicPaths.some(path => pathname.startsWith(path))) {
    console.log('✅ Middleware: Public path, allowing access');
    return NextResponse.next();
  }

  // Obtener token de las cookies
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    console.log('❌ Middleware: No token found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Middleware: Token valid, allowing access');
    return NextResponse.next();
  } catch (error) {
    console.log('❌ Middleware: Invalid token, redirecting to login');
    // Token inválido, redirigir al login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes que no sean auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (página pública)
     */
    '/((?!api/(?!auth)|_next/static|_next/image|favicon.ico|login).*)',
  ],
}