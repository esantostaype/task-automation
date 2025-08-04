/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

// Credenciales hardcodeadas
const VALID_CREDENTIALS = {
  email: 'esantos@inszoneins.com',
  password: 'Ersa#123!'
};

export async function POST(request: NextRequest) {
  try {
    console.log('Login attempt received');
    
    const { email, password } = await request.json();
    console.log('Login attempt for email:', email);

    // Validación de entrada
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        message: 'Email and password are required'
      }, { status: 400 });
    }

    // Validar credenciales
    if (email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      console.log('Credentials valid, creating JWT token');
      
      // Crear JWT token usando jose
      const token = await new SignJWT({ 
        email: email, 
        authenticated: true,
        loginTime: new Date().toISOString()
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .setIssuedAt()
        .sign(JWT_SECRET);

      console.log('JWT token created, setting up response');

      // Crear respuesta
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: { email }
      });

      // Establecer cookie httpOnly
      response.cookies.set({
        name: 'auth-token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
        path: '/',
      });

      console.log('Cookie configured, sending response');
      return response;
    } else {
      console.log('Invalid credentials provided');
      
      // Pequeño delay para prevenir ataques de fuerza bruta
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return NextResponse.json({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}

// Logout endpoint
export async function DELETE() {
  console.log('Logout request received');
  
  const response = NextResponse.json({
    success: true,
    message: 'Logout successful',
    loggedOut: true
  });

  // Limpiar cookie
  response.cookies.delete('auth-token');

  console.log('Cookie cleared, user logged out');
  return response;
}