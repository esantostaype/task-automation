// middleware.ts (en la raíz del proyecto)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'

// Rutas que NO requieren autenticación
const publicRoutes = [
  '/login',
  '/api/auth/login',
  '/api/auth/verify'
]

// Rutas de API que NO requieren autenticación
const publicApiRoutes = [
  '/api/auth/'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔍 Middleware checking: ${pathname}`)

  // Permitir acceso a rutas públicas
  if (publicRoutes.includes(pathname)) {
    console.log(`✅ Public route allowed: ${pathname}`)
    return NextResponse.next()
  }

  // Permitir acceso a APIs públicas
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    console.log(`✅ Public API route allowed: ${pathname}`)
    return NextResponse.next()
  }

  // Permitir acceso a archivos estáticos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Verificar token de autenticación
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    console.log(`❌ No token found, redirecting to login from: ${pathname}`)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname) // Para redirección posterior
    return NextResponse.redirect(loginUrl)
  }

  try {
    // Verificar que el token sea válido
    jwt.verify(token, JWT_SECRET)
    console.log(`✅ Valid token, allowing access to: ${pathname}`)
    
    // Si está en login y ya está autenticado, redirigir al dashboard
    if (pathname === '/login') {
      console.log(`🔄 Already authenticated, redirecting from login to dashboard`)
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    return NextResponse.next()
  } catch (error) {
    console.log(`❌ Invalid token, redirecting to login from: ${pathname}`)
    console.log(`Token error:`, error)
    
    // Token inválido - limpiar cookie y redirigir
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
    return response
  }
}

// Configurar en qué rutas se ejecuta el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}