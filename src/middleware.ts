// middleware.ts - Versión segura con validación JWT
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
)

const publicRoutes = ['/login']
const publicApiRoutes = ['/api/auth/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log(`🔍 Middleware checking: ${pathname}`)

  // Permitir archivos estáticos
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Permitir APIs públicas
  if (publicApiRoutes.some(route => pathname.startsWith(route))) {
    console.log(`✅ Public API: ${pathname}`)
    return NextResponse.next()
  }

  // Verificar y validar token JWT
  const token = request.cookies.get('auth-token')?.value
  let isValidToken = false

  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET)
      isValidToken = true
      console.log(`🔑 Valid JWT token found`)
    } catch (error) {
      console.log(`❌ Invalid JWT token:`, error)
      isValidToken = false
    }
  } else {
    console.log(`🔑 No token found`)
  }

  // LÓGICA PRINCIPAL DE AUTENTICACIÓN
  if (isValidToken) {
    // Usuario autenticado con token válido
    if (pathname === '/login') {
      console.log(`🔄 Authenticated user accessing login, redirecting to dashboard`)
      return NextResponse.redirect(new URL('/tasks', request.url))
    }
    
    console.log(`✅ Authenticated user accessing: ${pathname}`)
    return NextResponse.next()
    
  } else {
    // Usuario NO autenticado o token inválido
    if (publicRoutes.includes(pathname)) {
      console.log(`✅ Public route access: ${pathname}`)
      
      // Si hay token inválido, limpiarlo
      if (token) {
        console.log(`🧹 Cleaning invalid token`)
        const response = NextResponse.next()
        response.cookies.delete('auth-token')
        return response
      }
      
      return NextResponse.next()
    }
    
    // Redirigir a login y limpiar token inválido si existe
    console.log(`❌ Redirecting to login from: ${pathname}`)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    
    const response = NextResponse.redirect(loginUrl)
    if (token) {
      response.cookies.delete('auth-token')
    }
    
    return response
  }
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}