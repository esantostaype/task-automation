/* eslint-disable @typescript-eslint/no-unused-vars */
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/verify'];
  
  // Si la ruta es pública, permitir acceso
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Obtener token de las cookies
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // No hay token, redirigir al login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verificar token
    jwt.verify(token, JWT_SECRET);
    return NextResponse.next();
  } catch (error) {
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