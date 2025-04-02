import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { key } from '@/config';

const SECRET_KEY = key.SECRET_KEY;
const CSRF_SECRET = key.SECRET_KEY; // Ideally use a separate secret for CSRF

export async function GET(req: NextRequest) {
  // Check if user is authenticated
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  
  const cookies = parse(cookieHeader);
  const authToken = cookies['auth-token'];
  if (!authToken) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  
  try {
    // Verify auth token
    const decoded = jwt.verify(authToken, SECRET_KEY) as { email: string, id: string, role: string };
    if (decoded.role !== 'user') {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }
    
    // Generate CSRF token
    const csrfToken = randomBytes(32).toString('hex');
    
    // Create CSRF token with expiration (10 minutes)
    const csrfObject = {
      token: csrfToken,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    
    // Sign CSRF object to prevent tampering
    const signedCsrfToken = jwt.sign(csrfObject, CSRF_SECRET);
    
    // Set CSRF token in cookie (HTTP-only to prevent XSS)
    const response = NextResponse.json({ csrfToken });
    response.cookies.set('csrf-token', signedCsrfToken, {
      httpOnly: true,
      path: '/',
      maxAge: 10 * 60, // 10 minutes in seconds
      sameSite: 'strict'
    });
    
    return response;
  } catch (error) {
    return NextResponse.json({ message: 'Invalid authentication' }, { status: 401 });
  }
}
