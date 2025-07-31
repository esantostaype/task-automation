/* eslint-disable @typescript-eslint/no-unused-vars */
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
    const { email, password } = await request.json();

    // Validar credenciales
    if (email === VALID_CREDENTIALS.email && password === VALID_CREDENTIALS.password) {
      // Crear JWT token
      const token = jwt.sign(
        { email: email, authenticated: true },
        JWT_SECRET,
        { expiresIn: '7d' } // Token válido por 7 días
      );

      // Crear respuesta con cookie
      const response = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: { email }
      });

      // Establecer cookie httpOnly
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 días en segundos
      });

      return response;
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid credentials'
      }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Server error'
    }, { status: 500 });
  }
}

// Logout endpoint
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Logout successful'
  });

  // Limpiar cookie
  response.cookies.delete('auth-token');

  return response;
}