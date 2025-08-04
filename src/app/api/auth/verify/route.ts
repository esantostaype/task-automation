/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/verify/route.ts - MEJORADO
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verify endpoint called');
    
    const token = request.cookies.get('auth-token')?.value;
    console.log('🔑 Auth token found:', !!token);

    if (!token) {
      console.log('❌ No token provided');
      return NextResponse.json({
        success: false,
        message: 'No authentication token provided',
        requiresLogin: true
      }, { status: 401 });
    }

    try {
      console.log('🔍 Verifying JWT token...');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ Token verified successfully:', { email: decoded.email });
      
      return NextResponse.json({
        success: true,
        user: {
          email: decoded.email
        },
        authenticated: true
      });
    } catch (jwtError: any) {
      console.log('❌ JWT verification failed:', jwtError.message);
      
      // Limpiar cookie inválida
      const response = NextResponse.json({
        success: false,
        message: 'Invalid or expired token',
        requiresLogin: true,
        tokenError: true
      }, { status: 401 });

      // Limpiar cookie
      response.cookies.set({
        name: 'auth-token',
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });

      return response;
    }
  } catch (error) {
    console.error('❌ Verify endpoint error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      requiresLogin: true
    }, { status: 500 });
  }
}