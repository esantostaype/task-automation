// middleware.ts - Versión simplificada (para debugging)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = ['/login', '/api/auth/login', '/api/auth/verify']
const publicApiRoutes = ['/api/auth/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔍 Middleware checking: ${pathname}`)

  // Permitir rutas públicas
  if (publicRoutes.includes(pathname)) {
    console.log(`✅ Public route: ${pathname}`)
    return NextResponse.next()
  }

  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    console.log(`✅ Public API: ${pathname}`)
    return NextResponse.next()
  }

  // Permitir archivos estáticos
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Solo verificar existencia de token (sin validar JWT)
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    console.log(`❌ No token, redirecting from: ${pathname}`)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  console.log(`✅ Token exists, allowing: ${pathname}`)
  
  // Si ya está autenticado y va a login, redirigir
  if (pathname === '/login') {
    console.log(`🔄 Redirecting authenticated user to dashboard`)
    return NextResponse.redirect(new URL('/tasks', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)',],
}