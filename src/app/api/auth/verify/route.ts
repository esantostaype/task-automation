/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verify endpoint called');
    
    // Obtener todas las cookies para debugging
    const allCookies = request.cookies.getAll();
    console.log('🍪 All cookies received:', allCookies);
    
    const token = request.cookies.get('auth-token')?.value;
    console.log('🔑 Auth token found:', !!token);
    
    if (token) {
      console.log('🔑 Token preview:', token.substring(0, 20) + '...');
    }

    if (!token) {
      console.log('❌ No token provided');
      return NextResponse.json({
        success: false,
        message: 'No token provided',
        debug: {
          cookiesReceived: allCookies.length,
          allCookies: allCookies
        }
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
        debug: {
          tokenValid: true,
          decodedEmail: decoded.email
        }
      });
    } catch (jwtError) {
      console.log('❌ JWT verification failed:', jwtError);
      return NextResponse.json({
        success: false,
        message: 'Invalid token',
        debug: {
          jwtError: String(jwtError),
          tokenReceived: !!token
        }
      }, { status: 401 });
    }
  } catch (error) {
    console.error('❌ Verify endpoint error:', error);
    return NextResponse.json({
      success: false,
      message: 'Server error',
      debug: {
        error: String(error)
      }
    }, { status: 500 });
  }
}