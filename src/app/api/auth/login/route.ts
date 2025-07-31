// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

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

    // Validar credenciales
    if (email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      console.log('Credentials valid, creating JWT token');
      
      // Crear JWT token
      const token = jwt.sign(
        { email: email, authenticated: true },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('JWT token created, setting up response');

      // Crear respuesta
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: { email }
      });

      // Establecer cookie httpOnly con configuración explícita
      response.cookies.set({
        name: 'auth-token',
        value: token,
        httpOnly: true,
        secure: false, // false para desarrollo (localhost)
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
        path: '/', // Importante: establecer path explícitamente
      });

      console.log('Cookie configured, sending response');
      console.log('Token preview:', token.substring(0, 20) + '...');

      return response;
    } else {
      console.log('Invalid credentials provided');
      return NextResponse.json({
        success: false,
        message: 'Invalid credentials'
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Server error'
    }, { status: 500 });
  }
}

// Logout endpoint
export async function DELETE() {
  console.log('Logout request received');
  
  const response = NextResponse.json({
    success: true,
    message: 'Logout successful'
  });

  // Limpiar cookie
  response.cookies.set({
    name: 'auth-token',
    value: '',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 0, // Expirar inmediatamente
    path: '/',
  });

  console.log('Cookie cleared');
  return response;
}